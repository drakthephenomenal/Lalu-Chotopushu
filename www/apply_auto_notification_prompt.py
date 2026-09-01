#!/usr/bin/env python3
"""
Auto notification permission prompt.

WHAT IT DOES: on first login/sync where a user has never been asked
before, the app automatically triggers the same permission request the
manual "Push notifications" toggle uses — no need to find it in Settings.
Grants and denials are both remembered (only ever asks once), and the
toggle's own UI (#tgPushNotifications / #pushNotificationsStatus) stays
in sync either way — including if the user later flips the toggle
manually, which now also marks the "asked" flag so a manual disable
doesn't get silently re-prompted on the next login.

Two edits to app.js:
  1. The onAuthStateChanged handler's existing "re-register push if
     previously opted in" block gains an else-branch: if never asked,
     ask now (marking rjap_push_asked BEFORE the async call resolves, so
     closing the app mid-request still counts as "asked").
  2. The manual "pushNotifications" toggle handler (both the enable and
     disable branches) now also sets rjap_push_asked, so manual action
     is never second-guessed by the auto-prompt on a later login.

USAGE (run from repo root, where app.js lives):
    python3 apply_auto_notification_prompt.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-autoprompt suffix.
"""
import os
import sys

TARGET = "app.js"
MARKER = "auto notification prompt"


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def find_file():
    for candidate in (TARGET, os.path.join("..", TARGET)):
        if os.path.isfile(candidate):
            return candidate
    die(f"Could not find {TARGET} in the current directory or .. — run this from your repo root (where app.js lives).")


def main():
    path = find_file()
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        print(f"[{path}] Already applied — nothing to do.")
        return

    # --- Edit 1: auth-state-change auto-prompt ---
    old_auth_block = """      // Re-register push (refresh the FCM token) if the user previously
      // opted in — no permission re-prompt since it was already granted.
      if (user) {
        let pushOn = false;
        try { pushOn = localStorage.getItem("rjap_push_enabled") === "1"; } catch (_) {}
        const tgPushEl = document.getElementById("tgPushNotifications");
        const pushStatusEl = document.getElementById("pushNotificationsStatus");
        if (pushOn) {
          lcRegisterPush().then((ok) => {
            if (ok) {
              if (tgPushEl) tgPushEl.classList.add("on");
              if (pushStatusEl) pushStatusEl.textContent = "✅ Push notifications enabled";
            }
          });
        }
      }"""

    new_auth_block = """      // Re-register push (refresh the FCM token) if the user previously
      // opted in — no permission re-prompt since it was already granted.
      // auto notification prompt — first-ever login/sync for a user who has
      // never been asked triggers the SAME permission request the manual
      // "pushNotifications" toggle uses (no need to find it in Settings).
      // rjap_push_asked is set before the request resolves, so a grant AND
      // a denial are both remembered — this only ever asks once — and the
      // toggle's own UI (#tgPushNotifications / #pushNotificationsStatus)
      // is kept in sync either way.
      if (user) {
        let pushOn = false;
        let pushAsked = false;
        try { pushOn = localStorage.getItem("rjap_push_enabled") === "1"; } catch (_) {}
        try { pushAsked = localStorage.getItem("rjap_push_asked") === "1"; } catch (_) {}
        const tgPushEl = document.getElementById("tgPushNotifications");
        const pushStatusEl = document.getElementById("pushNotificationsStatus");
        if (pushOn) {
          lcRegisterPush().then((ok) => {
            if (ok) {
              if (tgPushEl) tgPushEl.classList.add("on");
              if (pushStatusEl) pushStatusEl.textContent = "✅ Push notifications enabled";
            }
          });
        } else if (!pushAsked) {
          try { localStorage.setItem("rjap_push_asked", "1"); } catch (_) {}
          lcRegisterPush().then((ok) => {
            if (ok) {
              if (tgPushEl) tgPushEl.classList.add("on");
              if (pushStatusEl) pushStatusEl.textContent = "✅ Push notifications enabled";
            } else {
              if (tgPushEl) tgPushEl.classList.remove("on");
              if (pushStatusEl) pushStatusEl.textContent = "— Tap toggle to enable push notifications 🔔";
            }
          });
        }
      }"""

    if src.count(old_auth_block) != 1:
        die(
            f"Edit 1: expected exactly 1 occurrence of the auth-state-change "
            f"push block, found {src.count(old_auth_block)} — app.js may "
            f"already differ from what this script expects. No changes made."
        )

    # --- Edit 2: manual toggle handler also marks "asked" ---
    old_toggle_block = """      lcRegisterPush().then((ok) => {
        if (ok) {
          if (tgPush) tgPush.classList.add("on");
          if (statusEl) statusEl.textContent = "✅ Push notifications enabled";
          toast("🔔 Push notifications enabled");
        } else {
          if (statusEl) statusEl.textContent = "⚠️ Could not enable — check notification permission.";
          toast("⚠️ Could not enable push notifications");
        }
      });
    } else {
      lcUnregisterPush();
      if (tgPush) tgPush.classList.remove("on");
      if (statusEl) statusEl.textContent = "— Tap to receive announcements from Radha Naam Jap 🔔 (requires sign-in)";
      toast("🔕 Push notifications turned off");
    }
    return;
  }"""

    new_toggle_block = """      try { localStorage.setItem("rjap_push_asked", "1"); } catch (_) {}
      lcRegisterPush().then((ok) => {
        if (ok) {
          if (tgPush) tgPush.classList.add("on");
          if (statusEl) statusEl.textContent = "✅ Push notifications enabled";
          toast("🔔 Push notifications enabled");
        } else {
          if (statusEl) statusEl.textContent = "⚠️ Could not enable — check notification permission.";
          toast("⚠️ Could not enable push notifications");
        }
      });
    } else {
      try { localStorage.setItem("rjap_push_asked", "1"); } catch (_) {}
      lcUnregisterPush();
      if (tgPush) tgPush.classList.remove("on");
      if (statusEl) statusEl.textContent = "— Tap to receive announcements from Radha Naam Jap 🔔 (requires sign-in)";
      toast("🔕 Push notifications turned off");
    }
    return;
  }"""

    if src.count(old_toggle_block) != 1:
        die(
            f"Edit 2: expected exactly 1 occurrence of the manual toggle "
            f"handler, found {src.count(old_toggle_block)} — app.js may "
            f"already differ from what this script expects. No changes made."
        )

    src = src.replace(old_auth_block, new_auth_block, 1)
    src = src.replace(old_toggle_block, new_toggle_block, 1)

    backup_path = path + ".bak-autoprompt"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Auto notification prompt applied. Backup saved to {backup_path}")
    print("No redeploy needed for this one — it's client-side (app.js). Just")
    print("rebuild/republish the web app (and Android app, if it embeds www/app.js).")


if __name__ == "__main__":
    main()
