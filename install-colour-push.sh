#!/bin/bash
# Run from the repo root in Codespace, ONCE, on an existing android/ folder
# (build-android.sh already does the same on a fresh build).
set -e
JAVA_DIR=$(dirname "$(find android/app/src/main/java -name MainActivity.java | head -1)")
[ -n "$JAVA_DIR" ] || { echo "MainActivity.java not found - run npx cap sync android first"; exit 1; }
if ! grep -rqs "class MessagingService" node_modules/@capacitor-firebase/messaging/android/src; then
  echo "Capacitor Firebase Messaging service class not found - nothing installed."; exit 1
fi
cp android-src/RjapMessagingService.java "$JAVA_DIR/RjapMessagingService.java"
MANIFEST=android/app/src/main/AndroidManifest.xml
if ! grep -q "RjapMessagingService" "$MANIFEST"; then
  sed -i 's#</application>#    <service android:name=".RjapMessagingService" android:exported="false">\n            <intent-filter android:priority="100">\n                <action android:name="com.google.firebase.MESSAGING_EVENT" />\n            </intent-filter>\n        </service>\n    </application>#' "$MANIFEST"
fi
echo "Installed RjapMessagingService into $JAVA_DIR and registered it in the manifest."
