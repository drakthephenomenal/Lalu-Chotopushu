#!/usr/bin/env python3
"""
Hydration retry-ladder fix — fbMigrate()'s initial cloud pull currently
gets exactly ONE fixed 15-second server attempt before falling back to
cache (see fbWithTimeout(docRef.get({ source: "server" }), 15000, "Cloud
pull")). Unlike fbPushFull (the write side), it never got the
connection-aware, multi-attempt retry ladder (_fbSyncLadderForConnection
+ fbCloudPushWithRetryLadder).

WHY THIS MATTERS: pushLeaderboard() (and other push-triggering code)
refuses to run at all until App._cloudHydrated is true. If the one-shot
server pull fails or times out on a slow/flaky connection, hydration
falls through to the cache-fallback path — which is correct for
avoiding data loss, but the flag doesn't necessarily land in a fully
"confirmed fresh" state on the first try the way a retried attempt
would, and every one of those attempts was spending its ENTIRE budget
on one shot instead of retrying like the push side does. This patch
brings the initial pull up to the same standard: several attempts with
connection-aware timeouts and backoff, using fbCloudPushWithRetryLadder
(which despite its name just wraps any promise-returning function —
reads included — in the same retry logic).

IMPORTANT — behavior preserved exactly as before, only HOW we get the
initial `snap` changes:
  - The existing cache-fallback path (triggered only after ALL retry
    attempts are exhausted, not after one failure) is untouched.
  - The "cache miss is not proof there's no cloud doc" safety logic is
    untouched.
  - The browser-reset second-fetch-after-delay logic further down is
    untouched.
  - The "Cloud pull retry" fetch (a separate, later fetch used
    specifically for the browser-reset-detection scenario) is
    deliberately NOT touched by this patch — it already has its own
    2-second deliberate delay built around it for a different reason,
    and touching it isn't necessary to fix the leaderboard-hydration
    problem this patch targets.

USAGE (run from repo root, or from www/):
    python3 apply_hydration_retry_ladder_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-hydration suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "hydration retry-ladder fix"


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

    if "fbCloudPushWithRetryLadder" not in src:
        die("fbCloudPushWithRetryLadder not found in app.js — this patch depends on it already existing. No changes made.")

    # Match on the call expression itself, not full lines — avoids any
    # risk of an indentation/whitespace mismatch breaking the match.
    # The "Cloud pull" label (not "Cloud pull retry") makes this unique.
    old_call = 'fbWithTimeout(docRef.get({ source: "server" }), 15000, "Cloud pull")'

    new_call = (
        '/* hydration retry-ladder fix — was a single fixed 15s attempt; '
        'now gets the same connection-aware retries fbPushFull uses, so '
        'App._cloudHydrated is far less likely to stay unset on a slow/'
        'flaky connection, which was silently blocking pushLeaderboard() '
        'and other hydration-gated pushes from ever running that session. */ '
        'fbCloudPushWithRetryLadder(() => docRef.get({ source: "server" }), "Cloud pull")'
    )

    count = src.count(old_call)
    if count != 1:
        die(
            f"Expected exactly 1 occurrence of the initial 'Cloud pull' server fetch, "
            f"found {count} — app.js may already differ from what this script expects. "
            f"No changes made."
        )
    src = src.replace(old_call, new_call, 1)

    backup_path = path + ".bak-hydration"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Hydration retry-ladder fix applied. Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
