#!/bin/bash
# ============================================================================
# build-apk-lite.sh  -  LITE build, target: APK under 100 MB
#
# Bundled in the APK : all stotram text, app code and ALL image folders at full quality
# Loaded online      : audio, videos, deity photos, bhagavadik-bank.png (saved on the phone
#                      after the first view)
# Also               : 64-bit + 32-bit ARM phones (no x86). Images are NOT shrunk.
#
# One-off: patches scratch copies of setup-www.sh / build-android.sh and restores them after.
# Usage (repo root):  bash build-apk-lite.sh [--keep]
# ============================================================================
set -e
export GRADLE_HEAP_MAX_MB=${GRADLE_HEAP_MAX_MB:-3072}
[ -f setup-www.sh ] && [ -f build-android.sh ] && [ -f lite-postprocess.py ] || { echo "❌ Run from repo root (setup-www.sh, build-android.sh, lite-postprocess.py needed)."; exit 1; }

B1="setup-www.sh.bak-$$"; B2="build-android.sh.bak-$$"
cp setup-www.sh "$B1"; cp build-android.sh "$B2"
restore() {
  mv "$B1" setup-www.sh; mv "$B2" build-android.sh
  echo "↩ Restored original setup-www.sh and build-android.sh"
  rm -rf www && bash setup-www.sh >/dev/null 2>&1 || true
}
trap restore EXIT

# 1. after www/ is built: drop/shrink/redirect images (www/ only; repo untouched)
cat >> setup-www.sh <<'EOS'

python3 lite-postprocess.py || { echo "❌ lite post-process failed"; exit 1; }
EOS

# 2. 64-bit + 32-bit phones; drops x86/x86_64 (emulator-only) native code to save space
python3 - <<'PYEOF'
p = 'build-android.sh'
s = open(p, encoding='utf-8').read()
anchor = "cd android\n./gradlew assembleRelease"
if anchor not in s:
    raise SystemExit("PATTERN NOT FOUND in build-android.sh (gradle step changed?)")
patch = '''python3 - <<'GRADLE'
import re
p = "android/app/build.gradle"
c = open(p).read()
if "abiFilters" not in c:
    c = c.replace("defaultConfig {", "defaultConfig {\\n        ndk { abiFilters 'arm64-v8a', 'armeabi-v7a' }\\n        resConfigs 'en'", 1)
    open(p, "w").write(c)
    print("  LITE: arm64-v8a + armeabi-v7a (64 + 32 bit phones, no x86 emulator code)")
GRADLE
'''
s = s.replace(anchor, patch + anchor, 1)
open(p, 'w', encoding='utf-8').write(s)
PYEOF

rm -rf www
bash build-android.sh "$@"

APK=android/app/build/outputs/apk/release/app-release.apk
if [ -f "$APK" ]; then
  MB=$(du -m "$APK" | cut -f1)
  echo ""; echo "✅ LITE APK: ${MB} MB  ($APK)"
  [ "$MB" -le 100 ] && echo "   under 100 MB 🎉" || echo "   ⚠ over 100 MB - tell me the number and I will trim further"
fi
