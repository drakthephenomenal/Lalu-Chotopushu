#!/usr/bin/env python3
"""
Ghost mode fixes — two related, confirmed bugs in the developer Ghost
Mode workflow (viewing/correcting/restoring another user's account):

BUG 1 — "users' data leaks into my profile":
devEnterGhostMode() ALWAYS overwrites _ghostOwnState (the developer's
own saved data, to be restored on exit) from whatever is CURRENTLY in
App.S — with no check for whether ghost mode is already active. If a
developer switches directly from viewing User A to viewing User B
(without exiting in between), this captures User A's data as if it
were "the developer's own state," permanently losing the real
snapshot. When ghost mode is eventually exited, the developer's
account gets restored to that WRONG snapshot (User A's data) — and
fbMigrate's "keep whichever is higher" offline-work-preservation merge
logic then treats those numbers as legitimate local progress and
blends them into the developer's real Firestore document. That's the
leak.
FIX: only capture _ghostOwnState when NOT already in ghost mode.
Switching between viewed users mid-session now correctly leaves the
one true "developer's own data" snapshot untouched.

BUG 2 — "restore doesn't reach the user's phone":
fbPushToUid(uid, fullReplace=true) correctly overwrites the TARGET
user's Firestore document with no merge — so the restore genuinely
lands on the server. But the target's OWN device, on its next normal
hydration (fbMigrate), runs its own "keep whichever is higher, local
offline work wins" merge logic — comparing the restored (often older/
lower) values against whatever's already in that device's local
cache, and keeping the higher local numbers. From the user's
perspective the restore silently never took effect, even though it
genuinely landed on the server.
FIX: fbPushToUid now stamps a devForceRestoreAt timestamp onto the
payload whenever fullReplace is true. The target device's fbMigrate,
on its next hydration, checks for this timestamp — if it's newer than
one already acknowledged locally, it skips the offline-preservation
merge for that ONE hydration only (so the developer's restore is
applied as-is), then records it as acknowledged so normal protective
merge behavior resumes for every hydration after that. Self-expiring,
no follow-up write needed.

USAGE (run from repo root, or from www/):
    python3 apply_ghost_mode_fixes.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-ghostfix suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "ghost mode fixes: own-state capture guard + force-restore signal"


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

    # ── Fix 1: only capture _ghostOwnState when not already ghosting ──
    old_capture = """  // 2. Save the developer's own clean state
  _ghostOwnState = JSON.parse(JSON.stringify(App.S));

  // 3. Prevent ALL writes while in ghost mode
  _ghostViewingUid = uid;"""

    new_capture = """  // 2. Save the developer's own clean state — ONLY if not already
  // ghosting someone else. ghost mode fixes: own-state capture guard +
  // force-restore signal — switching directly between two viewed users
  // without exiting in between used to overwrite this snapshot with
  // the FIRST viewed user's data instead of the developer's real data,
  // which then got merged into the developer's own profile on exit.
  if (!isGhostMode()) {
    _ghostOwnState = JSON.parse(JSON.stringify(App.S));
  }

  // 3. Prevent ALL writes while in ghost mode
  _ghostViewingUid = uid;"""

    if src.count(old_capture) != 1:
        die(
            f"Expected exactly 1 occurrence of the _ghostOwnState capture block, "
            f"found {src.count(old_capture)} — app.js may already differ from what "
            f"this script expects. No changes made."
        )
    src = src.replace(old_capture, new_capture, 1)

    # ── Fix 2a: stamp devForceRestoreAt when fullReplace on the target write ──
    old_stamp = """    lastDevEdit: firebase.firestore.FieldValue.serverTimestamp(),
    lastDevEditBy: (fbUser && fbUser.email) || "developer",
  };
  try {"""

    new_stamp = """    lastDevEdit: firebase.firestore.FieldValue.serverTimestamp(),
    lastDevEditBy: (fbUser && fbUser.email) || "developer",
  };
  // ghost mode fixes: force-restore signal — on a full restore, stamp a
  // timestamp the TARGET device's fbMigrate will recognize and use to
  // skip its own offline-preservation merge for one hydration, so the
  // restore actually takes effect instead of being silently overridden
  // by that device's own (by-design) "keep higher local value" logic.
  if (fullReplace) {
    payload.devForceRestoreAt = Date.now();
  }
  try {"""

    if src.count(old_stamp) != 1:
        die(
            f"Expected exactly 1 occurrence of the fbPushToUid payload-close block, "
            f"found {src.count(old_stamp)} — app.js may already differ from what this "
            f"script expects. No changes made (Fix 1 above was still applied)."
        )
    src = src.replace(old_stamp, new_stamp, 1)

    # ── Fix 2b: fbMigrate skips offline-preservation merge when a newer force-restore signal is present ──
    old_merge_start = """      // Cloud data exists — apply it (overrides local cache)
      fbApplyRemote({ ...snap.data(), deviceId: null });
      App._cloudHydrated = true; // cloud copy applied, future saves may push

      // ── MERGE: for each date key, keep whichever is higher (local offline wins) ──
      let offlineWorkFound = false;
      function mergeMax(local, applied) {
        for (const k in local) {
          if ((local[k] || 0) > (applied[k] || 0)) {
            applied[k] = local[k];
            offlineWorkFound = true;
          }
        }
      }
      mergeMax(localHistory,        App.S.history);
      mergeMax(localH28,            App.S.h28);
      mergeMax(localTimerHistory,   App.S.timerHistory);
      mergeMax(localHistoryRV,      App.S.historyRV);
      mergeMax(localHistoryHK,      App.S.historyHK);
      mergeMax(localHistoryKV,      App.S.historyKV);
      mergeMax(localHistorySS,      App.S.historySS);
      mergeMax(localHistoryRam,     App.S.historyRam);
      mergeMax(localTimerHistoryRV, App.S.timerHistoryRV);
      mergeMax(localTimerHistoryHK, App.S.timerHistoryHK);
      mergeMax(localTimerHistoryKV, App.S.timerHistoryKV);
      mergeMax(localTimerHistorySS, App.S.timerHistorySS);
      mergeMax(localTimerHistoryRam, App.S.timerHistoryRam);
      // Also preserve higher dt (lifetime jap seconds) if local is ahead
      if (localDt   > App.S.dt)   { App.S.dt   = localDt;   offlineWorkFound = true; }
      if (localDtRV > App.S.dtRV) { App.S.dtRV = localDtRV; offlineWorkFound = true; }
      if (localDtHK > App.S.dtHK) { App.S.dtHK = localDtHK; offlineWorkFound = true; }
      if (localDtKV > App.S.dtKV) { App.S.dtKV = localDtKV; offlineWorkFound = true; }
      if (localDtSS > App.S.dtSS) { App.S.dtSS = localDtSS; offlineWorkFound = true; }
      if (localDtRam > App.S.dtRam) { App.S.dtRam = localDtRam; offlineWorkFound = true; }

      if (offlineWorkFound) {"""

    new_merge_start = """      // Cloud data exists — apply it (overrides local cache)
      fbApplyRemote({ ...snap.data(), deviceId: null });
      App._cloudHydrated = true; // cloud copy applied, future saves may push

      // ghost mode fixes: force-restore signal — if a developer force-
      // restored this account (via Ghost Mode) more recently than this
      // device has already acknowledged, skip the offline-preservation
      // merge below for this ONE hydration so the restore actually
      // takes effect. Self-expiring: normal protective merge behavior
      // resumes on every hydration after this one.
      const _forceRestoreAt = App.S.devForceRestoreAt || 0;
      const _alreadyAckedRestore = App.S._lastAckedRestoreAt || 0;
      const _skipOfflineMerge = _forceRestoreAt > _alreadyAckedRestore;
      if (_skipOfflineMerge) {
        App.S._lastAckedRestoreAt = _forceRestoreAt;
      }

      // ── MERGE: for each date key, keep whichever is higher (local offline wins) ──
      let offlineWorkFound = false;
      function mergeMax(local, applied) {
        for (const k in local) {
          if ((local[k] || 0) > (applied[k] || 0)) {
            applied[k] = local[k];
            offlineWorkFound = true;
          }
        }
      }
      if (!_skipOfflineMerge) {
        mergeMax(localHistory,        App.S.history);
        mergeMax(localH28,            App.S.h28);
        mergeMax(localTimerHistory,   App.S.timerHistory);
        mergeMax(localHistoryRV,      App.S.historyRV);
        mergeMax(localHistoryHK,      App.S.historyHK);
        mergeMax(localHistoryKV,      App.S.historyKV);
        mergeMax(localHistorySS,      App.S.historySS);
        mergeMax(localHistoryRam,     App.S.historyRam);
        mergeMax(localTimerHistoryRV, App.S.timerHistoryRV);
        mergeMax(localTimerHistoryHK, App.S.timerHistoryHK);
        mergeMax(localTimerHistoryKV, App.S.timerHistoryKV);
        mergeMax(localTimerHistorySS, App.S.timerHistorySS);
        mergeMax(localTimerHistoryRam, App.S.timerHistoryRam);
        // Also preserve higher dt (lifetime jap seconds) if local is ahead
        if (localDt   > App.S.dt)   { App.S.dt   = localDt;   offlineWorkFound = true; }
        if (localDtRV > App.S.dtRV) { App.S.dtRV = localDtRV; offlineWorkFound = true; }
        if (localDtHK > App.S.dtHK) { App.S.dtHK = localDtHK; offlineWorkFound = true; }
        if (localDtKV > App.S.dtKV) { App.S.dtKV = localDtKV; offlineWorkFound = true; }
        if (localDtSS > App.S.dtSS) { App.S.dtSS = localDtSS; offlineWorkFound = true; }
        if (localDtRam > App.S.dtRam) { App.S.dtRam = localDtRam; offlineWorkFound = true; }
      }

      if (offlineWorkFound) {"""

    if src.count(old_merge_start) != 1:
        die(
            f"Expected exactly 1 occurrence of the fbMigrate offline-preservation merge "
            f"block, found {src.count(old_merge_start)} — app.js may already differ from "
            f"what this script expects. No changes made (Fixes 1 and 2a above were still "
            f"applied)."
        )
    src = src.replace(old_merge_start, new_merge_start, 1)

    # Marker for idempotency — placed as a standalone comment near the top
    # of the merge block additions rather than requiring a separate write.
    src = src.replace(
        "// ghost mode fixes: force-restore signal — if a developer force-",
        "// ghost mode fixes: own-state capture guard + force-restore signal — if a developer force-",
        1,
    )

    backup_path = path + ".bak-ghostfix"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Ghost mode fixes applied (own-state capture guard + force-restore signal). Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
