#!/bin/bash
set -e
ORIG="app.vercel.radharadharadha.capacitor"
LITE="${LITE_APP_ID:-$ORIG.lite}"
SITE="https://radharadharadha.vercel.app/"
for f in setup-www.sh build-android.sh capacitor.config.json lite-prune.sh lite-post.py lite-shim.js; do
  [ -f "$f" ] || { echo "MISSING $f"; exit 1; }
done
if [ "$LITE" != "$ORIG" ] && ! grep -q "\"package_name\": *\"$LITE\"" google-services.json; then
  echo "STOP: $LITE is not in google-services.json."
  echo "Add it in Firebase (package + SHA-1 + SHA-256), put the new google-services.json in the repo root."
  echo "Quick test with the current id: LITE_APP_ID=$ORIG bash build-lite.sh"
  exit 1
fi
cp setup-www.sh .lite.bak.setup; cp capacitor.config.json .lite.bak.cap
trap 'mv -f .lite.bak.setup setup-www.sh || true; mv -f .lite.bak.cap capacitor.config.json || true; rm -rf www .lite-dirs.txt; echo "Restored original files"' EXIT
sed -i "s|\"appId\": *\"[^\"]*\"|\"appId\": \"$LITE\"|; s|\"appName\": *\"[^\"]*\"|\"appName\": \"RadhaNaam Lite\"|" capacitor.config.json
printf '\nbash lite-prune.sh "%s"\n' "$SITE" >> setup-www.sh
rm -rf www
bash build-android.sh
mkdir -p lite-out
cp android/app/build/outputs/apk/release/app-release.apk lite-out/RadhaNaamLite.apk
cp android/app/build/outputs/bundle/release/app-release.aab lite-out/RadhaNaamLite.aab
grep -qx 'lite-out/' .gitignore 2>/dev/null || echo 'lite-out/' >> .gitignore
echo "DONE ($LITE)"; ls -lh lite-out
