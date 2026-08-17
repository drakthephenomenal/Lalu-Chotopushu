#!/usr/bin/env python3
"""
Broadcast notification — full heads-up/sound/vibration fix.

WHY: sendBroadcastNotification currently sends a bare FCM payload —
just { title, body } with no channelId, priority, or sound specified
at the Android/FCM level. Without that, Android routes it through a
generic default channel rather than the app's own properly-configured
"rjap_reminders_v2" channel (importance: max, vibration: true, custom
sound: "reminder_tone") — meaning broadcasts typically show up as a
quiet shade-only notification with no heads-up popup, sound, or
vibration, instead of the prominent GP-style alert the developer wants.

FIX: adds the android-specific payload block, explicitly targeting the
existing channel and requesting high priority + the channel's sound,
so a broadcast actually gets full heads-up + sound + vibration
treatment consistent with how reminder notifications already behave.

USAGE (run from wherever functions/index.js lives, e.g. repo root):
    python3 apply_broadcast_notification_channel_fix.py
Then redeploy:
    firebase deploy --only functions:sendBroadcastNotification

Safe to re-run: detects if already applied and exits without touching
files again. Backs up functions/index.js with a .bak-broadcastchannel
suffix.
"""
import os
import sys

TARGET = "functions/index.js"
MARKER = "broadcast notification channel fix"


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

    if MARKER in src:
        print(f"[{path}] Already applied — nothing to do.")
        return

    old_call = """    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });"""

    new_call = """    // broadcast notification channel fix — without explicitly targeting
    // the app's own notification channel here, Android routes this
    // through a generic default channel instead of "rjap_reminders_v2"
    // (importance: max, vibration: true, custom sound), so broadcasts
    // used to show up as a quiet shade-only entry with no heads-up
    // popup, sound, or vibration.
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      android: {
        priority: "high",
        notification: {
          channelId: "rjap_reminders_v2",
          sound: "reminder_tone",
          priority: "max",
          visibility: "public",
        },
      },
    });"""

    if src.count(old_call) != 1:
        die(
            f"Expected exactly 1 occurrence of the sendEachForMulticast call, "
            f"found {src.count(old_call)} — the deployed function's source may "
            f"already differ from what this script expects. No changes made."
        )
    src = src.replace(old_call, new_call, 1)

    backup_path = path + ".bak-broadcastchannel"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Broadcast notification channel fix applied. Backup saved to {backup_path}")
    print("Now redeploy: firebase deploy --only functions:sendBroadcastNotification")


if __name__ == "__main__":
    main()
