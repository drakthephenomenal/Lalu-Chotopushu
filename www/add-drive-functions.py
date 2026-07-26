#!/usr/bin/env python3
"""
Run this from your repo root in the Codespace terminal:
    python3 add-drive-functions.py

Adds the driveTokenExchange and driveBackupUpload Cloud Functions to
functions/index.js, right before the existing DEV_EMAILS section.
Safe to run once. Running it twice will fail loudly (assert) instead of
duplicating the block.
"""

DRIVE_BLOCK = '''// ═══════════════════════════════════════════════════════
// GOOGLE DRIVE — Daily backup (like WhatsApp's Drive chat backup)
// ═══════════════════════════════════════════════════════
// Set these with:
//   firebase functions:config:set drive.client_id="YOUR_CLIENT_ID" \\
//     drive.client_secret="YOUR_CLIENT_SECRET"
// (Values come from the "Drive Backup Server Client" OAuth Web client
// created in Google Cloud Console > APIs & Services > Credentials.)
const DRIVE_CLIENT_ID = functions.config().drive.client_id;
const DRIVE_CLIENT_SECRET = functions.config().drive.client_secret;
const DRIVE_BACKUP_FILENAME = "radha-naam-jap-backup.json";

// Called once by app.js right after Google sign-in, if the sign-in result
// included a serverAuthCode (only present when the drive.file scope was
// requested). Exchanges it for a refresh token — this exchange MUST happen
// server-side, since it requires the client secret, which must never ship
// in the app. The refresh token is stored in driveBackupTokens/{uid},
// locked to Admin-SDK-only access by firestore.rules.
exports.driveTokenExchange = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  const serverAuthCode = (data && data.serverAuthCode || "").trim();
  if (!serverAuthCode) {
    throw new functions.https.HttpsError("invalid-argument", "Missing serverAuthCode.");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: DRIVE_CLIENT_ID,
    client_secret: DRIVE_CLIENT_SECRET,
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

// Called daily by background/runner.js (app fully closed) with the day's
// backup JSON already staged. Refreshes a Drive-scoped access token from
// the stored refresh token, then creates-or-updates a single file in the
// user's own Drive (same file every day, not a new one) so it behaves like
// a rolling daily backup rather than accumulating clutter.
exports.driveBackupUpload = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  const backupJson = data && data.backupJson;
  if (!backupJson || typeof backupJson !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing backupJson.");
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
    client_id: DRIVE_CLIENT_ID,
    client_secret: DRIVE_CLIENT_SECRET,
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

  const existingFileId = tokenDoc.data().driveFileId;

  // 2. Update the existing backup file if we know its id, else create one.
  if (existingFileId) {
    const updateResp = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: backupJson,
      },
    );
    if (updateResp.ok) {
      await tokenDocRef.set(
        { lastBackupAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      return { success: true, fileId: existingFileId, mode: "updated" };
    }
    // File may have been deleted/moved by the user — fall through to create a new one.
    console.warn("driveBackupUpload: update failed, will create new file:", await updateResp.text().catch(() => ""));
  }

  // 3. Create the file (first backup ever, or previous file went missing).
  const boundary = "radhajapbackupboundary";
  const metadata = JSON.stringify({ name: DRIVE_BACKUP_FILENAME, mimeType: "application/json" });
  const multipartBody =
    `--${boundary}\\r\\n` +
    `Content-Type: application/json; charset=UTF-8\\r\\n\\r\\n${metadata}\\r\\n` +
    `--${boundary}\\r\\n` +
    `Content-Type: application/json\\r\\n\\r\\n${backupJson}\\r\\n` +
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
    {
      driveFileId: createData.id,
      lastBackupAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { success: true, fileId: createData.id, mode: "created" };
});

'''

ANCHOR = "// Same developer allow-list as firestore.rules' isDeveloper() — keep both"

with open("functions/index.js") as f:
    content = f.read()

assert ANCHOR in content, "Anchor not found — index.js may already differ from what this script expects."
assert "driveTokenExchange" not in content, "driveTokenExchange already present — script already ran, aborting."

content = content.replace(ANCHOR, DRIVE_BLOCK + ANCHOR)

with open("functions/index.js", "w") as f:
    f.write(content)

print("✅ Patched functions/index.js — added driveTokenExchange and driveBackupUpload")
