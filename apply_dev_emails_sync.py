#!/usr/bin/env python3
"""
Sync DEV_EMAILS (server-side) with DEV_IDS (client-side).

WHY: app.js's DEV_IDS (controls whether the Developer Settings panel is
even shown) and functions/index.js's DEV_EMAILS (controls whether the
sendBroadcastNotification Cloud Function actually lets the call through)
had drifted out of sync — two emails were missing from the server list.
Result: those accounts could see the "Send Push to All Users" button and
tap it, but the Cloud Function rejected them with permission-denied
("Broadcast failed — check console"), since the server-side check is a
separate hardcoded list Cloud Functions can't read app.js's copy of.

FIX: adds the two missing emails to DEV_EMAILS so it exactly matches
DEV_IDS. Any developer account that can see the button can now also use
it — and broadcasts already reach every opted-in user regardless of dev
status, so no separate fix was needed there.

USAGE (run from repo root, where functions/index.js lives):
    python3 apply_dev_emails_sync.py
Then redeploy:
    firebase deploy --only functions:sendBroadcastNotification

Safe to re-run: detects if already applied and exits without touching
files again. Backs up functions/index.js with a .bak-devsync suffix.
"""
import os
import sys

TARGET = "functions/index.js"


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def find_file():
    for candidate in (TARGET, os.path.join("..", TARGET), "index.js"):
        if os.path.isfile(candidate):
            return candidate
    die(f"Could not find {TARGET} (or index.js) in the current directory or .. — run this from your repo root (where the functions/ folder lives).")


def main():
    path = find_file()
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if "radhanamejapcounter@gmail.com" in src and "drakthephenomenal@icloud.com" in src:
        print(f"[{path}] Already applied — nothing to do.")
        return

    old_block = """const DEV_EMAILS = [
  "drakthephenomenal@gmail.com",
  "akthephenomenal@zohomail.com",
  "drakthephenomenal@proton.me",
  "anupkumarpaulshuvo@gmail.com",
];"""

    new_block = """const DEV_EMAILS = [
  "drakthephenomenal@gmail.com",
  "akthephenomenal@zohomail.com",
  "drakthephenomenal@proton.me",
  "anupkumarpaulshuvo@gmail.com",
  "radhanamejapcounter@gmail.com",
  "drakthephenomenal@icloud.com",
];"""

    if src.count(old_block) != 1:
        die(
            f"Expected exactly 1 occurrence of the DEV_EMAILS block, found "
            f"{src.count(old_block)} — functions/index.js may already differ "
            f"from what this script expects. No changes made."
        )
    src = src.replace(old_block, new_block, 1)

    backup_path = path + ".bak-devsync"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] DEV_EMAILS synced with client-side DEV_IDS. Backup saved to {backup_path}")
    print("Now redeploy: firebase deploy --only functions:sendBroadcastNotification")


if __name__ == "__main__":
    main()
