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
// IMPORTANT: DRIVE_CLIENT_ID/SECRET must be the "Web client (Auto created
// by Google Service)" OAuth client — the one embedded in google-services.json
// as the client_type: 3 entry. That's the client Android's native Google
// Sign-In actually uses to mint serverAuthCode, so it's the only one whose
// client_id/secret pair can redeem it. A separately-created Web OAuth
// client (e.g. one you make by hand in Cloud Console for this purpose)
// will NOT match and the token exchange will fail with "invalid_client".
// Find the correct one in Google Cloud Console > APIs & Services >
// Credentials (or Google Auth Platform > Clients) — it won't have a
// custom name unless you've renamed it, and its ID matches the
// "other_platform_oauth_client" entry under your Android app's
// oauth_client list in google-services.json.
// Set these with:
//   firebase functions:secrets:set DRIVE_CLIENT_SECRET
// and DRIVE_CLIENT_ID in the functions/.env.<project-id> file (plain
// string, not sensitive).
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

  // 2. Find-or-create the "Radha Jap BackUp" folder, so every backup lands
  // in one place instead of loose in Drive's root. The folder ID is cached
  // on the user's token doc after the first backup, so later backups skip
  // the search and go straight to a known folder — this only re-checks if
  // that cached folder was itself deleted or trashed by the user.
  const DRIVE_BACKUP_FOLDER_NAME = "Radha Jap BackUp";
  let folderId = tokenDoc.data().driveFolderId || null;

  if (folderId) {
    // Confirm the cached folder still exists and isn't trashed.
    const checkResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!checkResp.ok) {
      folderId = null;
    } else {
      const checkData = await checkResp.json();
      if (checkData.trashed) folderId = null;
    }
  }

  if (!folderId) {
    // Search for an existing folder with this name (drive.file scope only
    // ever shows folders/files this app itself created, so any match here
    // is safely one of ours from a previous session).
    const searchParams = new URLSearchParams({
      q: `name = '${DRIVE_BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name)",
      spaces: "drive",
    });
    const searchResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const searchData = await searchResp.json();
    if (searchResp.ok && searchData.files && searchData.files.length > 0) {
      folderId = searchData.files[0].id;
    } else {
      // Not found — create it.
      const folderCreateResp = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: DRIVE_BACKUP_FOLDER_NAME,
          mimeType: "application/vnd.google-apps.folder",
        }),
      });
      const folderCreateData = await folderCreateResp.json();
      if (!folderCreateResp.ok || !folderCreateData.id) {
        console.error("driveBackupUpload: folder create failed:", folderCreateData);
        return { success: false, reason: "folder_create_failed", details: folderCreateData };
      }
      folderId = folderCreateData.id;
    }
    await tokenDocRef.set({ driveFolderId: folderId }, { merge: true });
  }

  // 3. Create the file inside that folder.
  const boundary = "radhajapbackupboundary";
  const metadata = JSON.stringify({ name: filename, mimeType: "application/json", parents: [folderId] });
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
  "radhanamejapcounter@gmail.com",
  "drakthephenomenal@icloud.com",
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

// ============================================================
// Leaderboard sync — appended, does not touch anything above.
// Triggers on every write to users/{uid}/data/main and computes
// the leaderboard entry server-side. See project notes for why:
// removes the leaderboard-goes-stale bug where the client's
// separate pushLeaderboard() write could silently fail while
// main data kept syncing fine.
// Uses the SAME `admin`/`functions` already required and
// initialized above — does NOT call admin.initializeApp() again.
// ============================================================

function _lbSumHistory(hist) {
  return Object.values(hist || {}).reduce((a, b) => a + (b || 0), 0);
}

function _lbShiftDateKey(dateKey, delta) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

exports.syncLeaderboardOnMainDataWrite = functions.firestore
  .document("users/{uid}/data/main")
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const after = change.after;

    if (!after.exists) {
      await admin.firestore().collection("leaderboard").doc(uid).delete().catch(() => {});
      return null;
    }

    const data = after.data() || {};

    // missing lbOptIn treated as unknown, not opted-out — only an EXPLICIT
    // lbOptIn === false deletes the leaderboard entry. A missing/undefined
    // field (e.g. an older backup restored via Ghost Mode that predates
    // this field) used to be silently treated as an opt-out and delete
    // the user's entry even though they never actually opted out.
    if (data.lbOptIn === false) {
      await admin.firestore().collection("leaderboard").doc(uid).delete().catch(() => {});
      return null;
    }
    // If lbOptIn is missing/undefined entirely and no leaderboard entry
    // exists yet, there's nothing meaningful to compute — skip silently
    // rather than creating an entry for someone who never opted in.
    if (!data.lbOptIn) {
      const existing = await admin.firestore().collection("leaderboard").doc(uid).get();
      if (!existing.exists) return null;
    }

    const hist = data.history || {};
    const histRV = data.historyRV || {};
    const histKV = data.historyKV || {};
    const histSS = data.historySS || {};
    const histHK = data.historyHK || {};
    const hist28 = data.h28 || {};

    const totalRadha = _lbSumHistory(hist);
    const totalRV = _lbSumHistory(histRV);
    const totalKV = _lbSumHistory(histKV);
    const totalSS = _lbSumHistory(histSS);
    const totalHK = _lbSumHistory(histHK);
    const total28 = _lbSumHistory(hist28);

    const totalJap = Math.max(
      0,
      totalRadha + totalRV + totalKV + totalSS + totalHK + total28 -
        (data.nameJapDeduct || 0) -
        (data.nameJapDeductRV || 0) -
        (data.nameJapDeductKV || 0) -
        (data.nameJapDeductSS || 0) -
        (data.nameJapDeductHK || 0) -
        (data.nameJapDeduct28 || 0)
    );

    let displayName = (data.lbDisplayName || "").trim();
    if (!displayName) {
      try {
        const userRecord = await admin.auth().getUser(uid);
        displayName = (
          userRecord.displayName ||
          (userRecord.email || "").split("@")[0] ||
          "Anonymous Devotee"
        ).slice(0, 30);
      } catch (_e) {
        displayName = "Anonymous Devotee";
      }
    }
    if (!displayName) displayName = "Anonymous Devotee";

    const liveTk = data.malaLogDate || "";

    let streak = 0;
    if (liveTk) {
      const allHist = {};
      const allKeys = new Set([
        ...Object.keys(hist),
        ...Object.keys(histRV),
        ...Object.keys(histKV),
        ...Object.keys(histSS),
        ...Object.keys(histHK),
      ]);
      allKeys.forEach((k) => {
        allHist[k] =
          (hist[k] || 0) + (histRV[k] || 0) + (histKV[k] || 0) +
          (histSS[k] || 0) + (histHK[k] || 0);
      });
      const target = data.dt || data.dtRV || data.dtKV || data.dtHK || 0;
      let key = liveTk;
      let guard = 0;
      while (guard < 3650) {
        const dayJap = allHist[key] || 0;
        if (dayJap <= 0 || (target > 0 && dayJap < target)) break;
        streak++;
        key = _lbShiftDateKey(key, -1);
        guard++;
      }
    }

    const todayBreakdown = {
      r: hist[liveTk] || 0,
      rv: histRV[liveTk] || 0,
      kv: histKV[liveTk] || 0,
      ss: histSS[liveTk] || 0,
      hk: histHK[liveTk] || 0,
      n28: hist28[liveTk] || 0,
    };
    const timerHist = data.timerHistory || {};
    const timerHistRV = data.timerHistoryRV || {};
    const timerHistKV = data.timerHistoryKV || {};
    const timerHistSS = data.timerHistorySS || {};
    const timerHistHK = data.timerHistoryHK || {};
    const timer28Hist = data.timer28History || {};
    const todayTimeBreakdown = {
      r: timerHist[liveTk] || 0,
      rv: timerHistRV[liveTk] || 0,
      kv: timerHistKV[liveTk] || 0,
      ss: timerHistSS[liveTk] || 0,
      hk: timerHistHK[liveTk] || 0,
      n28: timer28Hist[liveTk] || 0,
    };
    const todayJap =
      todayBreakdown.r + todayBreakdown.rv + todayBreakdown.kv +
      todayBreakdown.ss + todayBreakdown.hk + todayBreakdown.n28;
    const todayTimerSeconds =
      todayTimeBreakdown.r + todayTimeBreakdown.rv + todayTimeBreakdown.kv +
      todayTimeBreakdown.ss + todayTimeBreakdown.hk + todayTimeBreakdown.n28;

    const payload = {
      displayName,
      totalJap,
      totalMalas: Math.floor(totalJap / (data.ms || 108)),
      streak,
      optIn: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      todayKey: liveTk,
      todayJap,
      todayTimerSeconds,
      todayBreakdown,
      todayTimeBreakdown,
      history: hist,
      historyRV: histRV,
      historyKV: histKV,
      historySS: histSS,
      historyHK: histHK,
      history28: hist28,
      nameJapDeduct: data.nameJapDeduct || 0,
      nameJapDeductRV: data.nameJapDeductRV || 0,
      nameJapDeductKV: data.nameJapDeductKV || 0,
      nameJapDeductSS: data.nameJapDeductSS || 0,
      nameJapDeductHK: data.nameJapDeductHK || 0,
      nameJapDeduct28: data.nameJapDeduct28 || 0,
      timerSeconds:
        _lbSumHistory(timerHist) + _lbSumHistory(timerHistRV) +
        _lbSumHistory(timerHistKV) + _lbSumHistory(timerHistSS) +
        _lbSumHistory(timerHistHK) + _lbSumHistory(timer28Hist),
      timerHistory: timerHist,
      timerHistoryRV: timerHistRV,
      timerHistoryKV: timerHistKV,
      timerHistorySS: timerHistSS,
      timerHistoryHK: timerHistHK,
      timer28History: timer28Hist,
    };

    await admin.firestore().collection("leaderboard").doc(uid).set(payload);
    return null;
  });
