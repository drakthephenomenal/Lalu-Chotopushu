#!/usr/bin/env python3
"""
Presence heartbeat retry fix — _writePresenceHeartbeat() (the write
responsible for the leaderboard's green "online" dot) is currently a
bare Firestore .set() wrapped in `catch (_e) {}` — no timeout, no
retry, every error silently swallowed. This is the exact same
unprotected pattern pushLeaderboard() had before apply_leaderboard_retry_fix.py.

WHY THIS MATTERS: the green dot depends on `lastSeen` staying within a
2-minute freshness window, refreshed by a heartbeat every 60s (or on
app foreground). If a single heartbeat write fails silently on a
flaky/slow connection — the same class of connection trouble this
whole day's worth of patches has been chasing — the user's presence
doc goes stale and they lose their green dot, even though the app is
genuinely open. This patch wraps the write in the same
fbCloudPushWithRetryLadder used for leaderboard and main sync, so a
transient failure gets retried instead of silently giving up.

REQUIRES: fbCloudPushWithRetryLadder must already exist in app.js
(added by apply_sync_diagnostics.py's era of patches / already present
in the base app).

USAGE (run from repo root, or from www/):
    python3 apply_presence_heartbeat_retry_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-presence suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "presence heartbeat retry ladder"


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

    # Matches on the write call + its immediate catch, not the whole
    # surrounding function — narrower target, less risk of a whitespace
    # mismatch against the live file.
    old_write = """              await fbDb.collection('presence').doc(user.uid).set({
                uid: user.uid,
                name: _pName,
                email: _pEmail,
                phone: _pPhone,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
            } catch (_e) {}"""

    new_write = """              // presence heartbeat retry ladder — was a bare .set() with all
              // errors silently swallowed, same unprotected pattern the
              // leaderboard write had before its own retry fix. A single
              // failed heartbeat on a flaky connection used to just let the
              // green "online" dot go stale with no retry; now it gets the
              // same bounded timeout + backoff retries as leaderboard/main
              // sync writes.
              await fbCloudPushWithRetryLadder(
                () => fbDb.collection('presence').doc(user.uid).set({
                  uid: user.uid,
                  name: _pName,
                  email: _pEmail,
                  phone: _pPhone,
                  lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true }),
                "Presence heartbeat",
              );
            } catch (_e) {}"""

    count = src.count(old_write)
    if count != 1:
        die(
            f"Expected exactly 1 occurrence of the presence heartbeat write, "
            f"found {count} — app.js may already differ from what this script "
            f"expects. No changes made."
        )
    src = src.replace(old_write, new_write, 1)

    backup_path = path + ".bak-presence"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Presence heartbeat retry fix applied. Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
