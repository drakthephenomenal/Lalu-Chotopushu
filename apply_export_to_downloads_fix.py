#!/usr/bin/env python3
"""
apply_export_to_downloads_fix.py

Changes "Export All Data" from writing to an app-private Cache folder +
always opening the Android Share sheet, to writing DIRECTLY into a
public, file-manager-visible folder:

    Documents/Radha Jap Backup/<filename>.json

Handles both storage models Android has used:
  - Android 10+ (scoped storage): no permission needed at all.
  - Android below 10 (this app's minSdkVersion is 22): needs the legacy
    WRITE_EXTERNAL_STORAGE runtime permission, requested here before
    the write. Also declares that permission in AndroidManifest.xml,
    capped at maxSdkVersion="28" so it has no effect (and triggers no
    Play Store warning) on modern Android where it is not used.

IMPORTANT -- please read before relying on this for all users:
The permission-request path for Android < 10 could not be verified on
a real device while writing this patch (no such device available).
The code follows the documented @capacitor/filesystem API correctly,
but please test one real export on a low-API device or emulator
(API 22-28) before assuming it works for every supported user, since
permission-grant UI can behave differently across OEM Android skins.
The Android 10+ path (likely the large majority of active users) needs
no permission at all and is lower-risk.

Patches:
  - app.js (+ www/app.js): saveJsonFile()'s native branch
  - android/app/src/main/AndroidManifest.xml: adds the permission,
    inserted right after the existing INTERNET permission, matched by
    regex so it works regardless of exact indentation in your file.

Idempotent: safe to re-run. Makes a .bak-exportfix of each file before
its first successful patch.

Usage:
    python3 apply_export_to_downloads_fix.py
"""

import os
import re
import shutil
import sys

APPJS_OLD = '  if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {\n    try {\n      const { Filesystem } = window.Capacitor.Plugins;\n      // Directory/Encoding are plain enums from @capacitor/filesystem, not\n      // registered plugins, so they aren\'t on window.Capacitor.Plugins.\n      // Hardcode the string values instead. Using Cache (not Documents) —\n      // it needs no storage permission on Android 10+, and the Share sheet\n      // right below lets the user save it wherever they actually want.\n      const writeResult = await Filesystem.writeFile({\n        path: filename,\n        data: jsonString,\n        directory: "CACHE",\n        encoding: "utf8",\n      });\n      toast("Backup saved to Documents! 🙏 Jai Radhe!");\n      // Offer to share/export immediately (Drive, WhatsApp, email, etc.)\n      if (window.Capacitor.Plugins.Share) {\n        try {\n          await window.Capacitor.Plugins.Share.share({\n            title: filename,\n            text: "Radha Naam Jap backup",\n            url: writeResult.uri,\n            dialogTitle: "Save or share your backup",\n          });\n        } catch (shareErr) {\n          // Share can be cancelled by the user — not a real error, ignore.\n        }\n      }\n      return true;\n    } catch (e) {\n      console.error("Native saveJsonFile failed:", e);\n      toast("❌ Backup failed: " + (e && e.message ? e.message : e));\n      return false;\n    }\n  }\n'
APPJS_NEW = '  if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {\n    try {\n      const { Filesystem } = window.Capacitor.Plugins;\n      const subPath = "Radha Jap Backup/" + filename;\n\n      // Android below 10 (API 29) needs the legacy WRITE_EXTERNAL_STORAGE\n      // permission granted before writing to the public Documents folder.\n      // Android 10+ (scoped storage) needs no permission for this at all --\n      // checkPermissions/requestPermissions are safe to call on every\n      // version; on 10+ they resolve immediately with no prompt shown.\n      // NOTE: this permission-request path has NOT been verified on a real\n      // pre-Android-10 device -- test an actual export on a low API level\n      // device/emulator before relying on it for those users.\n      try {\n        const perm = await Filesystem.checkPermissions();\n        if (perm && perm.publicStorage && perm.publicStorage !== "granted") {\n          await Filesystem.requestPermissions();\n        }\n      } catch (_permErr) {\n        // Older/newer plugin builds may not expose this API the same way --\n        // fall through and let writeFile itself surface any real permission\n        // error below, rather than blocking the whole export.\n      }\n\n      const writeResult = await Filesystem.writeFile({\n        path: subPath,\n        data: jsonString,\n        directory: "Documents",\n        encoding: "utf8",\n        recursive: true, // create the "Radha Jap Backup" folder if missing\n      });\n      toast("\\ud83d\\udce5 Saved to Documents/Radha Jap Backup \\ud83d\\ude4f Jai Radhe!");\n      return true;\n    } catch (e) {\n      console.error("Native saveJsonFile failed:", e);\n      toast("\\u274c Backup failed: " + (e && e.message ? e.message : e));\n      return false;\n    }\n  }\n'

MANIFEST_PERMISSION_NAME = "WRITE_EXTERNAL_STORAGE"
MANIFEST_NEW_LINE_TEMPLATE = (
    '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" '
    'android:maxSdkVersion="28" />\n'
)


def backup_once(path):
    b = path + ".bak-exportfix"
    if not os.path.isfile(b):
        shutil.copy2(path, b)


def patch_appjs(path):
    if not os.path.isfile(path):
        return "missing"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if APPJS_NEW in content:
        return "already-applied"
    if APPJS_OLD not in content:
        return "pattern-not-found"
    backup_once(path)
    content = content.replace(APPJS_OLD, APPJS_NEW, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return "patched"


def patch_manifest(path):
    if not os.path.isfile(path):
        return "missing"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if MANIFEST_PERMISSION_NAME in content:
        return "already-applied"
    # Match the INTERNET permission line regardless of exact indentation,
    # so this works even though the exact manifest file wasn\'t available
    # when this script was written.
    m = re.search(
        r'([ \t]*)<uses-permission android:name="android\.permission\.INTERNET"\s*/>\s*\n',
        content,
    )
    if not m:
        return "pattern-not-found"
    indent = m.group(1)
    insertion = indent + MANIFEST_NEW_LINE_TEMPLATE
    new_content = content[: m.end()] + insertion + content[m.end() :]
    backup_once(path)
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    return "patched"


def main():
    print("-- export-to-Downloads fix --")
    any_missing = False
    any_not_found = False

    for path in ("app.js", os.path.join("www", "app.js")):
        status = patch_appjs(path)
        print(f"  {path}: {status}")
        if status == "missing":
            any_missing = True
        if status == "pattern-not-found":
            any_not_found = True

    manifest_path = os.path.join(
        "android", "app", "src", "main", "AndroidManifest.xml"
    )
    status = patch_manifest(manifest_path)
    print(f"  {manifest_path}: {status}")
    if status == "missing":
        any_missing = True
    if status == "pattern-not-found":
        any_not_found = True

    if any_missing:
        print(
            "\nRun this from the project root (where app.js and android/ live)."
        )
    if any_not_found:
        print(
            "\nWarning: an expected code/markup pattern was not found -- "
            "the file may have changed since this script was written. "
            "No changes were made to that specific file; nothing was "
            "corrupted. Tell me what changed and I\'ll adjust the patch."
        )
    if any_missing or any_not_found:
        sys.exit(1)

    print(
        "\nDone. Backups saved as *.bak-exportfix next to each patched file.\n"
        "\nIMPORTANT: test one real export on a pre-Android-10 device or "
        "emulator if you have one -- the permission-request path for "
        "those OS versions could not be verified without a physical "
        "device. Android 10+ needs no permission and is lower-risk.\n"
        "\nNext steps:\n"
        "  npx cap sync android\n"
        "  cd android && ./gradlew assembleRelease && cd ..\n"
    )


if __name__ == "__main__":
    main()
