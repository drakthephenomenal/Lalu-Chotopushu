#!/bin/bash
# build-full.sh - FULL build: one run -> two files
#   dist/RadhaNaamJap-full.aab  Play AAB: audio + videos in asset packs, deities = first photo only
#   dist/RadhaNaamJap-full.apk  APK for phones: audio + videos + all photos, deities = first photo only
set -e
[ -f setup-www.sh ] && [ -f build-android.sh ] || { echo "❌ Run from repo root."; exit 1; }
[ -d audio ] || { echo "❌ audio/ folder missing - nothing to bundle."; exit 1; }
[ -d videos ] || echo "⚠ videos/ folder missing - building without videos."
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
open(p, 'w', encoding='utf-8').write(s)
q = 'www/native-online-media.js'
if os.path.exists(q):
    t = open(q, encoding='utf-8').read()
    if 'if (!native) return;' in t:
        open(q, 'w', encoding='utf-8').write(t.replace('if (!native) return;', 'return; /* FULL: photos are bundled */', 1)); print('patched: photos local')
if mode == 'apk':
    if not os.path.isdir('www/audio') or not os.listdir('www/audio'): sys.exit("❌ audio was not bundled into www/")
else:
    if os.path.exists('www/audio'): sys.exit("❌ www/audio must not exist in the AAB pass")
PY

# ---------- helper 3: splits audio/videos/deities into install-time asset packs ----------
cat > "$TMPD/packs.py" <<'PY'
import os, sys, re
MAXPACK = 1300 * 1024 * 1024
MAXTOTAL = 3600 * 1024 * 1024
files = []
for d in ('audio', 'videos'):
    for r, ds, fs in os.walk(d):
        ds[:] = [x for x in ds if not x.startswith('.') and x != '__MACOSX']
        for f in fs:
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
export DEITY_FIRST=1   # only the FIRST photo of each deity is packed, the rest load online

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
