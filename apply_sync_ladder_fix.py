#!/usr/bin/env python3
"""
Sync ladder fix — fixes the single-shot "4g" bucket and lengthens every
timeout/attempt-count in the cloud push retry ladder.

ROOT CAUSE FIXED:
  navigator.connection.effectiveType is a MEASURED-throughput label, not a
  radio-type guarantee. A congested WiFi or weak cell connection can still
  report "4g" while behaving like a poor connection. Previously, "4g" got
  exactly ONE 25s attempt with no retry at all — the worst-covered bucket,
  on exactly the connections most likely to need a retry.

CHANGES:
  - "4g" merged into the same ladder as "3g"/unknown/iOS (no more single
    unrecoverable attempt).
  - Every bucket's per-attempt timeout and inter-attempt wait increased,
    so a slow-but-working connection has more real time to land the sync
    before the ladder gives up.

  Old:
    2g/slow-2g → 4 attempts: 20s, 35s, 60s, 90s   (waits: 3s, 5s, 8s)
    3g/unknown/iOS → 3 attempts: 25s, 45s, 70s     (waits: 3s, 5s)
    4g → 1 attempt: 25s, NO retry

  New:
    2g/slow-2g → 5 attempts: 30s, 50s, 80s, 110s, 140s  (waits: 5s, 8s, 10s, 12s)
    3g/4g/unknown/iOS → 4 attempts: 35s, 60s, 90s, 120s (waits: 5s, 8s, 10s)

USAGE (run from your repo root, or the www/ folder if app.js lives there):
    python3 apply_sync_ladder_fix.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js -> app.js.bak-syncladderfix first.
"""
import os
import sys

APP_JS = "app.js"

OLD_LADDER = '''  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return { attempts: [20000, 35000, 60000, 90000], waits: [3000, 5000, 8000] };
  }
  if (effectiveType === "4g") {
    return { attempts: [25000], waits: [] };
  }
  // "3g", unknown effectiveType, or no navigator.connection support (iOS).
  return { attempts: [25000, 45000, 70000], waits: [3000, 5000] };'''

NEW_LADDER = '''  // v2: lengthened every bucket's timeouts, and merged "4g" into the same
  // ladder as "3g"/unknown/iOS. effectiveType is a measured-throughput
  // label, not a radio-type guarantee, so a congested/lossy connection can
  // still report "4g" — it must not get only one unrecoverable attempt.
  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return { attempts: [30000, 50000, 80000, 110000, 140000], waits: [5000, 8000, 10000, 12000] };
  }
  // "3g", "4g", unknown effectiveType, or no navigator.connection support (iOS).
  return { attempts: [35000, 60000, 90000, 120000], waits: [5000, 8000, 10000] };'''

MARKER = "// v2: lengthened every bucket's timeouts"


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def find_app_js():
    if os.path.isfile(APP_JS):
        return APP_JS
    candidate = os.path.join("www", APP_JS)
    if os.path.isfile(candidate):
        return candidate
    die("Could not find app.js in the current directory or ./www — run this from your repo root.")


def main():
    path = find_app_js()
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        print(f"[{path}] Already applied — nothing to do.")
        return

    count = src.count(OLD_LADDER)
    if count == 0:
        die(
            f"[{path}] Anchor for the ladder function not found. This file may "
            "differ from the version this patch was written against — "
            "aborting without changing anything."
        )
    if count > 1:
        die(f"[{path}] Anchor appears {count} times (expected exactly 1) — aborting.")

    backup_path = path + ".bak-syncladderfix"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"Backed up {path} -> {backup_path}")

    patched = src.replace(OLD_LADDER, NEW_LADDER, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(patched)

    print(f"[{path}] Patched _fbSyncLadderForConnection() successfully.")
    print("Done. Review the diff, then run your usual build/sync steps.")


if __name__ == "__main__":
    main()
