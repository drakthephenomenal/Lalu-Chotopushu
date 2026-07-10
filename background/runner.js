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
    await pushToFirestore(uid, idToken, payload);

    console.log("Background sync: pushed staged data for", uid);
    resolve();
  } catch (e) {
    console.error("Background sync failed:", e && e.message ? e.message : e);
    // Resolve rather than reject even on failure — a failed cycle should
    // not cause Android to abandon future scheduled runs.
    resolve();
  }
});
