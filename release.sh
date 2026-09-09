#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: bash release.sh \"release notes here\""
  exit 1
fi
NOTES="$1"

echo "▶ Bumping versionCode / versionName in build.gradle..."
OLD_CODE=$(grep -oE "versionCode [0-9]+" android/app/build.gradle | awk '{print $2}')
NEW_CODE=$((OLD_CODE + 1))
sed -i "s/versionCode $OLD_CODE/versionCode $NEW_CODE/" android/app/build.gradle
sed -i "s/versionName \"1.0.$OLD_CODE\"/versionName \"1.0.$NEW_CODE\"/" android/app/build.gradle
echo 90 > /dev/null # no-op placeholder
echo "$NEW_CODE" > .app-version
echo "  versionCode: $OLD_CODE → $NEW_CODE"
echo "  versionName: 1.0.$OLD_CODE → 1.0.$NEW_CODE"

echo "▶ Bumping sw.js cache version..."
SW_CURRENT=$(grep -oE "radha-jap-v[0-9]+" sw.js | grep -oE "[0-9]+")
SW_NEXT=$((SW_CURRENT + 1))
sed -i "s/radha-jap-v$SW_CURRENT/radha-jap-v$SW_NEXT/" sw.js
echo "  sw.js cache: v$SW_CURRENT → v$SW_NEXT"

echo "▶ Building Android app..."
bash build-android.sh

echo "▶ Renaming APK for release..."
cp android/app/build/outputs/apk/release/app-release.apk RadhaNaamJap.apk

echo "▶ Committing version bump to repo..."
git add -f android/app/build.gradle
git add .app-version sw.js index.html
git commit -m "Bump to v1.0.$NEW_CODE — $NOTES"
git push origin main

echo "▶ Creating GitHub release..."
gh release create "v1.0.$NEW_CODE" RadhaNaamJap.apk \
  --title "RadhaNaamJap v1.0.$NEW_CODE" \
  --notes "versionCode $NEW_CODE — $NOTES"

echo "✅ Released v1.0.$NEW_CODE (versionCode $NEW_CODE, sw.js cache v$SW_NEXT)"
