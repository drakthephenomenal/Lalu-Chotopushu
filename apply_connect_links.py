#!/usr/bin/env python3
"""
Adds a "Connect With Us" section to the bottom of the Settings screen,
with proper platform icons (YouTube, Telegram, WhatsApp, Messenger) that
open your community links.

Links wired in:
  YouTube:   https://www.youtube.com/@RadhaNaamJapCounter108
  Telegram:  https://t.me/GuruKripahiKevalam
  WhatsApp:  https://chat.whatsapp.com/Bw8bzwiaYnd8ULdknyw0DF?s=sh&p=a&ilr=4
  Messenger: https://m.me/j/AbbTnHoUPGNjZxcx/?send_source=gc%3Acopy_invite_link_t

Uses the existing @capacitor/browser plugin (already in this project) to
open links in an in-app browser tab on native builds, matching how the
existing OAuth flow opens links elsewhere in app.js. Falls back to
window.open on the web build, matching the pattern already used at
app.js line ~6715.

Inserted right after the "Chat with Developer" section and before the
Developer-only panel — same position for both index.html and www/index.html.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_connect_links.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up index.html -> index.html.bak-connectlinks first.

After running:
    bash setup-www.sh
    npx cap sync android
"""
import os
import sys

TARGET_FILES = ["index.html", os.path.join("www", "index.html")]
APP_JS_FILES = ["app.js", os.path.join("www", "app.js")]

MARKER = "id=\"connectWithUsSection\""

LINKS_HTML = '''  <!-- CONNECT WITH US -->
  <div class="sc" id="connectWithUsSection" style="background:rgba(255,215,0,0.03);border-color:rgba(255,215,0,0.18)">
    <h3>🔗 Connect With Us</h3>
    <p style="font-size:12px;color:var(--td);margin-bottom:14px">Join the community, get updates, and stay connected 🙏</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div onclick="openExternalLink('https://www.youtube.com/@RadhaNaamJapCounter108')"
        style="display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;cursor:pointer;border:1.5px solid rgba(255,0,0,0.25);background:rgba(255,0,0,0.06);transition:all 0.2s;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M23.5 6.2s-.23-1.64-.94-2.36c-.9-.94-1.9-.95-2.36-1C17 2.5 12 2.5 12 2.5h-.01s-5 0-8.19.34c-.46.05-1.46.06-2.36 1C.73 4.56.5 6.2.5 6.2S.25 8.13.25 10.07v1.86c0 1.94.25 3.87.25 3.87s.23 1.64.94 2.36c.9.94 2.08.91 2.6 1.01 1.89.18 8 .24 8 .24s5.01-.01 8.2-.35c.46-.05 1.46-.06 2.36-1 .71-.72.94-2.36.94-2.36s.25-1.93.25-3.87v-1.86c0-1.94-.25-3.87-.25-3.87z" fill="#FF0000"/><path d="M9.6 14.5V7.5l6.4 3.5-6.4 3.5z" fill="#fff"/></svg>
        <div>
          <div style="font-size:13px;color:#fff;font-weight:600;">YouTube</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.5);">Videos & updates</div>
        </div>
      </div>
      <div onclick="openExternalLink('https://t.me/GuruKripahiKevalam')"
        style="display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;cursor:pointer;border:1.5px solid rgba(41,182,246,0.3);background:rgba(41,182,246,0.06);transition:all 0.2s;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#29A9EA"/><path d="M17.94 7.28l-2.1 9.9c-.16.7-.58.87-1.17.54l-3.24-2.39-1.56 1.5c-.17.17-.32.32-.65.32l.23-3.3 6-5.42c.26-.23-.06-.36-.4-.13l-7.42 4.67-3.2-1c-.7-.22-.71-.7.15-1.03l12.5-4.82c.58-.21 1.09.14.9 1.15z" fill="#fff"/></svg>
        <div>
          <div style="font-size:13px;color:#fff;font-weight:600;">Telegram</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.5);">Community channel</div>
        </div>
      </div>
      <div onclick="openExternalLink('https://chat.whatsapp.com/Bw8bzwiaYnd8ULdknyw0DF?s=sh&p=a&ilr=4')"
        style="display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;cursor:pointer;border:1.5px solid rgba(37,211,102,0.3);background:rgba(37,211,102,0.06);transition:all 0.2s;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#25D366"/><path d="M12 5.5a6.4 6.4 0 00-5.5 9.66L5.5 18.5l3.44-.97A6.4 6.4 0 1012 5.5zm0 1.2a5.2 5.2 0 11-2.66 9.66l-.2-.12-2.06.58.58-2-.13-.22A5.2 5.2 0 0112 6.7z" fill="#fff"/><path d="M9.9 8.9c-.14-.31-.28-.32-.41-.32h-.35c-.12 0-.32.05-.49.24-.17.19-.64.63-.64 1.53s.66 1.78.75 1.9c.09.12 1.28 2.04 3.16 2.78 1.56.61 1.88.49 2.22.46.34-.03 1.09-.44 1.24-.87.15-.43.15-.79.1-.87-.05-.08-.17-.13-.35-.22-.19-.1-1.09-.54-1.26-.6-.17-.06-.29-.09-.42.1-.12.18-.48.6-.58.72-.11.12-.21.14-.4.05-.19-.1-.79-.29-1.5-.93-.56-.5-.93-1.11-1.04-1.3-.11-.19-.01-.29.08-.39.08-.08.19-.21.28-.31.09-.1.12-.18.19-.3.06-.12.03-.23-.01-.32-.05-.1-.42-1.05-.6-1.44z" fill="#25D366"/></svg>
        <div>
          <div style="font-size:13px;color:#fff;font-weight:600;">WhatsApp</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.5);">Group chat</div>
        </div>
      </div>
      <div onclick="openExternalLink('https://m.me/j/AbbTnHoUPGNjZxcx/?send_source=gc%3Acopy_invite_link_t')"
        style="display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;cursor:pointer;border:1.5px solid rgba(0,132,255,0.3);background:rgba(0,132,255,0.06);transition:all 0.2s;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="mgrad" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stop-color="#00B2FF"/><stop offset="0.5" stop-color="#006AFF"/><stop offset="1" stop-color="#B900FF"/></linearGradient></defs><circle cx="12" cy="12" r="12" fill="url(#mgrad)"/><path d="M12 5.5c-3.87 0-7 2.87-7 6.65 0 2.15 1.02 4.07 2.62 5.33V20l2.4-1.32c.64.18 1.31.27 2 .27 3.87 0 7-2.87 7-6.65s-3.15-4.8-7.02-4.8zm.7 8.96l-1.78-1.9-3.48 1.9 3.83-4.06 1.82 1.9 3.44-1.9-3.83 4.06z" fill="#fff"/></svg>
        <div>
          <div style="font-size:13px;color:#fff;font-weight:600;">Messenger</div>
          <div style="font-size:9px;color:rgba(255,255,255,0.5);">Chat with us</div>
        </div>
      </div>
    </div>
  </div>

'''

JS_HELPER_MARKER = "function openExternalLink("

JS_HELPER = '''// ── Open an external link (community/social) in the system/in-app browser ──
async function openExternalLink(url) {
  try {
    if (
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.Browser
    ) {
      await window.Capacitor.Plugins.Browser.open({ url });
      return;
    }
  } catch (_e) {}
  try { window.open(url, "_blank"); } catch (_e) {}
}

'''


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def apply_edit(src, old, new, label, filename):
    count = src.count(old)
    if count == 0:
        die(
            f"[{filename}] Anchor for '{label}' not found. This file may "
            "differ from the version this patch was written against — "
            "aborting without changing anything."
        )
    if count > 1:
        die(
            f"[{filename}] Anchor for '{label}' appears {count} times "
            "(expected exactly 1) — aborting without changing anything."
        )
    return src.replace(old, new, 1)


def patch_html(path):
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        print(f"  {path}: Connect With Us section already present — skipping.")
        return False

    old = '''  <!-- DEVELOPER ONLY SECTION -->'''
    new = LINKS_HTML + '''  <!-- DEVELOPER ONLY SECTION -->'''

    src = apply_edit(src, old, new, "insert Connect With Us section", path)

    with open(path + ".bak-connectlinks", "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())

    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"  {path}: added Connect With Us section. Backup: {path}.bak-connectlinks")
    return True


def patch_js(path):
    if not os.path.isfile(path):
        print(f"  {path}: not found — skipping (only patching files that exist).")
        return False

    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if JS_HELPER_MARKER in src:
        print(f"  {path}: openExternalLink() already present — skipping.")
        return False

    if "function shareApp()" not in src:
        die(f"[{path}] Could not find 'function shareApp()' anchor — aborting without changing anything.")

    old = "function shareApp()"
    new = JS_HELPER + "function shareApp()"

    src = apply_edit(src, old, new, "insert openExternalLink() helper", path)

    with open(path + ".bak-connectlinks", "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())

    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"  {path}: added openExternalLink() helper. Backup: {path}.bak-connectlinks")
    return True


def main():
    cwd = os.getcwd()
    missing_html = [p for p in TARGET_FILES if not os.path.isfile(p)]
    if missing_html:
        die(
            f"Could not find: {', '.join(missing_html)} in the current directory "
            f"({cwd}).\nRun this script from your repo root, e.g.:\n"
            "  cd ~/Lalu-Chotopushu\n"
            "  python3 apply_connect_links.py"
        )

    print("Patching HTML (Settings section):")
    any_applied = False
    for path in TARGET_FILES:
        if patch_html(path):
            any_applied = True

    print("")
    print("Patching JS (openExternalLink helper):")
    for path in APP_JS_FILES:
        if patch_js(path):
            any_applied = True

    print("")
    if any_applied:
        print("Next steps:")
        print("   bash setup-www.sh")
        print("   npx cap sync android")
        print("   git add index.html www/index.html app.js www/app.js")
        print('   git commit -m "Add Connect With Us links to Settings"')
        print("   git push")
    else:
        print("Nothing to do — already applied everywhere.")


if __name__ == "__main__":
    main()
