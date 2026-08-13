#!/bin/bash
set -e
ROOT="/workspaces/Lalu-Chotopushu"

echo "=== keystore.properties files found ==="
find "$ROOT" -iname "keystore.properties" | while read -r f; do
  echo "--- $f ---"
  sed 's/=.*/=[hidden]/' "$f"
done

echo ""
echo "=== Expected fingerprint (v1.0.52) ==="
echo "SHA256: f1:e7:05:95:99:f5:3f:70:86:01:dc:0d:55:50:ff:f4:c3:b7:4a:df:17:08:03:cf:0d:38:6a:54:2d:86:15:f2"

echo ""
echo "=== Building release ==="
cd "$ROOT"
npx cap copy android
cd android
./gradlew clean assembleRelease

echo ""
echo "=== Actual signing cert on the BUILT APK ==="
APK=$(find app/build/outputs/apk/release -name "*.apk" | head -1)
echo "APK: $APK"
apksigner verify --print-certs "$APK" | grep -i sha256
