#!/usr/bin/env python3
"""
add-deity-first-photos.py

Bundles ONLY the first photo of every deity folder (deities/<slug>/) into the
Android app's www/ copy. All other photos, list.txt and audio.mp3 keep loading
from the website, exactly as before (deities/ itself is still NOT bundled).

"First photo" is decided the same way the app does it (ddDiscover in app.js):
  1. the first usable file name in deities/<slug>/list.txt, otherwise
  2. 1.jpg, 1.jpeg, 1.png, 1.webp (upper/lower-case) ...

Output (inside www/):
  deities-first/<slug>/<file>      the first photo, copied unchanged
  deities-first/manifest.js        window._DD_FIRST = { "<slug>": "<file>", ... }
and a <script> tag for manifest.js is added to www/index.html before app.js.

Run from the repo root after setup-www.sh (www/ must exist).
build-android.sh calls this when DEITY_FIRST=1.
"""
import json, os, re, shutil, sys

SRC = "deities"
WWW = "www"
OUT = os.path.join(WWW, "deities-first")
EXTS = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG", "WEBP"]   # same order as DD_EXTS in app.js
IMG_RE = re.compile(r"\.(jpe?g|png|webp)$", re.I)


def fail(msg):
    print("::error::" + msg)
    sys.exit(1)


def first_photo(folder):
    lp = os.path.join(folder, "list.txt")
    if os.path.isfile(lp):
        with open(lp, encoding="utf-8", errors="replace") as f:
            for line in f.read().splitlines():
                n = line.strip()
                if not n or n[0] == "#" or "/" in n or "\\" in n:
                    continue
                if IMG_RE.search(n) and os.path.isfile(os.path.join(folder, n)):
                    return n
                break          # app uses the first listed name; if it is unusable, fall back to 1.<ext>
    for e in EXTS:
        n = "1." + e
        if os.path.isfile(os.path.join(folder, n)):
            return n
    return None


def main():
    if not os.path.isdir(SRC):
        fail("deities/ folder not found in the repo - nothing to bundle.")
    if not os.path.isdir(WWW):
        fail("www/ not found - run setup-www.sh first.")

    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)

    manifest, total, skipped = {}, 0, []
    for slug in sorted(os.listdir(SRC)):
        folder = os.path.join(SRC, slug)
        if not os.path.isdir(folder) or slug.startswith("."):
            continue
        name = first_photo(folder)
        if not name:
            skipped.append(slug)
            continue
        dst = os.path.join(OUT, slug)
        os.makedirs(dst)
        shutil.copy2(os.path.join(folder, name), os.path.join(dst, name))
        total += os.path.getsize(os.path.join(dst, name))
        manifest[slug] = name

    if not manifest:
        fail("No first photos found under deities/ (expected 1.jpg/.png/.webp or a list.txt).")

    with open(os.path.join(OUT, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("window._DD_FIRST = " + json.dumps(manifest, ensure_ascii=False, sort_keys=True) + ";\n")

    # Load the manifest before app.js so ddPath() knows about it from the first call.
    ip = os.path.join(WWW, "index.html")
    html = open(ip, encoding="utf-8").read()
    tag = '<script src="./deities-first/manifest.js"></script>'
    if tag not in html:
        html2, n = re.subn(r'(<script src="\./app\.js)', tag + r"\n    \1", html, count=1)
        if n != 1:
            fail('could not find <script src="./app.js ...> in www/index.html to add the manifest.')
        open(ip, "w", encoding="utf-8").write(html2)

    mb = total / 1024 / 1024
    print("  bundled the first photo of %d deities = %.1f MB (in the base module)" % (len(manifest), mb))
    if skipped:
        print("  no photo found for: " + ", ".join(skipped) + " (they stay online-only)")
    big = sorted(((os.path.getsize(os.path.join(OUT, s, n)), s, n) for s, n in manifest.items()), reverse=True)[:3]
    for sz, s, n in big:
        print("  largest: %s/%s %.1f MB" % (s, n, sz / 1024 / 1024))
    if mb > 120:
        print("::warning::First photos add %.0f MB to the base module (limit ~200 MB). Consider resizing the biggest ones." % mb)


if __name__ == "__main__":
    main()
