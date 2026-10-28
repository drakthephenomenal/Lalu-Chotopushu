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
sdkmanager "platform-tools" "platforms;android-36" "build-tools;35.0.0" "build-tools;36.0.0" > /dev/null

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
grep -q "versionCode $NEXT_VERSION_CODE" android/app/build.gradle || { echo "  ✗ could not set versionCode in android/app/build.gradle (template changed?)"; exit 1; }
echo "  bumped to versionCode $NEXT_VERSION_CODE / versionName $NEXT_VERSION_NAME"

# Google Play requires targetSdkVersion 36 (Android 16). Capacitor 8 generates that; Capacitor 6/7 do not.
TSDK=$(grep -E "targetSdkVersion" android/variables.gradle | grep -oE "[0-9]+" | head -1)
echo "  generated targetSdkVersion = ${TSDK:-unknown}"
if [ "${TSDK:-0}" -lt 36 ]; then
  echo "  ✗ targetSdkVersion is below 36 — Google Play will reject this build."
  echo "    Check package.json uses @capacitor/android ^8 and run npm install again."
  exit 1
fi

echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties

# -- Patch AndroidManifest.xml: install-permission + FileProvider --
MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST_FILE" ]; then
  # Google Play forbids REQUEST_INSTALL_PACKAGES for this app type -> make sure it is NOT in the manifest.
  sed -i '/REQUEST_INSTALL_PACKAGES/d' "$MANIFEST_FILE"
  echo "  removed REQUEST_INSTALL_PACKAGES (Play policy)"

  if ! grep -q "fileprovider" "$MANIFEST_FILE"; then
    sed -i "s|</application>|    <provider\n        android:name=\"androidx.core.content.FileProvider\"\n        android:authorities=\"\${applicationId}.fileprovider\"\n        android:exported=\"false\"\n        android:grantUriPermissions=\"true\">\n        <meta-data android:name=\"android.support.FILE_PROVIDER_PATHS\" android:resource=\"@xml/file_paths\" />\n    </provider>\n</application>|" "$MANIFEST_FILE"
    mkdir -p android/app/src/main/res/xml
    if [ ! -f android/app/src/main/res/xml/file_paths.xml ]; then
      cat > android/app/src/main/res/xml/file_paths.xml << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="cache" path="." />
    <external-cache-path name="external_cache" path="." />
    <files-path name="files" path="." />
</paths>
XMLEOF
    fi
    echo "  added FileProvider block + file_paths.xml"
  else
    echo "  FileProvider already present"
  fi
fi

# -- Patch AndroidManifest.xml: install-permission + FileProvider --
MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST_FILE" ]; then
  # Google Play forbids REQUEST_INSTALL_PACKAGES for this app type -> make sure it is NOT in the manifest.
  sed -i '/REQUEST_INSTALL_PACKAGES/d' "$MANIFEST_FILE"
  echo "  removed REQUEST_INSTALL_PACKAGES (Play policy)"

  if ! grep -q "fileprovider" "$MANIFEST_FILE"; then
    sed -i "s|</application>|    <provider\n        android:name=\"androidx.core.content.FileProvider\"\n        android:authorities=\"\${applicationId}.fileprovider\"\n        android:exported=\"false\"\n        android:grantUriPermissions=\"true\">\n        <meta-data android:name=\"android.support.FILE_PROVIDER_PATHS\" android:resource=\"@xml/file_paths\" />\n    </provider>\n</application>|" "$MANIFEST_FILE"
    mkdir -p android/app/src/main/res/xml
    if [ ! -f android/app/src/main/res/xml/file_paths.xml ]; then
      cat > android/app/src/main/res/xml/file_paths.xml << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="cache" path="." />
    <external-cache-path name="external_cache" path="." />
    <files-path name="files" path="." />
</paths>
XMLEOF
    fi
    echo "  added FileProvider block + file_paths.xml"
  else
    echo "  FileProvider already present"
  fi
fi

# -- Patch AndroidManifest.xml: install-permission + FileProvider --
MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST_FILE" ]; then
  # Google Play forbids REQUEST_INSTALL_PACKAGES for this app type -> make sure it is NOT in the manifest.
  sed -i '/REQUEST_INSTALL_PACKAGES/d' "$MANIFEST_FILE"
  echo "  removed REQUEST_INSTALL_PACKAGES (Play policy)"

  if ! grep -q "fileprovider" "$MANIFEST_FILE"; then
    sed -i "s|</application>|    <provider\n        android:name=\"androidx.core.content.FileProvider\"\n        android:authorities=\"\${applicationId}.fileprovider\"\n        android:exported=\"false\"\n        android:grantUriPermissions=\"true\">\n        <meta-data android:name=\"android.support.FILE_PROVIDER_PATHS\" android:resource=\"@xml/file_paths\" />\n    </provider>\n</application>|" "$MANIFEST_FILE"
    mkdir -p android/app/src/main/res/xml
    if [ ! -f android/app/src/main/res/xml/file_paths.xml ]; then
      cat > android/app/src/main/res/xml/file_paths.xml << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="cache" path="." />
    <external-cache-path name="external_cache" path="." />
    <files-path name="files" path="." />
</paths>
XMLEOF
    fi
    echo "  added FileProvider block + file_paths.xml"
  else
    echo "  FileProvider already present"
  fi
fi

# -- Patch AndroidManifest.xml: install-permission + FileProvider --
MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST_FILE" ]; then
  # Google Play forbids REQUEST_INSTALL_PACKAGES for this app type -> make sure it is NOT in the manifest.
  sed -i '/REQUEST_INSTALL_PACKAGES/d' "$MANIFEST_FILE"
  echo "  removed REQUEST_INSTALL_PACKAGES (Play policy)"

  if ! grep -q "fileprovider" "$MANIFEST_FILE"; then
    sed -i "s|</application>|    <provider\n        android:name=\"androidx.core.content.FileProvider\"\n        android:authorities=\"\${applicationId}.fileprovider\"\n        android:exported=\"false\"\n        android:grantUriPermissions=\"true\">\n        <meta-data android:name=\"android.support.FILE_PROVIDER_PATHS\" android:resource=\"@xml/file_paths\" />\n    </provider>\n</application>|" "$MANIFEST_FILE"
    mkdir -p android/app/src/main/res/xml
    if [ ! -f android/app/src/main/res/xml/file_paths.xml ]; then
      cat > android/app/src/main/res/xml/file_paths.xml << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="cache" path="." />
    <external-cache-path name="external_cache" path="." />
    <files-path name="files" path="." />
</paths>
XMLEOF
    fi
    echo "  added FileProvider block + file_paths.xml"
  else
    echo "  FileProvider already present"
  fi
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

# Remove background location: a plugin merges ACCESS_BACKGROUND_LOCATION into the
# manifest, but the app only uses location while open. Removing it avoids Play's
# background-location declaration (video + review) and keeps the permission list honest.
if ! grep -q "ACCESS_BACKGROUND_LOCATION" "$MANIFEST"; then
  grep -q 'xmlns:tools' "$MANIFEST" || sed -i 's|<manifest |<manifest xmlns:tools="http://schemas.android.com/tools" |' "$MANIFEST"
  sed -i 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" tools:node="remove" />|' "$MANIFEST"
  echo "  removed ACCESS_BACKGROUND_LOCATION"
else
  echo "  ACCESS_BACKGROUND_LOCATION removal already present"
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

echo "── 7.8/9  Patch AndroidManifest.xml (background playback service) ──"
python3 - << 'PYEOF2'
path = "android/app/src/main/AndroidManifest.xml"
c = open(path).read()
if "MediaKeepAliveService" in c:
    print("  already present")
else:
    perms = ""
    for pm in ["FOREGROUND_SERVICE", "FOREGROUND_SERVICE_MEDIA_PLAYBACK", "WAKE_LOCK", "POST_NOTIFICATIONS"]:
        if ("android.permission." + pm + '"') not in c:
            perms += '    <uses-permission android:name="android.permission.' + pm + '" />\n'
    if "<application" not in c or "</application>" not in c:
        raise SystemExit("AndroidManifest.xml structure unexpected")
    c = c.replace("<application", perms + "    <application", 1)
    svc = '        <service android:name=".MediaKeepAliveService" android:exported="false" android:foregroundServiceType="mediaPlayback" />\n    '
    c = c.replace("</application>", svc + "</application>", 1)
    open(path, "w").write(c)
    print("  added media-playback foreground service + permissions")
PYEOF2

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
cp "android-src/MediaKeepAlivePlugin.java" "$MAIN_ACTIVITY_DIR/MediaKeepAlivePlugin.java"
cp "android-src/MediaKeepAliveService.java" "$MAIN_ACTIVITY_DIR/MediaKeepAliveService.java"
echo "  installed MediaKeepAlivePlugin.java + MediaKeepAliveService.java"

cat > "$MAIN_ACTIVITY" << EOF
$PKG_LINE

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before super.onCreate().
        registerPlugin(PowerPermissionsPlugin.class);
        registerPlugin(MediaKeepAlivePlugin.class);
        super.onCreate(savedInstanceState);
        WebSettings st = this.bridge.getWebView().getSettings();
        st.setTextZoom(100);
        // Audio / video / YouTube may start by themselves (autoplay) without a fresh tap.
        st.setMediaPlaybackRequiresUserGesture(false);

        // Android 15/16 draw apps edge-to-edge (under the status + navigation bars) and the old
        // opt-out is gone. Keep the previous look: pad the whole screen by the system bars, and by the
        // keyboard height while the keyboard is open, so nothing sits under the bars.
        final View root = findViewById(android.R.id.content);
        root.setBackgroundColor(Color.parseColor("#070B1A"));
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
    }

    // While audio is playing, do not let Android freeze the WebView when the screen turns off.
    private void keepWebViewAlive() {
        try {
            if (MediaKeepAliveService.running && this.bridge != null && this.bridge.getWebView() != null) {
                WebView w = this.bridge.getWebView();
                w.onResume();
                w.resumeTimers();
            }
        } catch (Exception e) { }
    }

    @Override
    public void onPause() {
        super.onPause();
        keepWebViewAlive();
    }

    @Override
    public void onStop() {
        super.onStop();
        keepWebViewAlive();
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
  sed -i -E "s|^([[:space:]]*)compileSdk(Version)?[[:space:]]*=?[[:space:]]*.*$|\\1compileSdk = 36|" "$BR_GRADLE"
  echo "  patched background-runner compileSdk"

  # background-runner ships its JS-engine .aar inside its own package, but
  # cap sync doesn't copy it to where Gradle's flatDir repo expects it.
  mkdir -p android/capacitor-cordova-android-plugins/src/main/libs
  cp "node_modules/@capacitor/background-runner/android/src/main/libs/android-js-engine-release.aar" \
     "android/capacitor-cordova-android-plugins/src/main/libs/android-js-engine-release.aar"
  echo "  copied android-js-engine-release.aar"
fi

echo "── 9.5/9  Install persistent release signing ────────────────────"
# -- Install persistent release signing --
# android/ is wiped and regenerated from scratch every run (see header), so
# the keystore + signing config must be re-installed into it every time,
# same pattern as google-services.json and PowerPermissionsPlugin.java above.
# release.keystore and keystore.properties live at the repo ROOT and are
# committed to git specifically so every Codespace/build reuses the SAME
# signing key — without this, every fresh container would sign with a
# different debug key and Android would refuse to install over the
# previous version ("package conflicts with an existing package").
if [ ! -f "release.keystore" ] || [ ! -f "keystore.properties" ]; then
  echo "  ⚠ release.keystore / keystore.properties not found at repo root."
  echo "    Run: python3 apply_persistent_signing_fix.py"
  exit 1
fi
cp release.keystore android/app/release.keystore

python3 - << 'PYEOF'
path = "android/app/build.gradle"
with open(path) as f:
    content = f.read()

if "signingConfigs {" in content:
    print("  signingConfigs already present in build.gradle")
else:
    props_loader = (
        "def keystorePropertiesFile = rootProject.file(\"../keystore.properties\")\n"
        "def keystoreProperties = new Properties()\n"
        "if (keystorePropertiesFile.exists()) {\n"
        "    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n"
        "}\n\n"
    )
    idx = content.find("android {")
    if idx == -1:
        raise SystemExit("Could not find 'android {' anchor in build.gradle")
    content = content[:idx] + props_loader + content[idx:]

    signing_block = (
        "    signingConfigs {\n"
        "        release {\n"
        "            storeFile file(\"release.keystore\")\n"
        "            storePassword keystoreProperties[\"storePassword\"]\n"
        "            keyAlias keystoreProperties[\"keyAlias\"]\n"
        "            keyPassword keystoreProperties[\"keyPassword\"]\n"
        "        }\n"
        "    }\n"
    )
    marker = "    buildTypes {"
    idx2 = content.find(marker)
    if idx2 == -1:
        raise SystemExit("Could not find 'buildTypes {' anchor in build.gradle")
    content = content[:idx2] + signing_block + content[idx2:]

    content = content.replace(
        "        release {\n            minifyEnabled false",
        "        release {\n            signingConfig signingConfigs.release\n            minifyEnabled false",
        1,
    )

    with open(path, "w") as f:
        f.write(content)
    print("  added signingConfigs + wired buildTypes.release to it")
PYEOF

echo ""
echo "── 9.6/9  Gradle heap space fix ──────────────────────────────────"
# -- Gradle heap space fix --
# This project's asset folder (audio recordings, images) is large enough
# that Gradle's default JVM heap can run out of memory while compressing
# everything into the release APK ("Java heap space" during
# :app:compressReleaseAssets). android/ is wiped and regenerated from
# scratch every run (see header), so this must be re-written every time,
# same pattern as the signing config and permission plugin registration
# above - a one-off manual edit to gradle.properties would otherwise
# silently disappear on the next build.
if ! grep -q "org.gradle.jvmargs" android/gradle.properties 2>/dev/null; then
  echo "org.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m" >> android/gradle.properties
  echo "  added increased Gradle heap size (3GB) to gradle.properties"
else
  echo "  gradle.properties already has jvmargs set - leaving as-is"
fi

echo ""
echo "── Building APK (release, persistently signed) ──────────────────"
cd android
./gradlew assembleRelease bundleRelease --no-daemon
cd ..

echo ""
echo "✅ Done. APK (testing only): android/app/build/outputs/apk/release/app-release.apk"
echo "   Play Store upload (AAB):     android/app/build/outputs/bundle/release/app-release.aab"
ls -lh android/app/build/outputs/bundle/release/app-release.aab 2>/dev/null | awk '{print "   AAB size: " $5}'
echo "   To download it: cd android/app/build/outputs/apk/release && python3 -m http.server 8080"
echo ""
echo "   ⚠ First install after this fix: UNINSTALL any previously debug-signed"
echo "     copy of the app from your phone first — a release-signed build can"
echo "     never update over a debug-signed one. After that first uninstall,"
echo "     every future build with this same keystore will update normally."
