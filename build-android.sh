#!/bin/bash
# ============================================================================
# build-android.sh
#
# One-command Android build that survives a full `android/` wipe/regenerate.
# Run this instead of `npm run build:apk` directly — it re-applies every
# native-side patch this project needs before compiling, in the right order.
#
# Usage:
#   bash build-android.sh          # fresh android/ + full build
#   bash build-android.sh --keep   # skip regenerating android/ if it exists
# ============================================================================
set -e

JAVA_VER="21.0.5-tem"
KEEP_ANDROID=false
[ "$1" = "--keep" ] && KEEP_ANDROID=true

echo "── 1/9  npm install ────────────────────────────────────────────"
npm install

echo "── 2/9  Ensure JDK $JAVA_VER is active ─────────────────────────"
if command -v sdk >/dev/null 2>&1 || [ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]; then
  source "$HOME/.sdkman/bin/sdkman-init.sh" 2>/dev/null || true
  sdk install java "$JAVA_VER" < /dev/null || true
  sdk use java "$JAVA_VER"
else
  echo "  ⚠ sdkman not found — make sure 'java -version' shows 21.x before continuing."
fi
java -version

echo "── 3/9  (Re)generate native android/ project ───────────────────"
if [ "$KEEP_ANDROID" = true ] && [ -d "android" ]; then
  echo "  --keep passed, leaving existing android/ folder as-is."
else
  rm -rf android
  npx cap add android
fi

echo "── 4/9  Copy web assets + sync plugins ──────────────────────────"
bash setup-www.sh
npx cap sync android

echo "── 5/9  Restore google-services.json ────────────────────────────"
if [ -f "google-services.json" ]; then
  cp google-services.json android/app/google-services.json
elif git show HEAD:android/app/google-services.json > /tmp/gsj 2>/dev/null; then
  cp /tmp/gsj android/app/google-services.json
else
  echo "  ⚠ google-services.json not found at repo root or in git history."
  echo "    Download it from Firebase Console → Project settings → your Android app,"
  echo "    save it as android/app/google-services.json, then re-run this script."
  exit 1
fi

echo "── 6/9  Generate app icon + splash from resources/icon.png ─────"
if [ -f "resources/icon.png" ]; then
  npx capacitor-assets generate --android
else
  echo "  (skipped — resources/icon.png not found)"
fi

echo "── 7/9  Patch AndroidManifest.xml (location permissions) ───────"
MANIFEST="android/app/src/main/AndroidManifest.xml"
if ! grep -q "ACCESS_FINE_LOCATION" "$MANIFEST"; then
  sed -i 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />|' "$MANIFEST"
  echo "  added ACCESS_COARSE_LOCATION / ACCESS_FINE_LOCATION"
else
  echo "  already present"
fi

echo "── 8/9  Patch MainActivity.java (fix native text zoom) ──────────"
MAIN_ACTIVITY=$(find android/app/src/main/java -name "MainActivity.java")
PKG_LINE=$(head -1 "$MAIN_ACTIVITY")
cat > "$MAIN_ACTIVITY" << EOF
$PKG_LINE

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        this.bridge.getWebView().getSettings().setTextZoom(100);
    }
}
EOF
echo "  MainActivity.java rewritten with setTextZoom(100) fix"

echo "── 9/9  Patch native dependency fixes ───────────────────────────"
# Google Sign-In needs play-services-auth explicitly (FirebaseAuthentication
# plugin's GoogleAuthProviderHandler references it but doesn't declare it).
APP_GRADLE="android/app/build.gradle"
if ! grep -q "play-services-auth" "$APP_GRADLE"; then
  sed -i '/dependencies {/a\    implementation "com.google.android.gms:play-services-auth:21.2.0"' "$APP_GRADLE"
  echo "  added play-services-auth to app/build.gradle"
else
  echo "  play-services-auth already present"
fi

# @capacitor/background-runner's own build.gradle fails to resolve
# compileSdkVersion from the root project — hardcode it to match variables.gradle.
BR_GRADLE="node_modules/@capacitor/background-runner/android/build.gradle"
if [ -f "$BR_GRADLE" ]; then
  sed -i "s|compileSdk project.hasProperty('compileSdkVersion') ? rootProject.ext.compileSdkVersion : 35|compileSdk 34|" "$BR_GRADLE"
  echo "  patched background-runner compileSdk"

  # background-runner ships its JS-engine .aar inside its own package, but
  # cap sync doesn't copy it to where Gradle's flatDir repo expects it.
  mkdir -p android/capacitor-cordova-android-plugins/src/main/libs
  cp "node_modules/@capacitor/background-runner/android/src/main/libs/android-js-engine-release.aar" \
     "android/capacitor-cordova-android-plugins/src/main/libs/android-js-engine-release.aar"
  echo "  copied android-js-engine-release.aar"
fi

echo ""
echo "── Building APK ──────────────────────────────────────────────"
cd android
./gradlew assembleDebug --no-daemon
cd ..

echo ""
echo "✅ Done. APK at: android/app/build/outputs/apk/debug/app-debug.apk"
echo "   To download it: cd android/app/build/outputs/apk/debug && python3 -m http.server 8080"
