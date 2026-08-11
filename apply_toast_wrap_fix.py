#!/usr/bin/env python3
"""
Fixes toast messages getting clipped off-screen for longer text (like the
GPS "please turn on Location" message). The toast() function was built for
short messages ("Target saved! 🎯") using white-space:nowrap with no width
limit - fine for short text, but longer messages just overflow past the
screen edge instead of wrapping.

FIX: caps the toast at a max-width and allows wrapping, so long messages
wrap onto 2-3 lines and stay fully on-screen. Short messages still look
like the same snug centered pill as before (width:auto still applies up
to the cap). Also scales the display duration slightly with message
length, so longer messages get a bit more time to actually be read.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_toast_wrap_fix.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js -> app.js.bak-toastwrap first.

After running:
    bash setup-www.sh
    npx cap sync android
    git add app.js www/app.js
    git commit -m "Fix long toast messages getting clipped off-screen"
    git push
"""
import os
import sys

APP_JS_FILES = ["app.js", os.path.join("www", "app.js")]
MARKER = "max-width:85vw"

OLD_BLOCK = '''function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText =
      "position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:rgba(74,144,226,0.2);border:1px solid rgba(109,184,255,0.4);backdrop-filter:blur(10px);color:var(--a2);padding:9px 18px;border-radius:18px;font-size:13px;z-index:500;transition:opacity 0.3s;pointer-events:none;white-space:nowrap;font-family:Inter,sans-serif";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  setTimeout(() => (t.style.opacity = "0"), 2000);
}'''

NEW_BLOCK = '''function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText =
      "position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:rgba(74,144,226,0.2);border:1px solid rgba(109,184,255,0.4);backdrop-filter:blur(10px);color:var(--a2);padding:9px 18px;border-radius:18px;font-size:13px;z-index:500;transition:opacity 0.3s;pointer-events:none;white-space:normal;text-align:center;max-width:85vw;line-height:1.4;font-family:Inter,sans-serif";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  if (t._toastTimer) clearTimeout(t._toastTimer);
  // Longer messages get more time to read (base 2s + ~30ms per character,
  // capped at 6s) instead of the same fixed 2s for every message length.
  const duration = Math.min(2000 + (msg ? msg.length : 0) * 30, 6000);
  t._toastTimer = setTimeout(() => (t.style.opacity = "0"), duration);
}'''


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def apply_edit(src, old, new, label, filename):
    count = src.count(old)
    if count == 0:
        die(
            f"[{filename}] Anchor for '{label}' not found. This file may "
            "differ from the version this patch was written against - "
            "aborting without changing anything."
        )
    if count > 1:
        die(
            f"[{filename}] Anchor for '{label}' appears {count} times "
            "(expected exactly 1) - aborting without changing anything."
        )
    return src.replace(old, new, 1)


def main():
    print("Patching toast() to wrap long messages instead of clipping:")
    any_applied = False
    for path in APP_JS_FILES:
        if not os.path.isfile(path):
            print(f"  {path}: not found - skipping.")
            continue

        with open(path, "r", encoding="utf-8") as f:
            src = f.read()

        if MARKER in src:
            print(f"  {path}: already patched - skipping.")
            continue

        src = apply_edit(src, OLD_BLOCK, NEW_BLOCK, "wrap long toast messages", path)

        with open(path + ".bak-toastwrap", "w", encoding="utf-8") as f:
            f.write(open(path, "r", encoding="utf-8").read())

        with open(path, "w", encoding="utf-8") as f:
            f.write(src)

        print(f"  {path}: patched. Backup: {path}.bak-toastwrap")
        any_applied = True

    print("")
    if any_applied:
        print("Next steps:")
        print("   bash setup-www.sh")
        print("   npx cap sync android")
        print("   git add app.js www/app.js")
        print('   git commit -m "Fix long toast messages getting clipped off-screen"')
        print("   git push")
    else:
        print("Nothing to do - already applied everywhere.")


if __name__ == "__main__":
    main()
