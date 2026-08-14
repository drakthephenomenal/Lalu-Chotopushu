#!/usr/bin/env python3
"""
Leaderboard retry fix — wraps pushLeaderboard()'s Firestore write in the
same connection-aware retry ladder (fbCloudPushWithRetryLadder) that the
main jap-data sync (fbPushFull) already uses, instead of a single unbounded
attempt with no timeout and no retry.

WHY: pushLeaderboard() currently does a bare `.set(payload)` with no
timeout and no retry — on a slow/flaky connection it just fails once,
logs a console warning, and gives up silently. There's no user-visible
error and no automatic retry, unlike the main sync path. This brings it
up to the same reliability standard.

Also logs each leaderboard push attempt through the existing
_syncDiagRecord() diagnostic trail (added by apply_sync_diagnostics.py)
under label "Leaderboard push", so leaderboard failures show up in the
same users/{uid}/data/syncDiag rolling log as main sync attempts.

REQUIRES: apply_sync_diagnostics.py must already be applied (this patch
depends on _syncDiagRecord and fbCloudPushWithRetryLadder existing in
app.js). If it isn't, this script will fail its marker check and tell you.

USAGE (run from repo root, or from www/):
    python3 apply_leaderboard_retry_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-lbretry suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "Leaderboard push retry ladder"


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

    if "_syncDiagRecord" not in src or "fbCloudPushWithRetryLadder" not in src:
        die(
            "This patch depends on apply_sync_diagnostics.py already being applied "
            "(needs _syncDiagRecord and fbCloudPushWithRetryLadder in app.js), but "
            "one or both weren't found. Run apply_sync_diagnostics.py first."
        )

    old_push = """  try {
    await fbDb.collection('leaderboard').doc(fbUser.uid).set(payload);
  } catch(e) {
    console.warn('pushLeaderboard error:', e.message);
  }
}"""

    new_push = """  // Leaderboard push retry ladder — same reliability treatment as the
  // main sync write (fbPushFull), instead of one unbounded, unretried
  // attempt. A slow/flaky connection used to just fail this silently;
  // now it gets the same bounded timeout + backoff retries.
  try {
    await fbCloudPushWithRetryLadder(
      () => fbDb.collection('leaderboard').doc(fbUser.uid).set(payload),
      "Leaderboard push",
    );
  } catch(e) {
    console.warn('pushLeaderboard error:', e && e.message ? e.message : e);
  }
}"""

    if old_push not in src:
        die("Could not find pushLeaderboard's write call in the expected form — app.js may already differ from what this script expects. No changes made.")
    src = src.replace(old_push, new_push, 1)

    backup_path = path + ".bak-lbretry"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Leaderboard retry fix applied. Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
