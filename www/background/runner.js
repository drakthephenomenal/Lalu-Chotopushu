// ══════════════════════════════════════════════════════════════
// Background Runner — periodic sync while the app is fully closed
// ══════════════════════════════════════════════════════════════
// This file runs in a completely isolated JS sandbox managed by Android's
// WorkManager (via @capacitor/background-runner). It has NO access to the
// main app's WebView, DOM, in-memory state, or the Firebase JS SDK loaded
// there. It only has: fetch, CapacitorKV (a small shared key-value store),
// and a handful of Capacitor APIs like LocalNotifications/console.
//
// Flow each time Android wakes this task up (roughly every 60 minutes):
//   1. Read the staged uid + refreshToken + last-known payload from
//      CapacitorKV (written by app.js during normal use — see the
//      onAuthStateChanged and fbPushFull edits in app.js).
//   2. Exchange the refresh token for a fresh ID token (Firebase Auth
//      "secure token" REST endpoint — ID tokens expire hourly, so this
//      is required every run).
//   3. PATCH the same Firestore document the live app writes to
//      (users/{uid}/data/main), using the Firestore REST API.
//
// This does NOT replace the normal 3-second-debounced sync while the app
// is open — that keeps working exactly as before. This only covers the
// gap where the app has been fully closed for a long time and never had
// a chance to flush a final pending write.

const FIREBASE_API_KEY = "AIzaSyCvvXEdsJjXpTbITE2HuyYFnPZfZIkxVWA";
const FIREBASE_PROJECT_ID = "guru-kripahi-kevalam-108";

async function kvGet(key) {
  try {
    const r = await CapacitorKV.get({ key });
    return r && r.value != null ? r.value : null;
  } catch (_) {
    return null;
  }
}

async function kvSet(key, value) {
  try {
    await CapacitorKV.set({ key, value });
  } catch (_) {}
}

async function refreshIdToken(refreshToken) {
  const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  if (!res.ok) throw new Error("Token refresh failed: " + res.status);
  const data = await res.json();
  return data.id_token;
}

// Converts a plain JS object into Firestore's REST "Value" wire format.
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(val);
  }
  return fields;
}
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    return { mapValue: { fields: toFirestoreFields(val) } };
  }
  return { stringValue: String(val) };
}

async function pushToFirestore(uid, idToken, payloadObj) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/users/${uid}/data/main`;

  // updateMask.fieldPaths tells Firestore to merge these fields rather
  // than overwrite the whole document, matching the live app's .set()
  // semantics closely enough for a periodic fallback sync.
  const fieldPaths = Object.keys(payloadObj)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");

  const res = await fetch(`${url}?${fieldPaths}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(payloadObj) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore push failed: ${res.status} ${text}`);
  }
}

// This sandbox has no Firebase SDK, so HTTPS Callable functions are invoked
// by hand, following Firebase's callable wire protocol directly: POST
// {"data": ...} with the user's ID token as a Bearer token, expect back
// either {"result": ...} or {"error": {...}}.
const FIREBASE_FUNCTIONS_REGION = "us-central1";
async function callCloudFunction(name, idToken, data) {
  const url = `https://${FIREBASE_FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(`${name} failed: ${res.status} ${JSON.stringify(body.error || body)}`);
  }
  return body.result;
}

addEventListener("periodicSync", async (resolve, reject) => {
  try {
    const uid = await kvGet("bgsync_uid");
    const refreshToken = await kvGet("bgsync_refresh_token");
    const payloadStr = await kvGet("bgsync_payload");

    if (!uid || !refreshToken || !payloadStr) {
      // Nothing staged yet (e.g. user never opened the app after installing,
      // or is signed out) — nothing to do this cycle.
      resolve();
      return;
    }

    const payload = JSON.parse(payloadStr);
    const idToken = await refreshIdToken(refreshToken);
    // One quick retry within the same wake cycle. WorkManager only wakes
    // this task up roughly every 15 minutes (the Android platform minimum
    // for periodic work), so it's worth spending a few extra seconds here
    // to beat a transient blip rather than losing a full cycle to it.
    try {
      await pushToFirestore(uid, idToken, payload);
    } catch (firstErr) {
      console.warn("Background sync: first attempt failed, retrying once:", firstErr && firstErr.message ? firstErr.message : firstErr);
      await new Promise((r) => setTimeout(r, 3000));
      await pushToFirestore(uid, idToken, payload);
    }

    console.log("Background sync: pushed staged data for", uid);
    // Clear the marker shared with the live app — its next cloud
    // hydration checks this (in addition to its own localStorage marker)
    // so it doesn't fire a redundant duplicate push for data the
    // Background Runner already got safely into Firestore.
    await kvSet("bgsync_pending_since", "");

    // Daily Google Drive backup — independent of the Firestore push above.
    // Runs on the same periodicSync cycle (Android's WorkManager only
    // wakes this task up roughly once every 24h per capacitor.config.json,
    // so no extra date-gating is needed here). Wrapped in its own
    // try/catch: a Drive failure (e.g. user never granted the drive.file
    // scope, so nothing was staged, or a revoked/expired refresh token)
    // must never break the Firestore fallback sync above.
    try {
      const driveBackupJson = await kvGet("bgsync_drive_payload");
      if (driveBackupJson) {
        // ── Custom time-of-day gating ──
        const targetHour = parseInt((await kvGet("bgsync_drive_backup_hour")) ?? "3", 10);
        const targetMinute = parseInt((await kvGet("bgsync_drive_backup_minute")) ?? "0", 10);
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const targetMinutes = targetHour * 60 + targetMinute;
        const withinWindow = Math.abs(nowMinutes - targetMinutes) <= 35;

        const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
        const lastRunDate = await kvGet("bgsync_last_drive_backup_date");

        if (withinWindow && lastRunDate !== today) {
          const result = await callCloudFunction("driveBackupUpload", idToken, {
            backupJson: driveBackupJson,
          });
          console.log("Background Drive backup:", result && result.success ? result.filename : result);
          await kvSet("bgsync_last_drive_backup_date", today);
        }
      }
    } catch (driveErr) {
      console.warn("Background Drive backup failed (non-fatal):", driveErr && driveErr.message ? driveErr.message : driveErr);
    }

    resolve();
  } catch (e) {
    console.error("Background sync failed:", e && e.message ? e.message : e);
    // Resolve rather than reject even on failure — a failed cycle should
    // not cause Android to abandon future scheduled runs.
    resolve();
  }
});
