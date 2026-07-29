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

echo "── Ensure Android SDK is installed ─────────────────────────────"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
if [ ! -d "$ANDROID_SDK_ROOT/cmdline-tools/latest" ]; then
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  curl -sSL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q -o /tmp/cmdline-tools.zip -d "$ANDROID_SDK_ROOT/cmdline-tools"
  mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
fi
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"
yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" > /dev/null

echo "── 3/9  (Re)generate native android/ project ───────────────────"
if [ "$KEEP_ANDROID" = true ] && [ -d "android" ]; then
  echo "  --keep passed, leaving existing android/ folder as-is."
else
  rm -rf android
  npx cap add android
fi

# -- Auto-bump versionName/versionCode on every build --
# android/build.gradle gets regenerated from scratch above (rm -rf android),
# so nothing set on it survives on its own. This counter file lives at the
# repo ROOT (not inside android/) specifically so it survives that wipe and
# keeps counting up across every build, without needing a manual sed first.
VERSION_FILE=".app-version"
if [ ! -f "$VERSION_FILE" ]; then echo 7 > "$VERSION_FILE"; fi
NEXT_VERSION_CODE=$(( $(cat "$VERSION_FILE") + 1 ))
echo "$NEXT_VERSION_CODE" > "$VERSION_FILE"
NEXT_VERSION_NAME="1.0.$NEXT_VERSION_CODE"
sed -i -E "s/versionCode [0-9]+/versionCode $NEXT_VERSION_CODE/" android/app/build.gradle
sed -i -E "s/versionName \"[^\"]*\"/versionName \"$NEXT_VERSION_NAME\"/" android/app/build.gradle
echo "  bumped to versionCode $NEXT_VERSION_CODE / versionName $NEXT_VERSION_NAME"

echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties

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

echo "── 6.5/9  Install notification icon + reminder tone ─────────────"
# android/ is wiped and regenerated from scratch every run (see header), so
# anything hand-copied straight into android/app/src/main/res/ does NOT
# survive a rebuild — that's exactly what silently broke the notification
# icon and custom tone before. Fixed the same way this script already
# handles google-services.json and PowerPermissionsPlugin.java: keep the
# real files tracked in git at the repo root, and re-copy them into the
# fresh android/ project on every single build.
#
# ic_notification.png (drawable, referenced in code as "ic_stat_notify")
# and reminder_tone.mp3 (raw, referenced as "reminder_tone") must stay
# committed at the repo root for this to work — see app.js's
# lcSetupNotifChannel()/lcScheduleDailyReminder() for where those names
# are referenced.
if [ -f "ic_notification.png" ]; then
  mkdir -p android/app/src/main/res/drawable
  cp ic_notification.png android/app/src/main/res/drawable/ic_stat_notify.png
  echo "  installed ic_stat_notify.png (notification small icon)"
else
  echo "  ⚠ ic_notification.png not found at repo root — notification icon will fall back to system default."
fi
if [ -f "reminder_tone.mp3" ]; then
  mkdir -p android/app/src/main/res/raw
  cp reminder_tone.mp3 android/app/src/main/res/raw/reminder_tone.mp3
  echo "  installed reminder_tone.mp3 (notification sound)"
else
  echo "  ⚠ reminder_tone.mp3 not found at repo root — notifications will fall back to the default system sound."
fi

echo "── 7/9  Patch AndroidManifest.xml (location permissions) ───────"
MANIFEST="android/app/src/main/AndroidManifest.xml"
if ! grep -q "ACCESS_FINE_LOCATION" "$MANIFEST"; then
  sed -i 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />|' "$MANIFEST"
  echo "  added ACCESS_COARSE_LOCATION / ACCESS_FINE_LOCATION"
else
  echo "  already present"
fi

echo "── 7.5/9  Patch AndroidManifest.xml (OAuth redirect deep link) ──"
python3 - << 'PYEOF'
path = "android/app/src/main/AndroidManifest.xml"
with open(path) as f:
    content = f.read()

if "app.vercel.radharadharadha.capacitor\"" in content and "oauthredirect" in content:
    print("  already present")
else:
    # This is the missing piece that made Zoho sign-in (and later, Google
    # Drive backup) never actually complete in real builds: the JS side
    # opens a browser and waits for an appUrlOpen event, but without this
    # intent-filter Android has no registered claim on the redirect URL,
    # so the OS never hands control back to the app at all — no error,
    # it just silently never returns. oauthredirect.html (hosted on
    # Vercel) forwards Zoho's/Google's callback to
    # app.vercel.radharadharadha.capacitor://oauthredirect, which is what
    # this intent-filter catches.
    deep_link_filter = (
        '        <intent-filter android:autoVerify="false">\n'
        '            <action android:name="android.intent.action.VIEW" />\n'
        '            <category android:name="android.intent.category.DEFAULT" />\n'
        '            <category android:name="android.intent.category.BROWSABLE" />\n'
        '            <data android:scheme="app.vercel.radharadharadha.capacitor" android:host="oauthredirect" />\n'
        '        </intent-filter>\n'
    )
    marker = "</intent-filter>"
    idx = content.find(marker)
    if idx == -1:
        raise SystemExit("Could not find </intent-filter> anchor in AndroidManifest.xml — manifest structure may have changed.")
    insert_at = idx + len(marker)
    content = content[:insert_at] + "\n" + deep_link_filter + content[insert_at:]
    with open(path, "w") as f:
        f.write(content)
    print("  added custom-scheme deep link intent-filter (app.vercel.radharadharadha.capacitor://oauthredirect)")
PYEOF

echo "── 8/9  Patch MainActivity.java (text zoom fix + register PowerPermissions plugin) ──────────"
MAIN_ACTIVITY=$(find android/app/src/main/java -name "MainActivity.java")
MAIN_ACTIVITY_DIR=$(dirname "$MAIN_ACTIVITY")
PKG_LINE=$(head -1 "$MAIN_ACTIVITY")

# `android/` is wiped and regenerated from scratch every run (see header),
# so any hand-edited or hand-uploaded native files under android/ do NOT
# survive a build. PowerPermissionsPlugin.java is kept as a permanent copy
# at android-src/PowerPermissionsPlugin.java (tracked in git) and reinstalled
# here on every build, right next to the fresh MainActivity.java.
cp "android-src/PowerPermissionsPlugin.java" "$MAIN_ACTIVITY_DIR/PowerPermissionsPlugin.java"
echo "  installed PowerPermissionsPlugin.java"

cat > "$MAIN_ACTIVITY" << EOF
$PKG_LINE

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before super.onCreate().
        registerPlugin(PowerPermissionsPlugin.class);
        super.onCreate(savedInstanceState);
        this.bridge.getWebView().getSettings().setTextZoom(100);
    }
}
EOF
echo "  MainActivity.java rewritten with setTextZoom(100) fix + PowerPermissions plugin registered"

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
