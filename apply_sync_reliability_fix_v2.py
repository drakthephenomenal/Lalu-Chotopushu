#!/usr/bin/env python3
"""
Sync reliability fix v2 — hardens BOTH the live app's sync path AND the
Background Runner itself, so data survives even a near-instant OS kill.

This supersedes the earlier draft. If you already applied a version that
only touched _fbDoPush(), just run this on top of a clean app.js (restore
from .bak-syncfix first) — this script checks for its own markers and
will not double-apply.

ROOT CAUSES FIXED (see previous discussion for #1-4; this version adds #5-6):
  1. Firestore writes were fire-and-forget with nothing tracking whether
     they actually landed.
  2. The Background Runner's fallback snapshot (bgsync_payload) was only
     refreshed AFTER a successful live push, so a device that kept losing
     the race just kept re-sending stale data forever.
  3. fbPushFull()'s write had no timeout, unlike the pull path — a hung
     write left the sync pill on "Syncing…" forever with no retry.
  4. pushLeaderboard() (small doc, what others see) and the real per-day
     history push were fully decoupled, so the community board could look
     fine on a day whose real history silently failed.
  5. NEW — the marker + fallback snapshot were only (re-)staged once the
     3-second push debounce actually fired. If the OS kills the process in
     that 3-second window (very plausible on aggressive OEM battery
     optimizers), NOTHING was ever staged at all — not even for the
     Background Runner to find on its next ~15-minute wake. This version
     stages a marker + snapshot as early as the FIRST line of
     fbDebouncedPush() (i.e. the moment a save happens, not 3s later),
     throttled to ~once/second so a fast-tapping burst doesn't hammer the
     native bridge.
  6. NEW — the pending marker only lived in the live app's localStorage,
     which the Background Runner's isolated JS sandbox can't see. It's now
     ALSO written to CapacitorKV (the one store both contexts share), and
     the Background Runner clears it there once it confirms a push, so the
     next time the app opens it knows a background push already succeeded
     and skips a redundant duplicate. The Background Runner itself also now
     gets one quick in-cycle retry if its first push attempt fails, instead
     of giving up until the next ~15-minute wake.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_sync_reliability_fix_v2.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js -> app.js.bak-syncfix-v2 and
background/runner.js -> background/runner.js.bak-syncfix-v2 first.

After running:
    bash setup-www.sh
    npx cap sync android
"""
import os
import sys

APP_JS = "app.js"
RUNNER_JS = os.path.join("background", "runner.js")


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def apply_edit(src, old, new, label, filename):
    count = src.count(old)
    if count == 0:
        die(
            f"[{filename}] Anchor for '{label}' not found. This file may "
            "differ from the version this patch was written against — "
            "aborting without changing anything."
        )
    if count > 1:
        die(
            f"[{filename}] Anchor for '{label}' appears {count} times "
            "(expected exactly 1) — aborting without changing anything."
        )
    return src.replace(old, new, 1)


def main():
    cwd = os.getcwd()
    for fn in (APP_JS, RUNNER_JS):
        if not os.path.isfile(fn):
            die(
                f"Could not find {fn} in the current directory ({cwd}).\n"
                "Run this script from your repo root, e.g.:\n"
                "  cd ~/Lalu-Chotopushu\n"
                "  python3 apply_sync_reliability_fix_v2.py"
            )

    with open(APP_JS, "r", encoding="utf-8") as f:
        app_src = f.read()
    with open(RUNNER_JS, "r", encoding="utf-8") as f:
        runner_src = f.read()

    if "bgsync_pending_since" in app_src or "bgsync_pending_since" in runner_src:
        print("This fix already appears to be applied. Nothing to do.")
        sys.exit(0)

    for required in ("function fbWithTimeout(", "function fbDebouncedPush()", "function fbApplyRemote("):
        if required not in app_src:
            die(f"Could not find {required!r} in app.js — aborting without changing anything.")
    if 'addEventListener("periodicSync"' not in runner_src:
        die("Could not find the periodicSync handler in background/runner.js — aborting.")

    # ══════════════════════════════════════════════════════
    # app.js — Edit 1: fbDebouncedPush() — stage as early as possible,
    # throttled to ~once/sec, using BOTH localStorage (fast, foreground)
    # and CapacitorKV (shared with the Background Runner, durable).
    # ══════════════════════════════════════════════════════
    old1 = '''let _fbDeb = null;
let _fbMaxWaitTimer = null;
let _fbLastPushAt = 0;
const FB_DEBOUNCE_MS = 3000;
const FB_MAX_WAIT_MS = 5000; // force a push at least this often during continuous tapping

function fbDebouncedPush() {
  if (!fbUser) return;
  // v154: hard belt-and-suspenders guard. Even if some future tap path forgets
  // its own isGhostMode() check, no ghost-mode write will ever reach Firestore
  // and imprint the viewed user's data onto the developer's own profile.
  if (typeof isGhostMode === "function" && isGhostMode()) return;

  clearTimeout(_fbDeb);
  _fbDeb = setTimeout(() => _fbDoPush(), FB_DEBOUNCE_MS);'''

    new1 = '''let _fbDeb = null;
let _fbMaxWaitTimer = null;
let _fbLastPushAt = 0;
let _bgStageLastAt = 0;
const FB_DEBOUNCE_MS = 3000;
const FB_MAX_WAIT_MS = 5000; // force a push at least this often during continuous tapping

function fbDebouncedPush() {
  if (!fbUser) return;
  // v154: hard belt-and-suspenders guard. Even if some future tap path forgets
  // its own isGhostMode() check, no ghost-mode write will ever reach Firestore
  // and imprint the viewed user's data onto the developer's own profile.
  if (typeof isGhostMode === "function" && isGhostMode()) return;

  // ── Durability against an instant app-kill ──
  // Mark that this device has changes not yet CONFIRMED in Firestore right
  // NOW, at the moment a push is first scheduled — not 3 seconds from now
  // when the debounce timer below actually fires. If the OS kills the
  // process in that 3s window (aggressive battery-optimizer OEMs do this
  // routinely), the debounce timer never runs and NOTHING would otherwise
  // have been staged for the Background Runner to find on its next wake.
  try { localStorage.setItem("rjap_sync_pending", String(Date.now())); } catch (_e) {}
  // Also refresh the Background Runner's fallback snapshot, in the ONE
  // store both this WebView and the Runner's isolated sandbox actually
  // share (CapacitorKV) — throttled to roughly once/second so a fast
  // tapping burst doesn't hammer the native bridge, while still shrinking
  // the "died before anything was staged" window from ~3s down to ~1s.
  const _bgNow = Date.now();
  if (_bgNow - _bgStageLastAt > 1000) {
    _bgStageLastAt = _bgNow;
    try {
      if (window.Capacitor?.Plugins?.CapacitorKV && typeof _buildBackupPayload === "function") {
        const kv = _buildBackupPayload();
        delete kv._version;
        delete kv._exported;
        window.Capacitor.Plugins.CapacitorKV.set({ key: "bgsync_payload", value: JSON.stringify(kv) }).catch(() => {});
        window.Capacitor.Plugins.CapacitorKV.set({ key: "bgsync_pending_since", value: String(_bgNow) }).catch(() => {});
      }
    } catch (_e) {}
  }

  clearTimeout(_fbDeb);
  _fbDeb = setTimeout(() => _fbDoPush(), FB_DEBOUNCE_MS);'''

    app_src = apply_edit(app_src, old1, new1, "fbDebouncedPush early staging", APP_JS)

    # ══════════════════════════════════════════════════════
    # app.js — Edit 2: fbPushFull() — timeout-bound write; on confirmed
    # success clear BOTH the localStorage marker and the shared CapacitorKV
    # marker so the Background Runner (or the next app open) doesn't retry
    # something that already landed.
    # ══════════════════════════════════════════════════════
    old2 = '''  try {
    await fbDb
      .collection("users")
      .doc(fbUser.uid)
      .collection("data")
      .doc("main")
      .set(payload);
    // Stage a plain-JSON copy (minus the serverTimestamp sentinel, which
    // can't be serialized) for the native Background Runner. This is the
    // "last known good" snapshot it will re-push if the app stays closed
    // for a long stretch and this device never got a chance to sync.
    if (window.Capacitor?.Plugins?.CapacitorKV) {
      try {
        const kvPayload = { ...payload };
        delete kvPayload.lastSync; // FieldValue sentinel — not JSON-safe
        await window.Capacitor.Plugins.CapacitorKV.set({
          key: "bgsync_payload",
          value: JSON.stringify(kvPayload),
        });
      } catch (_) {}
      // Also stage today's full backup JSON (same shape exportAllData()
      // writes to a local file) for the daily Google Drive backup — only
      // if the person has opted in via the Settings toggle. The
      // Background Runner picks this up once a day (its periodicSync
      // interval) and uploads it via the driveBackupUpload Cloud Function
      // — no extra date-gating needed here, the OS-scheduled interval
      // already provides the "once a day" cadence.
      if (App.S.driveBackupDailyEnabled) {
        try {
          await window.Capacitor.Plugins.CapacitorKV.set({
            key: "bgsync_drive_payload",
            value: JSON.stringify(_buildBackupPayload()),
          });
        } catch (_) {}
      }
    }
    // ── Push leaderboard entry if opted in ──
    pushLeaderboard().catch((e) => console.warn('pushLeaderboard (post-tap) error:', e && e.message));
    App.S.syncBaseline = JSON.parse(JSON.stringify(App.S.history || {}));
    App.S.syncBaseline28 = JSON.parse(JSON.stringify(App.S.h28 || {}));
    App.S.syncBaselineTimer = JSON.parse(
      JSON.stringify(App.S.timerHistory || {}),
    );
    App.S.syncBaselineTimer28 = JSON.parse(
      JSON.stringify(App.S.timer28History || {}),
    );
    App._suspendCloudSync = true;
    await App.save();
    App._suspendCloudSync = false;
    setSyncPill("", "☁️ Synced " + new Date().toLocaleTimeString());
  } catch (e) {
    App._suspendCloudSync = false;
    console.warn("Full sync failed:", e.message);
    setSyncPill("error", "Sync failed");
  }
}'''

    new2 = '''  try {
    // A Firestore write can hang indefinitely on a bad connection, just
    // like a read (see fbWithTimeout usage in fbMigrate above) — without a
    // bound here, a stuck write leaves the sync pill on "Syncing…" forever
    // and NEVER reaches the catch block below, so the pending markers never
    // get a chance to trigger a retry either. Bounding it turns a silent
    // hang into a normal, retryable failure.
    await fbWithTimeout(
      fbDb
        .collection("users")
        .doc(fbUser.uid)
        .collection("data")
        .doc("main")
        .set(payload),
      20000,
      "Cloud push",
    );
    // Write CONFIRMED by Firestore — safe to clear both the foreground-only
    // marker and the one shared with the Background Runner, so neither
    // retries something that already landed.
    try { localStorage.removeItem("rjap_sync_pending"); } catch (_e) {}
    try {
      if (window.Capacitor?.Plugins?.CapacitorKV) {
        await window.Capacitor.Plugins.CapacitorKV.set({ key: "bgsync_pending_since", value: "" });
      }
    } catch (_e) {}
    // Stage a plain-JSON copy (minus the serverTimestamp sentinel, which
    // can't be serialized) for the native Background Runner. This is the
    // "last known good" snapshot it will re-push if the app stays closed
    // for a long stretch and this device never got a chance to sync.
    if (window.Capacitor?.Plugins?.CapacitorKV) {
      try {
        const kvPayload = { ...payload };
        delete kvPayload.lastSync; // FieldValue sentinel — not JSON-safe
        await window.Capacitor.Plugins.CapacitorKV.set({
          key: "bgsync_payload",
          value: JSON.stringify(kvPayload),
        });
      } catch (_) {}
      // Also stage today's full backup JSON (same shape exportAllData()
      // writes to a local file) for the daily Google Drive backup — only
      // if the person has opted in via the Settings toggle. The
      // Background Runner picks this up once a day (its periodicSync
      // interval) and uploads it via the driveBackupUpload Cloud Function
      // — no extra date-gating needed here, the OS-scheduled interval
      // already provides the "once a day" cadence.
      if (App.S.driveBackupDailyEnabled) {
        try {
          await window.Capacitor.Plugins.CapacitorKV.set({
            key: "bgsync_drive_payload",
            value: JSON.stringify(_buildBackupPayload()),
          });
        } catch (_) {}
      }
    }
    // ── Push leaderboard entry if opted in ──
    // Only announce this device as "present" on the community board AFTER
    // the authoritative history doc above was actually confirmed — a
    // separate, smaller leaderboard write must never succeed on its own
    // and imply the full sync did too. That mismatch (leaderboard fine,
    // real history doc silently behind) is exactly what made missing days
    // invisible until a device switch.
    pushLeaderboard().catch((e) => console.warn('pushLeaderboard (post-tap) error:', e && e.message));
    App.S.syncBaseline = JSON.parse(JSON.stringify(App.S.history || {}));
    App.S.syncBaseline28 = JSON.parse(JSON.stringify(App.S.h28 || {}));
    App.S.syncBaselineTimer = JSON.parse(
      JSON.stringify(App.S.timerHistory || {}),
    );
    App.S.syncBaselineTimer28 = JSON.parse(
      JSON.stringify(App.S.timer28History || {}),
    );
    App._suspendCloudSync = true;
    await App.save();
    App._suspendCloudSync = false;
    setSyncPill("", "☁️ Synced " + new Date().toLocaleTimeString());
  } catch (e) {
    App._suspendCloudSync = false;
    console.warn("Full sync failed:", e.message);
    // Both pending markers are deliberately left set here — the next
    // successful cloud hydration (_rjapMaybeRetryPendingSync, see
    // fbApplyRemote) and the Background Runner will both keep trying
    // until a push actually succeeds.
    setSyncPill("error", "⚠️ Sync incomplete — will retry");
  }
}'''

    app_src = apply_edit(app_src, old2, new2, "fbPushFull timeout + confirmed-clear (both markers)", APP_JS)

    # ══════════════════════════════════════════════════════
    # app.js — Edit 3: fbApplyRemote() — retry on next cloud hydration,
    # checking BOTH the local marker and the shared CapacitorKV marker
    # (covers a process killed before the local marker was even written).
    # ══════════════════════════════════════════════════════
    old3 = '''  try { populateSettingsUI(); } catch (_e) {}
  setSyncPill("", "🔄 Synced from cloud");
}'''

    new3 = '''  try { populateSettingsUI(); } catch (_e) {}
  setSyncPill("", "🔄 Synced from cloud");
  _rjapMaybeRetryPendingSync();
}

// If a previous session ended (app killed by the OS, connection dropped,
// battery-optimizer suspended the WebView, etc.) before its last change was
// CONFIRMED written to Firestore, a pending marker is still set from that
// session — either in localStorage (this device's own foreground marker)
// or in CapacitorKV (the store shared with the Background Runner, which
// can catch a case even the localStorage marker missed, e.g. the process
// dying before that synchronous line ever ran). Once we're freshly
// connected and cloud-hydrated again, retry immediately instead of
// silently waiting for the next tap — that silent wait is exactly how
// days went missing before.
function _rjapMaybeRetryPendingSync() {
  if (!fbUser || !App._cloudHydrated || App._suspendCloudSync) return;
  if (typeof isGhostMode === "function" && isGhostMode()) return;
  const retry = () => { if (typeof fbPushFull === "function") fbPushFull().catch(() => {}); };
  let localPending = false;
  try { localPending = !!localStorage.getItem("rjap_sync_pending"); } catch (_e) {}
  if (localPending) { retry(); return; }
  if (window.Capacitor?.Plugins?.CapacitorKV) {
    window.Capacitor.Plugins.CapacitorKV.get({ key: "bgsync_pending_since" })
      .then((r) => { if (r && r.value) retry(); })
      .catch(() => {});
  }
}'''

    app_src = apply_edit(app_src, old3, new3, "fbApplyRemote pending-sync retry (both markers)", APP_JS)

    # ══════════════════════════════════════════════════════
    # background/runner.js — Edit 4: one quick in-cycle retry on failure,
    # and clear the shared pending marker once a push is confirmed.
    # ══════════════════════════════════════════════════════
    old4 = '''    const payload = JSON.parse(payloadStr);
    const idToken = await refreshIdToken(refreshToken);
    await pushToFirestore(uid, idToken, payload);

    console.log("Background sync: pushed staged data for", uid);'''

    new4 = '''    const payload = JSON.parse(payloadStr);
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
    await kvSet("bgsync_pending_since", "");'''

    runner_src = apply_edit(runner_src, old4, new4, "periodicSync retry + marker clear", RUNNER_JS)

    print("Backing up current files...")
    with open(APP_JS + ".bak-syncfix-v2", "w", encoding="utf-8") as f:
        f.write(open(APP_JS, "r", encoding="utf-8").read())
    with open(RUNNER_JS + ".bak-syncfix-v2", "w", encoding="utf-8") as f:
        f.write(open(RUNNER_JS, "r", encoding="utf-8").read())

    with open(APP_JS, "w", encoding="utf-8") as f:
        f.write(app_src)
    with open(RUNNER_JS, "w", encoding="utf-8") as f:
        f.write(runner_src)

    print("All 4 edits applied successfully (3 in app.js, 1 in background/runner.js).")
    print()
    print("Next steps:")
    print("  bash setup-www.sh      # regenerate www/ from the patched root files")
    print("  npx cap sync android   # push the change into the Android project")
    print()
    print("What changed, in one line each:")
    print("  1. A pending-sync marker + fresh Background Runner snapshot are now")
    print("     staged the MOMENT a save happens (throttled ~1/sec), not 3s later.")
    print("  2. That marker now lives in CapacitorKV too (shared with the Runner),")
    print("     not just localStorage — so even a near-instant kill leaves a trace.")
    print("  3. The Firestore write itself times out after 20s instead of being")
    print("     able to hang the sync pill on 'Syncing…' forever.")
    print("  4. The Background Runner gets one quick in-cycle retry on failure, and")
    print("     clears the shared marker on success so the app won't double-push.")
    print("  5. Any leftover pending marker triggers an immediate retry the next")
    print("     time the app successfully connects and hydrates from the cloud.")


if __name__ == "__main__":
    main()
