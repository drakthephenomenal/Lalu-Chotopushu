#!/bin/bash
# ============================================================================
# build-apk-full.sh  -  FULL OFFLINE build
#
# Bundles ALL audio/, videos/, deities/ and stotram-live/ inside the APK and makes
# the app play them from inside the APK (works with no internet at all).
#
# Fixes over build-apk-full-offline.sh:
#   * the old script left  --exclude='/audio'  in setup-www.sh, so audio was never bundled
#   * the app silently redirects every audio/ URL to the website in the installed app;
#     this build switches that redirect off so bundled audio is really used
#
# One-off: patches scratch copies of setup-www.sh / build-android.sh, restores them after.
# Usage (repo root):  bash build-apk-full.sh [--keep]
# ============================================================================
set -e
[ -f setup-www.sh ] && [ -f build-android.sh ] || { echo "❌ Run from repo root."; exit 1; }
for d in audio videos deities; do
  [ -d "$d" ] || { echo "❌ Folder '$d/' is missing from the repo - nothing to bundle."; exit 1; }
done

B1="setup-www.sh.bak-$$"; B2="build-android.sh.bak-$$"
cp setup-www.sh "$B1"; cp build-android.sh "$B2"
restore() {
  mv "$B1" setup-www.sh; mv "$B2" build-android.sh
  echo "↩ Restored original setup-www.sh and build-android.sh"
  rm -rf www && bash setup-www.sh >/dev/null 2>&1 || true
}
trap restore EXIT

# 1. stop excluding the media folders (videos, deities, audio, stotram-live)
sed -i -e "/--exclude='videos'/d" \
       -e "/--exclude='deities'/d" \
       -e "/--exclude='\/audio'/d" \
       -e "/--exclude='stotram-live'/d" \
       -e "/^rm -rf www\/deities/d" setup-www.sh
grep -q "exclude='/audio'" setup-www.sh && { echo "❌ audio exclude still present in setup-www.sh"; exit 1; }

# 2. after www/ is built: point everything at the bundled copies (www/app.js only; repo untouched)
cat >> setup-www.sh <<'EOS'

python3 - <<'PYEOF'
import re, sys
p = 'www/app.js'
s = open(p, encoding='utf-8').read()
def rep(old, new, label, regex=False):
    global s
    if regex: s2, n = re.subn(old, new, s)
    else: n = s.count(old); s2 = s.replace(old, new)
    if n < 1: sys.exit("PATTERN NOT FOUND (app.js changed?): " + label)
    s = s2; print("patched:", label)
# a) videos: local manifest + local files
rep(r"const FAVVID_MANIFEST_URL = [^;]*;", "const FAVVID_MANIFEST_URL = './videos/manifest.json';", 'video manifest local', True)
rep("'https://raw.githubusercontent.com/' + FAVVID_GH_OWNER + '/' + FAVVID_GH_REPO + '/' + FAVVID_GH_BRANCH + '/' + sub.path", "'./' + sub.path", 'video files local')
# b) deities: local photos
rep("ddNative() ? RJAP_PWA_URL.replace(/\\/$/, '') + '/deities/' : './deities/'", "'./deities/'", 'deities local')
# c) audio: switch OFF the redirect that points every audio/ URL at the website in the installed app
rep("if (!_nat) return;\n    var base = RJAP_PWA_URL", "return; /* FULL build: audio is bundled - never redirect to the website */\n    var base = RJAP_PWA_URL", 'audio redirect off')
open(p, 'w', encoding='utf-8').write(s)
PYEOF

test -f www/audio/gsn_full.mp3 || { echo "❌ audio/gsn_full.mp3 missing from www/ - audio was not bundled"; exit 1; }
du -sh www/audio www/videos www/deities 2>/dev/null
EOS

rm -rf www
bash build-android.sh "$@"

APK=android/app/build/outputs/apk/release/app-release.apk
if [ -f "$APK" ]; then
  MB=$(du -m "$APK" | cut -f1)
  echo ""; echo "✅ FULL OFFLINE APK: ${MB} MB  ($APK)"
  [ "$MB" -le 2000 ] && echo "   fits a GitHub release (limit 2 GB)" || echo "   ⚠ over 2 GB - too big for a GitHub release asset"
fi
