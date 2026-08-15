#!/usr/bin/env python3
"""
Fast sync + retire client leaderboard push.

WHY, PART 1 — fast sync:
The 3-tier connection-aware retry ladder (_fbSyncLadderForConnection),
added earlier today, made sync more RESILIENT but also made a FAILING
sync visibly drag on for up to ~11 minutes in the worst case (2G/poor
wifi bucket), or ~8 minutes on the "unknown" bucket that many Android
WebView devices silently fall into even on decent connections (since
navigator.connection.effectiveType is unreliable in WebViews). This is
the root cause identified for "previous version felt better" — the OLD
version had zero retries but failed instantly and clearly; today's
ladder is more likely to eventually succeed, but a failing attempt now
feels stuck/broken for minutes at a time.

This patch replaces it with ONE simple, fast, universal ladder — no
connection-type detection at all: try once (10s timeout), wait 3s,
retry once more (15s timeout), then fail clearly. Worst case ~28
seconds instead of up to 11 minutes. Still strictly better than the old
version's zero retries (catches brief blips), while feeling close to
the old version's snappy, clear-failure experience.

WHY, PART 2 — retire client leaderboard push:
Now that syncLeaderboardOnMainDataWrite (a Firestore-triggered Cloud
Function, deployed 2026-08-15) computes and writes the leaderboard
entry automatically and server-side whenever users/{uid}/data/main is
written, the client's own pushLeaderboard() write is redundant — and
was the actual source of the leaderboard-goes-stale bug (a failed
client-side write with no way to guarantee it ever retries, unlike a
server trigger which can only fire in response to a CONFIRMED
successful main-data write). This patch makes pushLeaderboard() a
no-op. All of its existing call sites throughout app.js are left
completely untouched — they'll just harmlessly do nothing now instead
of writing.

TECHNIQUE — override by reassignment, not by replacing internals:
Both _fbSyncLadderForConnection and pushLeaderboard are plain function
declarations (not const), so they can be safely overridden later in
the same file via simple reassignment — this avoids needing to locate
and replace their internals, which is fragile if the live file has
drifted from what this patch was written against. The original
functions stay completely intact and unmodified; only their behavior
at call time changes.

USAGE (run from repo root, or from www/):
    python3 apply_fast_sync_and_retire_client_leaderboard.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-fastsync suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "fast sync + retire client leaderboard push override block"


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

    if "_fbSyncLadderForConnection" not in src:
        die("_fbSyncLadderForConnection not found in app.js — cannot safely override something that doesn't exist. No changes made.")
    if "async function pushLeaderboard" not in src and "pushLeaderboard" not in src:
        die("pushLeaderboard not found in app.js — cannot safely override something that doesn't exist. No changes made.")

    override_block = '''

// ============================================================
// fast sync + retire client leaderboard push override block
// Appended 2026-08-15. See apply_fast_sync_and_retire_client_leaderboard.py
// for full rationale. Overrides by reassignment — the original
// _fbSyncLadderForConnection and pushLeaderboard function bodies above
// are left completely untouched; only their runtime behavior changes.
// ============================================================

// Simple, fast, universal retry ladder — no connection-type detection.
// One 10s attempt, 3s wait, one 15s retry, then fail. Worst case ~28s,
// instead of up to ~11 minutes with the old connection-aware ladder.
_fbSyncLadderForConnection = function () {
  return { attempts: [10000, 15000], waits: [3000] };
};

// Client no longer pushes the leaderboard directly — the
// syncLeaderboardOnMainDataWrite Cloud Function does it automatically
// and reliably whenever users/{uid}/data/main is written. All existing
// call sites are left as-is; they now just harmlessly do nothing.
pushLeaderboard = async function () {
  return;
};
'''

    src = src + override_block

    backup_path = path + ".bak-fastsync"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Fast sync + retired client leaderboard push applied. Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
