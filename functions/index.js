const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

const { defineString, defineSecret } = require("firebase-functions/params");

// Set at deploy time — Firebase will prompt for these interactively the
// first time, since functions.config() (the old way) is no longer
// returning values for this project.
//   ZOHO_CLIENT_ID      — from https://api-console.zoho.com
//   ZOHO_CLIENT_SECRET  — from https://api-console.zoho.com (kept in Secret Manager)
//   ZOHO_REDIRECT_URI   — must match, character-for-character, both:
//     1. ZOHO_NATIVE_CONFIG.redirectUri in app.js (native sign-in flow)
//     2. The Authorized Redirect URI registered for this client in
//        Zoho's API Console
//   Typically: app.vercel.radharadharadha.capacitor://oauthredirect
const ZOHO_CLIENT_ID = defineString("ZOHO_CLIENT_ID");
const ZOHO_CLIENT_SECRET = defineSecret("ZOHO_CLIENT_SECRET");
const ZOHO_REDIRECT_URI = defineString("ZOHO_REDIRECT_URI");

// Called by app.js (_zohoNativeSignIn) with the authorization `code` Zoho
// redirected back with. Exchanges it server-side (client secret never
// leaves this function), looks up/creates a matching Firebase Auth user,
// and returns a Firebase custom token the app signs in with.
exports.zohoTokenExchange = functions
  .runWith({ secrets: [ZOHO_CLIENT_SECRET] })
  .https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET, POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  const code = req.method === "GET" ? req.query.code : (req.body || {}).code;
  if (!code) {
    return res.status(400).json({ error: "Missing 'code' parameter" });
  }

  try {
    // 1. Exchange the authorization code for a Zoho access token
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ZOHO_CLIENT_ID.value(),
      client_secret: ZOHO_CLIENT_SECRET.value(),
      redirect_uri: ZOHO_REDIRECT_URI.value(),
      code,
    });

    const tokenResp = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const tokenData = await tokenResp.json();

    if (!tokenResp.ok || tokenData.error || !tokenData.access_token) {
      console.error("Zoho token exchange failed:", tokenData);
      return res.status(400).json({ error: "Zoho token exchange failed", details: tokenData });
    }

    // 2. Fetch the Zoho user's profile (stable ID + email)
    const userInfoResp = await fetch("https://accounts.zoho.com/oauth/user/info", {
      headers: { Authorization: "Zoho-oauthtoken " + tokenData.access_token },
    });
    const userInfo = await userInfoResp.json();

    if (!userInfo || !userInfo.Email) {
      console.error("Zoho user info fetch failed:", userInfo);
      return res.status(400).json({ error: "Could not fetch Zoho user profile", details: userInfo });
    }

    const uid = "zoho:" + (userInfo.ZUID || userInfo.Email);

    // 3. Ensure a matching Firebase Auth user exists
    try {
      await admin.auth().getUser(uid);
    } catch (_notFound) {
      await admin.auth().createUser({
        uid,
        email: userInfo.Email,
        displayName:
          [userInfo.First_Name, userInfo.Last_Name].filter(Boolean).join(" ") || undefined,
      });
    }

    // 4. Mint the custom token the app will sign in with
    const customToken = await admin.auth().createCustomToken(uid, { provider: "zoho" });
    return res.status(200).json({ customToken });
  } catch (e) {
    console.error("zohoTokenExchange error:", e);
    return res.status(500).json({ error: "Internal error", details: String(e) });
  }
});

// ═══════════════════════════════════════════════════════
// GOOGLE DRIVE — Daily backup (like WhatsApp's Drive chat backup)
// ═══════════════════════════════════════════════════════
// Set these with:
//   firebase functions:config:set drive.client_id="YOUR_CLIENT_ID" \
//     drive.client_secret="YOUR_CLIENT_SECRET"
// (Values come from the "Drive Backup Server Client" OAuth Web client
// created in Google Cloud Console > APIs & Services > Credentials.)
// Unlike functions.config() (deprecated, being shut down — see the Zoho
// section above for the full explanation), these params are resolved
// safely at deploy/runtime — no risk of the deploy-time crash we hit with
// the old approach. DRIVE_CLIENT_SECRET is a real Secret Manager secret
// (encrypted at rest); DRIVE_CLIENT_ID is a plain string param since
// client IDs aren't sensitive. Both prompt interactively on first deploy
// if not already set — no separate "config:set" command needed.
const DRIVE_CLIENT_ID = defineString("DRIVE_CLIENT_ID");
const DRIVE_CLIENT_SECRET = defineSecret("DRIVE_CLIENT_SECRET");
const DRIVE_BACKUP_FILENAME = "radha-naam-jap-backup.json";

// Called once by app.js right after Google sign-in, if the sign-in result
// included a serverAuthCode (only present when the drive.file scope was
// requested). Exchanges it for a refresh token — this exchange MUST happen
// server-side, since it requires the client secret, which must never ship
// in the app. The refresh token is stored in driveBackupTokens/{uid},
// locked to Admin-SDK-only access by firestore.rules.
exports.driveTokenExchange = functions
  .runWith({ secrets: [DRIVE_CLIENT_SECRET] })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  const serverAuthCode = (data && data.serverAuthCode || "").trim();
  if (!serverAuthCode) {
    throw new functions.https.HttpsError("invalid-argument", "Missing serverAuthCode.");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: DRIVE_CLIENT_ID.value(),
    client_secret: DRIVE_CLIENT_SECRET.value(),
    code: serverAuthCode,
    redirect_uri: "", // empty — matches the native offline-access code flow
  });

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const tokenData = await tokenResp.json();

  if (!tokenResp.ok || !tokenData.refresh_token) {
    console.error("driveTokenExchange failed:", tokenData);
    // Not always an error — Google only returns a refresh_token on the
    // FIRST consent for this scope+account+client combo. If the user
    // already granted this before, there may be nothing new to store,
    // and any previously stored refresh token is still valid and unaffected.
    return { stored: false, reason: tokenData.error || "no_refresh_token" };
  }

  await admin.firestore().collection("driveBackupTokens").doc(context.auth.uid).set(
    {
      refreshToken: tokenData.refresh_token,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { stored: true };
});

// Called by app.js (manual "Backup Now" button) or by background/runner.js
// (daily auto-backup, if the user opted in) with the backup JSON already
// built. Refreshes a Drive-scoped access token from the stored refresh
// token, then creates a NEW file in the user's own Drive every time —
// manual backups and daily auto-backups both keep their own dated file
// rather than overwriting a single rolling one, so nothing is ever
// silently lost. At real-world file sizes here (tens of KB, a couple
// dozen users) this costs negligible Drive storage even accumulated over
// years.
exports.driveBackupUpload = functions
  .runWith({ secrets: [DRIVE_CLIENT_SECRET] })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  const backupJson = data && data.backupJson;
  if (!backupJson || typeof backupJson !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing backupJson.");
  }
  // Caller supplies the filename (so it can reflect the user's local time,
  // not the server's) — sanitized here so it can't be used for path
  // tricks or weird characters. Falls back to a server-generated name if
  // the caller didn't provide one.
  let filename = (data && data.filename || "").toString().replace(/[\/\\:*?"<>|]/g, "-").slice(0, 200);
  if (!filename) {
    filename = `${DRIVE_BACKUP_FILENAME.replace(/\.json$/, "")}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  }

  const uid = context.auth.uid;
  const tokenDocRef = admin.firestore().collection("driveBackupTokens").doc(uid);
  const tokenDoc = await tokenDocRef.get();
  if (!tokenDoc.exists || !tokenDoc.data().refreshToken) {
    return { success: false, reason: "not_authorized" };
  }

  // 1. Refresh a Drive-scoped access token (short-lived, ~1hr).
  const refreshParams = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: DRIVE_CLIENT_ID.value(),
    client_secret: DRIVE_CLIENT_SECRET.value(),
    refresh_token: tokenDoc.data().refreshToken,
  });
  const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshParams.toString(),
  });
  const refreshData = await refreshResp.json();
  if (!refreshResp.ok || !refreshData.access_token) {
    console.error("driveBackupUpload: token refresh failed:", refreshData);
    return { success: false, reason: "refresh_failed", details: refreshData };
  }
  const accessToken = refreshData.access_token;

  // 2. Create the file.
  const boundary = "radhajapbackupboundary";
  const metadata = JSON.stringify({ name: filename, mimeType: "application/json" });
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n${backupJson}\r\n` +
    `--${boundary}--`;

  const createResp = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  const createData = await createResp.json();
  if (!createResp.ok || !createData.id) {
    console.error("driveBackupUpload: create failed:", createData);
    return { success: false, reason: "create_failed", details: createData };
  }

  await tokenDocRef.set(
    { lastBackupAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );
  return { success: true, fileId: createData.id, filename, mode: "created" };
});

// Same developer allow-list as firestore.rules' isDeveloper() — keep both
// in sync manually, Cloud Functions can't read the rules file at runtime.
const DEV_EMAILS = [
  "drakthephenomenal@gmail.com",
  "akthephenomenal@zohomail.com",
  "drakthephenomenal@proton.me",
  "anupkumarpaulshuvo@gmail.com",
];

// Called by app.js (window.sendDevBroadcast, in the Developer Settings
// panel). Reads every user's stored fcmToken (written by lcRegisterPush()
// in app.js, at users/{uid}/data/main.fcmToken) and pushes the same
// notification to all of them via FCM. Any tokens FCM reports as
// unregistered/invalid are cleaned up so future broadcasts don't keep
// retrying them.
exports.sendBroadcastNotification = functions.https.onCall(async (data, context) => {
  const email = (context.auth && context.auth.token && context.auth.token.email || "").toLowerCase();
  if (!context.auth || !DEV_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Developer access only.");
  }

  const title = (data && data.title || "").trim();
  const body = (data && data.body || "").trim();
  if (!title || !body) {
    throw new functions.https.HttpsError("invalid-argument", "title and body are required.");
  }

  // users/{uid}/data/main — collectionGroup query across every user's
  // "data" subcollection, filtered down to just the "main" doc.
  const snap = await admin.firestore().collectionGroup("data").get();
  const tokens = [];
  const docRefs = [];
  snap.forEach((doc) => {
    if (doc.id !== "main") return;
    const t = doc.get("fcmToken");
    if (t) { tokens.push(t); docRefs.push(doc.ref); }
  });

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
  });

  // Prune tokens FCM says are dead so they don't accumulate forever.
  const cleanup = [];
  res.responses.forEach((r, i) => {
    if (!r.success && r.error && (
      r.error.code === "messaging/registration-token-not-registered" ||
      r.error.code === "messaging/invalid-registration-token"
    )) {
      cleanup.push(docRefs[i].set({ fcmToken: admin.firestore.FieldValue.delete() }, { merge: true }));
    }
  });
  if (cleanup.length) await Promise.all(cleanup);

  return { sent: res.successCount, failed: res.failureCount };
});
