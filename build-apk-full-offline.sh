#!/bin/bash
# ONE-OFF: bundle ALL audio + videos + deities into the APK for offline use.
# (Gopal Sahastranaam / Ehi Murare / Nirvana Shatkam now live in stotrams.js; the Gopal audio is audio/gsn_full.mp3)
set -e
[ -f setup-www.sh ] && [ -f build-android.sh ] || { echo "Run from repo root"; exit 1; }
B1="setup-www.sh.bak-$$"; B2="build-android.sh.bak-$$"
cp setup-www.sh "$B1"; cp build-android.sh "$B2"
restore() {
  mv "$B1" setup-www.sh; mv "$B2" build-android.sh
  echo "Restored original setup-www.sh and build-android.sh"
  rm -rf www && bash setup-www.sh >/dev/null 2>&1 || true   # slim www/ again for the next normal build
}
trap restore EXIT

# 1. more Gradle heap for the big asset set (this build only)
sed -i 's/-Xmx3072m/-Xmx4096m/' build-android.sh

# 2. stop excluding the media folders
sed -i -e "/--exclude='videos'/d" -e "/--exclude='deities'/d" -e "/--exclude='stotram-live'/d" -e "/^rm -rf www\/deities/d" setup-www.sh

# 3. after www/ is built, point native at the bundled copies (www/app.js only; repo source untouched)
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
rep(r"const FAVVID_MANIFEST_URL = [^;]*;", "const FAVVID_MANIFEST_URL = './videos/manifest.json';", 'video manifest local', True)
rep("'https://raw.githubusercontent.com/' + FAVVID_GH_OWNER + '/' + FAVVID_GH_REPO + '/' + FAVVID_GH_BRANCH + '/' + sub.path", "'./' + sub.path", 'video files local')
rep("ddNative() ? RJAP_PWA_URL.replace(/\\/$/, '') + '/deities/' : './deities/'", "'./deities/'", 'deities local')
open(p, 'w', encoding='utf-8').write(s)
PYEOF
test -f www/audio/gsn_full.mp3 || { echo "Gopal audio (audio/gsn_full.mp3) missing from www/"; exit 1; }
du -sh www/audio www/videos www/deities 2>/dev/null
EOS

rm -rf www
bash build-android.sh "$@"
