#!/bin/bash
# build-full.sh - FULL build: one run -> two files
#   dist/RadhaNaamJap-full.aab  Play AAB: audio + videos + ALL deity photos in install-time asset packs
#   dist/RadhaNaamJap-full.apk  APK for phones: audio + videos + ALL photos (deities too) inside the APK
# Nothing the app loads at runtime stays online. Secrets (keystore, firestore.rules, functions),
# dev scripts, source zips and store screenshots are never packed.
set -e
[ -f setup-www.sh ] && [ -f build-android.sh ] || { echo "❌ Run from repo root."; exit 1; }
[ -d audio ] || { echo "❌ audio/ folder missing - nothing to bundle."; exit 1; }
[ -d videos ] || echo "⚠ videos/ folder missing - building without videos."
[ -d deities ] || { echo "❌ deities/ folder missing - Full must bundle every deity photo."; exit 1; }
mkdir -p dist
TMPD="$(mktemp -d)"
VER0=$(grep -E '^[0-9]+$' .app-version | sort -n | tail -1)

# ---------- helper 1: patches the scratch copy of setup-www.sh ----------
cat > "$TMPD/patch_setup.py" <<'PY'
import os, re
mode = os.environ['MODE']
photo = re.compile(r"--exclude='/(sampraday|gurudev|hitju_maharaj|radha_vallabh|rashikan|iskcon_\*|ramanuj_\*|vallabh_\*|nimbark_\*|ramanandi_\*|haridashi_\*|gopeshwar_\*|bhagavadik-bank\.png)'")
out, done_audio = [], False
for l in open('setup-www.sh', encoding='utf-8').read().split('\n'):
    t = l.strip()
    if photo.search(t): continue
    if t.startswith("--include='/audio") or t == "--exclude='/audio/*'":
        if mode == 'aab' and not done_audio:
            out.append("  --exclude='/audio'"); done_audio = True
        continue
    if mode == 'apk' and t == "--exclude='videos'": continue
    if mode == 'apk' and (t == "--exclude='deities'" or t.startswith('rm -rf www/deities')): continue   # FULL apk: deities are packed
    out.append(l)
s = '\n'.join(out)
s += '\npython3 "$TMPD/post.py" || { echo "❌ full post-process failed"; exit 1; }\n'
open('setup-www.sh', 'w', encoding='utf-8').write(s)
PY

# ---------- helper 2: runs on www/ after it is built (repo untouched) ----------
cat > "$TMPD/post.py" <<'PY'
import os, re, sys
mode = os.environ['MODE']
p = 'www/app.js'; s = open(p, encoding='utf-8').read()
def rep(old, new, label, regex=False, need=1):
    global s
    s2, n = (re.subn(old, new, s) if regex else (s.replace(old, new), s.count(old)))
    if n < need: sys.exit("PATTERN NOT FOUND (app.js changed?): " + label)
    s = s2; print("patched:", label, n)
rep(r"const FAVVID_MANIFEST_URL = [^;]*;", "const FAVVID_MANIFEST_URL = './videos/manifest.json';", 'video manifest local', True)
rep("'https://raw.githubusercontent.com/' + FAVVID_GH_OWNER + '/' + FAVVID_GH_REPO + '/' + FAVVID_GH_BRANCH + '/' + sub.path", "'./' + sub.path", 'favourite videos local')
rep(r'"https://raw\.githubusercontent\.com/" \+ FAVVID_GH_OWNER \+ "/" \+ FAVVID_GH_REPO \+ "/" \+ FAVVID_GH_BRANCH \+\s*"/videos/', '"./videos/', 'padavali + guru-vandana videos local', True, 2)
rep("if (!_nat) return;\n    var base = RJAP_PWA_URL", "return; /* FULL build: audio is bundled */\n    var base = RJAP_PWA_URL", 'audio redirect off')
# ---- deities: read everything from the app itself, not from the website ----
rep(r"function ddBase() { return ddNative() ? RJAP_PWA_URL.replace(/\/$/, '') + '/deities/' : './deities/'; }",
    "function ddBase() { return './deities/'; }", 'deities base local')
rep("function ddMan(slug) {\n  const i = ddInfoAll()[slug];",
    "function ddMan(slug) {\n  if (window._DD_ALL && window._DD_ALL[slug]) return { photos: window._DD_ALL[slug].p, audio: window._DD_ALL[slug].a };\n  const i = ddInfoAll()[slug];", 'ddMan uses bundled manifest')
rep("async function ddDiscover(slug, full) {\n",
    "async function ddDiscover(slug, full) {\n  if (window._DD_ALL && window._DD_ALL[slug]) { const x = window._DD_ALL[slug]; return { changed: false, photos: x.p, audio: x.a }; }   /* FULL: photo list is baked in, works offline */\n", 'ddDiscover offline-safe')
open(p, 'w', encoding='utf-8').write(s)
# manifest of every deity photo/audio, built from the repo's deities/ folder
import json
IMG = re.compile(r'\.(jpe?g|png|webp)$', re.I)
EXTS = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP']
man, nophoto = {}, []
for slug in sorted(os.listdir('deities')):
    d = os.path.join('deities', slug)
    if not os.path.isdir(d) or slug.startswith('.'): continue
    photos = []
    lp = os.path.join(d, 'list.txt')
    if os.path.isfile(lp):
        for line in open(lp, encoding='utf-8', errors='replace').read().splitlines():
            n = line.strip()
            if not n or n[0] == '#' or '/' in n or '\\' in n: continue
            if IMG.search(n) and os.path.isfile(os.path.join(d, n)): photos.append(n)
    if not photos:
        for k in range(1, 41):
            hit = next((str(k) + '.' + e for e in EXTS if os.path.isfile(os.path.join(d, str(k) + '.' + e))), None)
            if not hit: break
            photos.append(hit)
    if not photos: nophoto.append(slug)
    man[slug] = {'p': photos, 'a': 'audio.mp3' if os.path.isfile(os.path.join(d, 'audio.mp3')) else None}
open('www/dd-all-manifest.js', 'w', encoding='utf-8').write('window._DD_ALL = ' + json.dumps(man, ensure_ascii=False, sort_keys=True) + ';\n')
ip = 'www/index.html'; html = open(ip, encoding='utf-8').read()
tag = '<script src="./dd-all-manifest.js"></script>'
if tag not in html:
    html, n = re.subn(r'(<script src="\./app\.js)', tag + r'\n    \1', html, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND: <script src="./app.js in www/index.html')
    open(ip, 'w', encoding='utf-8').write(html)
print('deities: %d folders, %d photos in manifest' % (len(man), sum(len(v['p']) for v in man.values())))
if nophoto: print('::warning::no photo found for: ' + ', '.join(nophoto))
q = 'www/native-online-media.js'
if os.path.exists(q):
    t = open(q, encoding='utf-8').read()
    if 'if (!native) return;' in t:
        open(q, 'w', encoding='utf-8').write(t.replace('if (!native) return;', 'return; /* FULL: photos are bundled */', 1)); print('patched: photos local')
if mode == 'apk':
    if not os.path.isdir('www/audio') or not os.listdir('www/audio'): sys.exit("❌ audio was not bundled into www/")
    if not os.path.isdir('www/deities'): sys.exit("❌ deities/ was not bundled into www/")
else:
    if os.path.exists('www/audio'): sys.exit("❌ www/audio must not exist in the AAB pass")
    if os.path.exists('www/deities'): sys.exit("❌ www/deities must not exist in the AAB pass (it goes into an asset pack)")
PY

# ---------- helper 3: splits audio/videos/deities into install-time asset packs ----------
cat > "$TMPD/packs.py" <<'PY'
import os, sys, re
MAXPACK = 1300 * 1024 * 1024
MAXTOTAL = 3600 * 1024 * 1024
files = []
for d in ('audio', 'videos', 'deities'):
    for r, ds, fs in os.walk(d):
        ds[:] = [x for x in ds if not x.startswith('.') and x != '__MACOSX']
        for f in fs:
            if d == 'deities' and r == 'deities': continue      # admin app.js / index.html next to the folders
            if f.startswith('.') or f.startswith('._'): continue
            fp = os.path.join(r, f); files.append((fp, os.path.getsize(fp)))
files.sort()
packs, cur, size = [], [], 0
for fp, sz in files:
    if sz > MAXPACK: sys.exit("::error::%s is bigger than one asset pack allows" % fp)
    if size + sz > MAXPACK and cur: packs.append(cur); cur, size = [], 0
    cur.append((fp, sz)); size += sz
if cur: packs.append(cur)
total = sum(sz for _, sz in files)
print("  media: %d files, %d MB -> %d asset pack(s)" % (len(files), total // 1048576, len(packs)))
if total > MAXTOTAL:
    sys.exit("::error::media is %d MB - over what Play allows (about 3.6 GB with the app). Leave some audio/video out." % (total // 1048576))
names = []
for i, pk in enumerate(packs, 1):
    name = "media_%d" % i; names.append(name)
    base = "android/%s/src/main/assets/public" % name
    for fp, _ in pk:
        dst = os.path.join(base, fp); os.makedirs(os.path.dirname(dst), exist_ok=True)
        try: os.link(fp, dst)
        except OSError:
            import shutil; shutil.copy2(fp, dst)
    open("android/%s/build.gradle" % name, "w").write(
        "apply plugin: 'com.android.asset-pack'\n\nassetPack {\n    packName = \"%s\"\n    dynamicDelivery {\n        deliveryType = \"install-time\"\n    }\n}\n" % name)
    print("  %s: %d files, %d MB" % (name, len(pk), sum(s for _, s in pk) // 1048576))
st = open("android/settings.gradle", encoding="utf-8").read()
for n in names:
    if "':%s'" % n not in st: st += "\ninclude ':%s'\n" % n
open("android/settings.gradle", "w", encoding="utf-8").write(st)
p = "android/app/build.gradle"; t = open(p, encoding="utf-8").read()
lst = "[" + ", ".join('":%s"' % n for n in names) + "]"
t2, n = re.subn(r"(^android\s*\{\s*\n)", r"\1    assetPacks = " + lst + "\n", t, count=1, flags=re.M)
if n != 1: sys.exit("::error::android { block not found in app/build.gradle")
open(p, "w", encoding="utf-8").write(t2)
PY

# ---------- run the two passes ----------
B1="setup-www.sh.bak-$$"; B2="build-android.sh.bak-$$"
cp setup-www.sh "$B1"; cp build-android.sh "$B2"
restore() { mv -f "$B1" setup-www.sh; mv -f "$B2" build-android.sh; rm -rf "$TMPD"; echo "↩ restored setup-www.sh and build-android.sh"; }
trap restore EXIT
export TMPD
unset DEITY_FIRST || true   # FULL: every deity photo is packed (not just the first)

run_pass() {   # $1 = apk | aab
  local MODE="$1" TASK
  [ "$MODE" = apk ] && TASK="assembleRelease" || TASK="bundleRelease"
  echo ""; echo "════════ PASS: $MODE ($TASK) ════════"
  cp "$B1" setup-www.sh; cp "$B2" build-android.sh
  MODE="$MODE" python3 "$TMPD/patch_setup.py"
  sed -i "s/assembleRelease bundleRelease/$TASK/g" build-android.sh
  if [ "$MODE" = aab ]; then
    sed -i 's|bash add-audio-pack.sh|python3 "$TMPD/packs.py"|' build-android.sh
    grep -q 'packs.py' build-android.sh || { echo "❌ audio-pack hook not found in build-android.sh"; exit 1; }
    export AUDIO_PACK=1
  else
    unset AUDIO_PACK || true
  fi
  echo "$VER0" > .app-version          # both files get the same versionCode
  rm -rf www android
  MODE="$MODE" bash build-android.sh
}

run_pass apk
cp android/app/build/outputs/apk/release/app-release.apk dist/RadhaNaamJap-full.apk
rm -rf android www

run_pass aab
cp android/app/build/outputs/bundle/release/app-release.aab dist/RadhaNaamJap-full.aab

echo ""; echo "✅ FULL build done:"; ls -lh dist/
