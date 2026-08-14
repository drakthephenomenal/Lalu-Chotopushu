#!/usr/bin/env python3
"""
Native backup export fallback fix — the mkdir workaround (see
apply_native_backup_fix.py) addresses ONE known cause of FILE_NOTCREATED
(recursive folder creation silently failing for Directory.Documents), but
writing arbitrary non-media files into the public Documents folder via
Android scoped storage is unreliable across OEMs regardless — some
manufacturer ROMs (MIUI/Xiaomi in particular) restrict or mishandle it
even when the folder exists. No amount of folder-creation workaround
fixes a write the OS itself blocks.

This patch stops fighting scoped storage directly: when the direct
Documents write fails for ANY reason, saveJsonFile() now automatically
falls back to the same mechanism "Share Backup" already uses reliably —
write to the app's private CACHE directory (no scoped-storage
restrictions apply there at all) and hand it to Android's native Share
sheet, so the OS itself handles "save it somewhere" via Storage Access
Framework. The user picks Save to Drive / Files / Downloads / wherever,
instead of the export silently failing.

REQUIRES: apply_native_backup_fix.py should already be applied (this
patch replaces that patch's catch block). If it isn't, this script still
works standalone — it just means the mkdir workaround won't have been
attempted first, which is fine since this fallback covers that failure
mode too.

USAGE (run from repo root, or from www/):
    python3 apply_native_backup_fallback_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-backupfallback suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "share-sheet fallback (scoped storage unreliable across OEMs)"


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

    # Matches whether or not the mkdir workaround patch has already been
    # applied — either way, the writeFile call + catch block below it is
    # the same shape, we're only replacing the catch block's behavior.
    old_catch = """      toast(\"\\ud83d\\udce5 Saved to Documents/Radha Jap Backup \\ud83d\\ude4f Jai Radhe!\");
      return true;
    } catch (e) {
      console.error(\"Native saveJsonFile failed:\", e);
      toast(\"\\u274c Backup failed: \" + (e && e.message ? e.message : e));
      return false;
    }
  }"""

    new_catch = """      toast(\"\\ud83d\\udce5 Saved to Documents/Radha Jap Backup \\ud83d\\ude4f Jai Radhe!\");
      return true;
    } catch (e) {
      // share-sheet fallback (scoped storage unreliable across OEMs) —
      // writing arbitrary files into the public Documents folder is known
      // to silently fail on some manufacturer ROMs (MIUI/Xiaomi in
      // particular) regardless of folder-creation workarounds, because the
      // OS itself restricts or mishandles it. Rather than dead-ending with
      // an error, fall back to the same mechanism Share Backup already
      // uses reliably: write to the app's private cache (no scoped-storage
      // restrictions apply there) and hand it to the native Share sheet so
      // the user can still save it wherever they like via the OS picker.
      console.warn(\"Direct Documents write failed, falling back to share sheet:\", e && e.message ? e.message : e);
      try {
        const { Filesystem: FS2, Share } = window.Capacitor.Plugins;
        if (FS2 && Share) {
          await FS2.writeFile({
            path: filename,
            data: jsonString,
            directory: \"CACHE\",
            encoding: \"utf8\",
          });
          const { uri } = await FS2.getUri({ directory: \"CACHE\", path: filename });
          await Share.share({
            title: \"Radha Naam Jap Backup\",
            text: \"My Radha Naam Jap backup file \\ud83d\\ude4f Jai Radhe!\",
            url: uri,
          });
          return true;
        }
      } catch (shareErr) {
        if (shareErr && shareErr.message && /cancel/i.test(shareErr.message)) return false; // user dismissed share sheet, not a real failure
        console.error(\"Share-sheet fallback also failed:\", shareErr);
      }
      console.error(\"Native saveJsonFile failed:\", e);
      toast(\"\\u274c Backup failed: \" + (e && e.message ? e.message : e));
      return false;
    }
  }"""

    if src.count(old_catch) != 1:
        die(
            f"Expected exactly 1 occurrence of the saveJsonFile success/catch block, "
            f"found {src.count(old_catch)} — app.js may already differ from what this "
            f"script expects. No changes made."
        )
    src = src.replace(old_catch, new_catch, 1)

    backup_path = path + ".bak-backupfallback"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Share-sheet fallback applied. Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
