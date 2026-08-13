#!/usr/bin/env python3
"""
Patch: fix "Backup failed: INVALID_DIR" on native Android export.

Root cause: app.js (and www/app.js) called Filesystem.writeFile with
directory: "Documents" -- but the Capacitor Filesystem plugin's Directory
enum value is the uppercase string "DOCUMENTS". The native Android side
does a strict match against the enum and rejects anything else with the
literal error "INVALID_DIR". The PWA build never hit this because it uses
a separate Blob/<a download> fallback path.

Fix: change "Documents" -> "DOCUMENTS" in both app.js (repo root, used by
the Vercel PWA) and www/app.js (used by the Capacitor APK build).

Run from the repo root:
    python3 patch_fix_invalid_dir.py
"""
import pathlib
import sys

OLD = 'directory: "Documents",'
NEW = 'directory: "DOCUMENTS",'

TARGETS = ["app.js", "www/app.js"]

def patch_file(path_str):
    p = pathlib.Path(path_str)
    if not p.exists():
        print(f"  ⚠️  {path_str} not found, skipping")
        return False
    text = p.read_text(encoding="utf-8")
    count = text.count(OLD)
    if count == 0:
        if NEW in text:
            print(f"  ✅ {path_str} already patched")
            return True
        print(f"  ⚠️  {path_str}: expected string not found -- check manually")
        return False
    if count > 1:
        print(f"  ⚠️  {path_str}: found {count} occurrences, expected 1 -- check manually")
        return False
    text = text.replace(OLD, NEW)
    p.write_text(text, encoding="utf-8")
    print(f"  ✅ {path_str} patched")
    return True

def main():
    print("Patching INVALID_DIR export bug...")
    ok = True
    for t in TARGETS:
        ok = patch_file(t) and ok
    if ok:
        print("\nDone. Now run your usual build:")
        print("  git add app.js www/app.js")
        print("  git commit -m 'Fix Filesystem directory enum casing (Documents -> DOCUMENTS)'")
        print("  npm run build:apk")
    else:
        print("\nSome files were not patched cleanly -- please check the warnings above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
