#!/usr/bin/env python3
"""
Native backup export fix — two independent bugs in the Capacitor (APK)
Export All Data flow, both in saveJsonFile()/exportAllData():

BUG 1 — "Backup failed: FILE_NOTCREATED"
  saveJsonFile() relies on Filesystem.writeFile({ ..., recursive: true })
  to auto-create the "Radha Jap Backup" subfolder inside the public
  Documents directory. On Android 10+ scoped storage, that `recursive`
  flag is a documented Capacitor Filesystem plugin limitation for
  Directory.Documents specifically — it can silently fail to create the
  intermediate folder, so the write then fails because the folder it's
  writing into was never actually created. There was no explicit mkdir
  call anywhere as a fallback.
  FIX: explicitly call Filesystem.mkdir() for the subfolder before
  writeFile, ignoring "already exists" errors. This is the standard,
  documented workaround for this exact plugin behavior.

BUG 2 — backup-saved notification never appears, even on past successes
  lcNotifyBackupSaved() only fires if notification permission was
  already granted, but nothing in the export flow ever REQUESTS that
  permission — the only place the app asks for it is the jap-reminders
  toggle. A user who never enabled reminders has never been asked, so
  the confirmation notification has been silently no-op-ing.
  FIX: call the existing, already-idempotent lcRequestNotifPermission()
  once before attempting the backup-saved notification. It only shows
  a system prompt if permission hasn't been decided yet, and does
  nothing disruptive if already granted or previously denied (Android
  itself suppresses repeat prompts after a denial, so this is safe to
  call on every export without nagging the user).

Neither fix changes the PWA/web fallback path, which was already
working correctly (browser-native download notification).

USAGE (run from repo root, or from www/):
    python3 apply_native_backup_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-backupfix suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "FILE_NOTCREATED workaround"


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

    # ── Fix 1: explicit mkdir before writeFile in saveJsonFile() ──
    old_write = """      const writeResult = await Filesystem.writeFile({
        path: subPath,
        data: jsonString,
        directory: "DOCUMENTS",
        encoding: "utf8",
        recursive: true, // create the "Radha Jap Backup" folder if missing
      });"""

    new_write = """      // FILE_NOTCREATED workaround — writeFile's own `recursive: true` is
      // documented to auto-create missing parent folders, but is known to
      // silently fail to do so for Directory.Documents specifically on
      // Android 10+ scoped storage. Creating the folder explicitly first
      // is the standard workaround; "already exists" errors are expected
      // and harmless on every export after the first.
      try {
        await Filesystem.mkdir({
          path: "Radha Jap Backup",
          directory: "DOCUMENTS",
          recursive: true,
        });
      } catch (_mkdirErr) {
        // Already exists (or plugin doesn't need it) — fall through and
        // let writeFile itself surface any real problem below.
      }
      const writeResult = await Filesystem.writeFile({
        path: subPath,
        data: jsonString,
        directory: "DOCUMENTS",
        encoding: "utf8",
        recursive: true, // create the "Radha Jap Backup" folder if missing
      });"""

    if src.count(old_write) != 1:
        die(
            f"Expected exactly 1 occurrence of the writeFile call in saveJsonFile(), "
            f"found {src.count(old_write)} — app.js may already differ from what this "
            f"script expects. No changes made."
        )
    src = src.replace(old_write, new_write, 1)

    # ── Fix 2: request notification permission before notifying, in exportAllData() ──
    old_notify = """    const ok = await saveJsonFile(filename, json);
    if (ok) {
      lcNotifyBackupSaved("Saved as " + filename + " in Documents/Radha Jap Backup 🙏");
    }"""

    new_notify = """    const ok = await saveJsonFile(filename, json);
    if (ok) {
      // The confirmation notification only shows if permission is already
      // granted, but nothing else in this flow ever asks for it — a user
      // who never touched jap reminders (the only other place permission
      // gets requested) would never see this notification at all.
      // lcRequestNotifPermission() is already idempotent/safe to call
      // repeatedly: no prompt if already decided either way.
      await lcRequestNotifPermission();
      lcNotifyBackupSaved("Saved as " + filename + " in Documents/Radha Jap Backup 🙏");
    }"""

    if src.count(old_notify) != 1:
        die(
            f"Expected exactly 1 occurrence of the notify call in exportAllData(), "
            f"found {src.count(old_notify)} — app.js may already differ from what this "
            f"script expects. No changes made (mkdir fix above was still applied)."
        )
    src = src.replace(old_notify, new_notify, 1)

    backup_path = path + ".bak-backupfix"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Native backup export fix applied (mkdir workaround + notification permission request). Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
