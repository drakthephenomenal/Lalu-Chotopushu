#!/usr/bin/env bash
# Run this from the repo root inside your GitHub Codespace.
# It generates the android/ project (if missing) and applies every
# code change needed for Google Sign-In, Zoho Sign-In, and Firebase.
set -euo pipefail

echo "== 1/6 Installing npm dependencies =="
npm install

echo "== 2/6 Adding Android platform =="
if [ ! -d "android" ]; then
  npx cap add android
else
  echo "  android/ already exists, skipping 'cap add android'."
fi

echo "== 3/6 Syncing web assets + Capacitor plugins into the Android project =="
npx cap sync android

MANIFEST="android/app/src/main/AndroidManifest.xml"
APP_GRADLE="android/app/build.gradle"
PROJECT_GRADLE="android/build.gradle"

echo "== 4/6 Adding the Zoho sign-in redirect deep link to AndroidManifest.xml =="
python3 - "$MANIFEST" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path) as f:
    xml = f.read()

MARKER = 'guru-kripahi-kevalam-108.firebaseapp.com'
if MARKER in xml:
    print("  Already present, skipping.")
else:
    intent_filter = '''        <intent-filter android:autoVerify="true">
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data
                android:scheme="https"
                android:host="guru-kripahi-kevalam-108.firebaseapp.com"
                android:pathPrefix="/__/auth/handler" />
        </intent-filter>
    </activity>'''
    if '</activity>' not in xml:
        print("  WARNING: no </activity> tag found. Add the intent-filter manually — see README-ANDROID-SETUP.md.")
    else:
        xml = xml.replace('</activity>', intent_filter, 1)
        with open(path, 'w') as f:
            f.write(xml)
        print("  Added Zoho redirect intent-filter to MainActivity.")
PYEOF

echo "== 5/6 Adding the Google Services Gradle plugin (required for Firebase) =="
if grep -q "com.google.gms:google-services" "$PROJECT_GRADLE"; then
  echo "  Classpath already present in $PROJECT_GRADLE, skipping."
else
  python3 - "$PROJECT_GRADLE" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()
anchor = "dependencies {"
idx = content.find(anchor)
if idx == -1:
    print("  WARNING: could not find 'dependencies {' — add classpath 'com.google.gms:google-services:4.4.2' manually.")
else:
    insert_pos = idx + len(anchor)
    content = content[:insert_pos] + "\n        classpath 'com.google.gms:google-services:4.4.2'" + content[insert_pos:]
    with open(path, 'w') as f:
        f.write(content)
    print("  Added google-services classpath to project build.gradle.")
PYEOF
fi

if grep -q "apply plugin: 'com.google.gms.google-services'" "$APP_GRADLE" 2>/dev/null; then
  echo "  Plugin already applied in $APP_GRADLE, skipping."
else
  echo "apply plugin: 'com.google.gms.google-services'" >> "$APP_GRADLE"
  echo "  Appended google-services plugin application to android/app/build.gradle."
fi

echo "== 6/6 Placing google-services.json =="
if [ -f "google-services.json" ] && [ ! -f "android/app/google-services.json" ]; then
  cp google-services.json android/app/google-services.json
  echo "  Copied google-services.json into android/app/."
  echo "  IMPORTANT: this copy has NO Android OAuth client yet (only a web one)."
  echo "  Native Google Sign-In will fail until you add your SHA-1/SHA-256"
  echo "  fingerprints in Firebase Console and replace this file with the"
  echo "  freshly downloaded one. See README-ANDROID-SETUP.md step 2."
else
  echo "  android/app/google-services.json already present, leaving as-is."
fi

echo ""
echo "===================================================================="
echo " Done. Remaining manual steps (see README-ANDROID-SETUP.md):"
echo "  1. Get SHA-1 + SHA-256:   cd android && ./gradlew signingReport"
echo "  2. Add those fingerprints in Firebase Console -> your Android app"
echo "     -> re-download google-services.json -> replace android/app/google-services.json"
echo "  3. Fill ZOHO_NATIVE_CONFIG.clientId in app.js with your real Zoho client ID"
echo "  4. Enable Google + Zoho (oidc.zoho) providers in Firebase Authentication"
echo "  5. npx cap sync android && npm run build:apk"
echo "===================================================================="
