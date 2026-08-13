#!/usr/bin/env python3
"""
apply_stotram_nav_footer_fix.py

Fixes two stotram-reader UI issues:
  1. Next/Prev nav arrows floating inside the lyrics text instead of
     sitting in a fixed footer strip at the bottom of the screen.
  2. Title pinned top-left -> moves back to top-center, slightly larger.

Idempotent: safe to run more than once. Makes a .bak of each file
before the first successful patch. Patches BOTH the repo-root copy
and the www/ copy directly, so you don't need to remember to run
setup-www.sh afterward (though it's still fine to run it too).

Usage:
    python3 apply_stotram_nav_footer_fix.py
"""

import os
import shutil
import sys

MARKER = "/* v89 — Nav arrows: proper fixed footer strip, not floating in lyrics */"

PATCH_CSS = MARKER + """
.lm-nav {
  position: fixed !important;
  bottom: 0 !important; left: 0 !important; right: 0 !important;
  top: auto !important; transform: none !important;
  width: 100%;
  justify-content: center;
  gap: 60px;
  padding: 12px 0 max(env(safe-area-inset-bottom), 14px);
  background: linear-gradient(to top, rgba(255,255,255,0.97), rgba(255,255,255,0.85) 70%, transparent);
  z-index: 25;
}
.lm-card-inner {
  bottom: max(env(safe-area-inset-bottom) + 78px, 92px) !important;
}

/* Title — back to top-center, slightly larger */
.lmt {
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%) !important;
  max-width: calc(100% - 110px);
  font-size: 16px !important;
}
"""

TARGET_FILES = [
    "style-stotram.css",
    os.path.join("www", "style-stotram.css"),
]


def patch_file(path: str) -> str:
    """Returns 'patched', 'already-applied', or 'missing'."""
    if not os.path.isfile(path):
        return "missing"

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if MARKER in content:
        return "already-applied"

    backup_path = path + ".bak-navfooterfix"
    if not os.path.isfile(backup_path):
        shutil.copy2(path, backup_path)

    with open(path, "a", encoding="utf-8") as f:
        if not content.endswith("\n"):
            f.write("\n")
        f.write("\n" + PATCH_CSS)

    return "patched"


def main():
    results = {}
    for rel_path in TARGET_FILES:
        results[rel_path] = patch_file(rel_path)

    print("── stotram nav/title footer fix ──")
    any_missing = False
    for rel_path, status in results.items():
        print(f"  {rel_path}: {status}")
        if status == "missing":
            any_missing = True

    if any_missing:
        print(
            "\nWarning: run this script from the project root "
            "(where style-stotram.css lives) — one or more target "
            "files were not found at the expected path."
        )
        sys.exit(1)

    if all(v == "already-applied" for v in results.values()):
        print("\nNothing to do — patch already applied to all files.")
    else:
        print(
            "\nDone. Backups saved as *.bak-navfooterfix next to each "
            "patched file.\n\nNext steps:\n"
            "  npx cap sync android\n"
            "  cd android && ./gradlew assembleRelease && cd ..\n"
        )


if __name__ == "__main__":
    main()
