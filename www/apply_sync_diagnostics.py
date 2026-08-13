#!/usr/bin/env python3
"""
Sync diagnostics patch — adds READ-ONLY telemetry to the Firestore cloud-push
retry ladder (_fbSyncLadderForConnection / fbCloudPushWithRetryLadder /
fbPushFull). This does NOT change sync behavior, timing, retry counts, or
anything about how/when data is written — it only records what's actually
happening so the real bottleneck (cold-start channel warmup, misreported
connection type, slow write, etc.) can be identified from real user data.

WHAT IT ADDS:
  1. console.log("[SYNC-DIAG] ...") lines for every attempt: reported
     effectiveType, attempt number, elapsed ms, and outcome (ok/timeout/error).
  2. Payload byte-size logging in fbPushFull (JSON.stringify length) so we
     can rule out/in "document got too big" as a cause.
  3. A small rolling diagnostic log (last 10 sync attempts) written to each
     user's own Firestore doc at users/{uid}/data/syncDiag — allowed by your
     existing firestore.rules (owner can write under users/{userId}/**), so
     you can inspect real-world timings from the Firebase Console without
     needing device logs. This write is fire-and-forget and never blocks or
     fails the real sync.

Nothing here changes _fbSyncLadderForConnection's timeouts, the number of
retries, or fbPushFull's payload — purely additive logging.

USAGE (run from your repo root, or from www/):
    python3 apply_sync_diagnostics.py

Safe to re-run: detects if already applied and exits without touching files
again. Backs up app.js with a .bak-syncdiag suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "[SYNC-DIAG]"


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def find_file(name):
    for candidate in (name, os.path.join("www", name), os.path.join("..", name)):
        if os.path.isfile(candidate):
            return candidate
    die(f"Could not find {name} in the current directory, ./www, or .. — run this from your repo root or www/.")


def main():
    path = find_file(APP_JS)
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        print(f"[{path}] Already applied — nothing to do.")
        return

    # ── Patch 1: instrument fbCloudPushWithRetryLadder with per-attempt timing ──
    old_ladder = '''async function fbCloudPushWithRetryLadder(makeWritePromise, label, onAttempt) {
  const { attempts, waits } = _fbSyncLadderForConnection();
  let lastErr = null;
  for (let i = 0; i < attempts.length; i++) {
    if (typeof onAttempt === "function") {
      try { onAttempt(i + 1, attempts.length); } catch (_e) {}
    }
    try {
      return await fbWithTimeout(makeWritePromise(), attempts[i], label);
    } catch (e) {
      lastErr = e;
      if (i < waits.length) {
        await new Promise((r) => setTimeout(r, waits[i]));
      }
    }
  }
  throw lastErr || new Error((label || "operation") + " failed after retries");
}'''

    new_ladder = '''function _syncDiagRecord(entry) {
  // Fire-and-forget diagnostic trail. Never allowed to affect the real
  // sync path — every step here is wrapped so a failure here is silent.
  try {
    console.log("[SYNC-DIAG]", JSON.stringify(entry));
  } catch (_e) {}
  try {
    if (!window._syncDiagBuffer) window._syncDiagBuffer = [];
    window._syncDiagBuffer.push(entry);
    if (window._syncDiagBuffer.length > 10) window._syncDiagBuffer.shift();
    if (fbUser && fbDb) {
      fbDb
        .collection("users")
        .doc(fbUser.uid)
        .collection("data")
        .doc("syncDiag")
        .set({ recent: window._syncDiagBuffer, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        .catch(() => {});
    }
  } catch (_e) {}
}

async function fbCloudPushWithRetryLadder(makeWritePromise, label, onAttempt) {
  const { attempts, waits } = _fbSyncLadderForConnection();
  let effectiveType = null;
  try { effectiveType = (navigator.connection && navigator.connection.effectiveType) || "unreported"; } catch (_e) { effectiveType = "unreported"; }
  let lastErr = null;
  for (let i = 0; i < attempts.length; i++) {
    if (typeof onAttempt === "function") {
      try { onAttempt(i + 1, attempts.length); } catch (_e) {}
    }
    const _diagStart = Date.now();
    try {
      const result = await fbWithTimeout(makeWritePromise(), attempts[i], label);
      _syncDiagRecord({
        t: new Date().toISOString(), label, effectiveType,
        attempt: i + 1, of: attempts.length,
        elapsedMs: Date.now() - _diagStart, outcome: "ok",
      });
      return result;
    } catch (e) {
      lastErr = e;
      _syncDiagRecord({
        t: new Date().toISOString(), label, effectiveType,
        attempt: i + 1, of: attempts.length,
        elapsedMs: Date.now() - _diagStart, outcome: "failed",
        error: (e && e.message) ? String(e.message).slice(0, 200) : String(e).slice(0, 200),
      });
      if (i < waits.length) {
        await new Promise((r) => setTimeout(r, waits[i]));
      }
    }
  }
  throw lastErr || new Error((label || "operation") + " failed after retries");
}'''

    if old_ladder not in src:
        die("Could not find fbCloudPushWithRetryLadder in the expected form — app.js may already differ from what this script expects. No changes made.")
    src = src.replace(old_ladder, new_ladder, 1)

    # ── Patch 2: log payload byte-size in fbPushFull, right before the push ──
    old_call = '''  try {
    // A Firestore write can hang indefinitely on a bad connection, just
    // like a read (see fbWithTimeout usage in fbMigrate above) — without a
    // bound here, a stuck write leaves the sync pill on "Syncing…" forever
    // and NEVER reaches the catch block below, so the pending markers never
    // get a chance to trigger a retry either. Bounding it turns a silent
    // hang into a normal, retryable failure.
    await fbCloudPushWithRetryLadder(
      () =>
        fbDb
          .collection("users")
          .doc(fbUser.uid)
          .collection("data")
          .doc("main")
          .set(payload),
      "Cloud push",
      (attemptNum, totalAttempts) => {'''

    new_call = '''  try {
    try {
      const _payloadBytes = JSON.stringify(payload).length;
      _syncDiagRecord({ t: new Date().toISOString(), label: "Cloud push", payloadBytes: _payloadBytes, outcome: "payload-measured" });
    } catch (_e) {}
    // A Firestore write can hang indefinitely on a bad connection, just
    // like a read (see fbWithTimeout usage in fbMigrate above) — without a
    // bound here, a stuck write leaves the sync pill on "Syncing…" forever
    // and NEVER reaches the catch block below, so the pending markers never
    // get a chance to trigger a retry either. Bounding it turns a silent
    // hang into a normal, retryable failure.
    await fbCloudPushWithRetryLadder(
      () =>
        fbDb
          .collection("users")
          .doc(fbUser.uid)
          .collection("data")
          .doc("main")
          .set(payload),
      "Cloud push",
      (attemptNum, totalAttempts) => {'''

    if old_call not in src:
        die("Could not find fbPushFull's push call in the expected form — no changes made to app.js (ladder instrumentation was not written either, to keep the file consistent).")
    src = src.replace(old_call, new_call, 1)

    backup_path = path + ".bak-syncdiag"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Sync diagnostics applied. Backup saved to {backup_path}")
    print("Also allow syncDiag writes in firestore.rules if not already covered by the")
    print("existing 'users/{userId}/{document=**}' rule (it already is, by default).")


if __name__ == "__main__":
    main()
