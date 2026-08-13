#!/usr/bin/env python3
"""
patch_export_share.py

Applies ONLY the "export notification + share backup" change to your
existing Radha Naam Jap project -- the same project/keystore you used
to build v1.0.52. It does NOT touch anything else, so it will not
change your Gradle/signing setup or your APK's SHA-1/SHA-256.

Usage:
    python3 patch_export_share.py /path/to/Lalu-Chotopushu-main

It patches (both copies, if present):
    <root>/app.js
    <root>/index.html
    <root>/www/app.js
    <root>/www/index.html

Safe to re-run: it checks for its own marker before editing, so running
it twice will not double-patch a file.
"""

import sys
import pathlib

MARKER = "Backup-saved notification (Export All Data)"

NOTIF_BLOCK = '''
// ── Backup-saved notification (Export All Data) ──
// Writing a file with Filesystem.writeFile does NOT trigger Android's media
// scanner or show any "Download complete"-style banner the way a browser
// download does, so without this the user has no confirmation in the
// notification shade that the export actually happened. This posts a real
// (immediate, non-scheduled) local notification once the backup file is
// written, on its own low-key channel so it doesn't inherit the reminder
// tone/vibration.
const RJAP_BACKUP_NOTIF_CHANNEL_ID = "rjap_backups_v1";
const RJAP_BACKUP_NOTIF_ID = 9010;

async function lcSetupBackupNotifChannel() {
  if (!(_lcIsNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications)) return;
  try {
    await window.Capacitor.Plugins.LocalNotifications.createChannel({
      id: RJAP_BACKUP_NOTIF_CHANNEL_ID,
      name: "Backup Confirmations",
      description: "Confirms when a local data backup has been saved",
      importance: 3, // default importance — shows in shade, no intrusive sound
      visibility: 1,
    });
  } catch (e) {}
}

// Fires a one-off notification right away (no `schedule` field = immediate).
// Best-effort only: if notification permission was never granted this
// silently does nothing rather than nagging the user with a permission
// prompt in the middle of an export — the toast already confirms success.
async function lcNotifyBackupSaved(body) {
  if (!(_lcIsNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications)) return;
  try {
    const { LocalNotifications } = window.Capacitor.Plugins;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await lcSetupBackupNotifChannel();
    await LocalNotifications.schedule({
      notifications: [{
        id: RJAP_BACKUP_NOTIF_ID,
        title: "📥 Radha Naam Jap Backup Saved",
        body,
        channelId: RJAP_BACKUP_NOTIF_CHANNEL_ID,
        smallIcon: "ic_stat_notify",
        iconColor: "#E56B1F",
      }],
    });
  } catch (e) {}
}
'''

OLD_EXPORT_FN = '''function exportAllData() {
  const backup = _buildBackupPayload();
  try {
    const json = JSON.stringify(backup, null, 2);
    const filename = "radha-naam-jap-backup-" + App.getTk() + ".json";
    saveJsonFile(filename, json);
  } catch (e) {
    console.error("exportAllData failed:", e);
    toast("❌ Backup failed: " + (e && e.message ? e.message : e));
  }
}'''

NEW_EXPORT_FN = '''async function exportAllData() {
  const backup = _buildBackupPayload();
  try {
    const json = JSON.stringify(backup, null, 2);
    const filename = "radha-naam-jap-backup-" + App.getTk() + ".json";
    const ok = await saveJsonFile(filename, json);
    if (ok) {
      lcNotifyBackupSaved("Saved as " + filename + " in Documents/Radha Jap Backup 🙏");
    }
  } catch (e) {
    console.error("exportAllData failed:", e);
    toast("❌ Backup failed: " + (e && e.message ? e.message : e));
  }
}

// ── Share Backup (send the exported JSON file directly, like "Share App
// Link") ──
// Native: writes the backup into the app's private cache dir (always
// covered by Capacitor's built-in FileProvider, unlike the public Documents
// folder used by exportAllData/saveJsonFile) and opens the real Android
// share sheet with the file attached.
// Web/PWA: uses the Web Share API's file-sharing (navigator.canShare with
// `files`) where supported; otherwise falls back to a normal download,
// since most desktop browsers can't "share" a file at all.
async function shareBackup() {
  const backup = _buildBackupPayload();
  let json, filename;
  try {
    json = JSON.stringify(backup, null, 2);
    filename = "radha-naam-jap-backup-" + App.getTk() + ".json";
  } catch (e) {
    console.error("shareBackup build failed:", e);
    toast("❌ Backup failed: " + (e && e.message ? e.message : e));
    return;
  }

  if (
    _lcIsNative() &&
    window.Capacitor.Plugins &&
    window.Capacitor.Plugins.Filesystem &&
    window.Capacitor.Plugins.Share
  ) {
    try {
      const { Filesystem, Share } = window.Capacitor.Plugins;
      await Filesystem.writeFile({
        path: filename,
        data: json,
        directory: "CACHE",
        encoding: "utf8",
      });
      const { uri } = await Filesystem.getUri({ directory: "CACHE", path: filename });
      await Share.share({
        title: "Radha Naam Jap Backup",
        text: "My Radha Naam Jap backup file \\uD83D\\uDE4F Jai Radhe!",
        url: uri,
      });
      return;
    } catch (e) {
      if (e && e.message && /cancel/i.test(e.message)) return; // user dismissed share sheet
      console.error("Native shareBackup failed:", e);
      toast("❌ Share failed: " + (e && e.message ? e.message : e));
      return;
    }
  }

  // ── Web fallback ──
  try {
    const file = new File([json], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Radha Naam Jap Backup",
        text: "My Radha Naam Jap backup file \\uD83D\\uDE4F Jai Radhe!",
      });
    } else {
      // Browser can't share files — fall back to a normal download.
      await saveJsonFile(filename, json);
    }
  } catch (e) {
    if (e && e.name === "AbortError") return; // user dismissed share sheet
    console.error("Web shareBackup failed:", e);
    toast("❌ Share failed: " + (e && e.message ? e.message : e));
  }
}'''

# Anchor: end of lcRequestNotifPermission's channel-setup neighbor block,
# right before "async function lcRequestNotifPermission()"
JS_INSERT_ANCHOR = '''  } catch (e) {}
}

async function lcRequestNotifPermission() {'''

JS_INSERT_REPLACEMENT = '''  } catch (e) {}
}
''' + NOTIF_BLOCK + '''
async function lcRequestNotifPermission() {'''

HTML_OLD_BUTTON_ANCHOR = None  # filled below after locating export button


def patch_app_js(path: pathlib.Path) -> str:
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        return "already patched"

    if JS_INSERT_ANCHOR not in text:
        return "SKIPPED: notification-channel anchor not found (file may already differ from expected original)"
    if OLD_EXPORT_FN not in text:
        return "SKIPPED: exportAllData() anchor not found (file may already differ from expected original)"

    text = text.replace(JS_INSERT_ANCHOR, JS_INSERT_REPLACEMENT, 1)
    text = text.replace(OLD_EXPORT_FN, NEW_EXPORT_FN, 1)
    path.write_text(text, encoding="utf-8")
    return "patched"


def patch_index_html(path: pathlib.Path) -> str:
    text = path.read_text(encoding="utf-8")
    if "shareBackup()" in text:
        return "already patched"

    # Insert the Share Backup button right after the Export All Data button,
    # matched loosely by its onclick handler so minor style edits elsewhere
    # in the file don't break the match.
    import re
    pattern = re.compile(r'(<button[^>]*onclick="exportAllData\(\)"[^>]*>.*?</button>)', re.DOTALL)
    m = pattern.search(text)
    if not m:
        return "SKIPPED: Export All Data button not found in this file"

    share_button = (
        '\n    <button class="pb" onclick="shareBackup()" '
        'style="margin-bottom:10px;background:linear-gradient(135deg,rgba(255,215,0,0.35),'
        'rgba(255,180,0,0.25));color:var(--gold);border:1px solid rgba(255,215,0,0.4)">'
        '📤 Share Backup</button>'
    )
    text = text[: m.end()] + share_button + text[m.end():]
    path.write_text(text, encoding="utf-8")
    return "patched"


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 patch_export_share.py /path/to/Lalu-Chotopushu-main")
        sys.exit(1)

    root = pathlib.Path(sys.argv[1]).resolve()
    if not root.is_dir():
        print(f"Not a directory: {root}")
        sys.exit(1)

    targets = [
        ("app.js", root / "app.js", patch_app_js),
        ("www/app.js", root / "www" / "app.js", patch_app_js),
        ("index.html", root / "index.html", patch_index_html),
        ("www/index.html", root / "www" / "index.html", patch_index_html),
    ]

    any_found = False
    for label, path, fn in targets:
        if not path.exists():
            print(f"{label}: not found, skipping")
            continue
        any_found = True
        result = fn(path)
        print(f"{label}: {result}")

    if not any_found:
        print("\nNo target files found under that path. Point this at your "
              "project root (the folder containing app.js / index.html).")
        sys.exit(1)

    print("\nDone. Now use Capacitor's normal `npx cap copy android` (or "
          "your usual build step) and rebuild the release APK/AAB with the "
          "SAME keystore file, alias, and passwords you used for v1.0.52 -- "
          "do not build this in a fresh Codespace/Android Studio checkout "
          "that doesn't have that keystore, or the signing certificate "
          "(and therefore the SHA-1/SHA-256) will change and your users "
          "will be forced to uninstall before they can update.")


if __name__ == "__main__":
    main()
