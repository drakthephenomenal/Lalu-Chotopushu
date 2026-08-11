#!/usr/bin/env python3
"""
Adds Open Graph meta tags to about.html so that sharing your app link on
WhatsApp, Instagram, Facebook, or Messenger shows a proper preview card
(image, title, description) instead of a plain blue link.

REQUIRES: an og-image.png file placed at the repo root (i.e. it will be
served at https://radharadharadha.vercel.app/og-image.png once deployed).
Recommended size: 1200x630px. If your image is a .jpg instead, edit
OG_IMAGE_FILENAME below before running.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_og_meta_tags.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up about.html -> about.html.bak-ogtags first.

After running:
    bash setup-www.sh
    npx cap sync android
    git add about.html www/about.html og-image.png
    git commit -m "Add Open Graph preview tags"
    git push
"""
import os
import sys

# Change this to "og-image.jpg" if you're uploading a JPG instead.
OG_IMAGE_FILENAME = "og-image.png"

SITE_URL = "https://radharadharadha.vercel.app"
OG_TITLE = "Guru Kripahi Kevalam — Naam Jap & Prayer Counter"
OG_DESCRIPTION = "A naam-jap and prayer-counting app for daily spiritual practice in the Gaudiya Vaishnava tradition."

TARGET_FILES = ["about.html", os.path.join("www", "about.html")]


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def build_og_block():
    return f'''<meta property="og:type" content="website" />
<meta property="og:url" content="{SITE_URL}/" />
<meta property="og:title" content="{OG_TITLE}" />
<meta property="og:description" content="{OG_DESCRIPTION}" />
<meta property="og:image" content="{SITE_URL}/{OG_IMAGE_FILENAME}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{OG_TITLE}" />
<meta name="twitter:description" content="{OG_DESCRIPTION}" />
<meta name="twitter:image" content="{SITE_URL}/{OG_IMAGE_FILENAME}" />'''


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


def patch_file(path, og_block):
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if 'property="og:title"' in src:
        print(f"  {path}: Open Graph tags already present — skipping.")
        return False

    old = '<meta name="description" content="Guru Kripahi Kevalam (Radha Naam Jap) is a naam-jap and prayer-counting app for daily spiritual practice in the Gaudiya Vaishnava tradition.">'
    new = old + "\n" + og_block

    src = apply_edit(src, old, new, "insert Open Graph tags", path)

    with open(path + ".bak-ogtags", "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())

    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"  {path}: added Open Graph tags. Backup: {path}.bak-ogtags")
    return True


def main():
    cwd = os.getcwd()
    missing = [p for p in TARGET_FILES if not os.path.isfile(p)]
    if missing:
        die(
            f"Could not find: {', '.join(missing)} in the current directory "
            f"({cwd}).\nRun this script from your repo root, e.g.:\n"
            "  cd ~/Lalu-Chotopushu\n"
            "  python3 apply_og_meta_tags.py"
        )

    og_block = build_og_block()

    print("Patching Open Graph meta tags into:")
    any_applied = False
    for path in TARGET_FILES:
        if patch_file(path, og_block):
            any_applied = True

    if not os.path.isfile(OG_IMAGE_FILENAME):
        print("")
        print(f"⚠️  NOTE: {OG_IMAGE_FILENAME} was not found at the repo root.")
        print("   The meta tags now point to it, but until you add that file")
        print("   and deploy, the preview image won't actually show.")
        print(f"   Upload your 1200x630px image as: {OG_IMAGE_FILENAME}")
        print("   (or edit OG_IMAGE_FILENAME at the top of this script and re-run")
        print("   if your file is named differently / is a .jpg.)")

    if any_applied:
        print("")
        print("Next steps:")
        print("   bash setup-www.sh")
        print("   npx cap sync android")
        print("   git add about.html www/about.html " + OG_IMAGE_FILENAME)
        print('   git commit -m "Add Open Graph preview tags"')
        print("   git push")
    else:
        print("")
        print("Nothing to do — tags already present in all target files.")


if __name__ == "__main__":
    main()
