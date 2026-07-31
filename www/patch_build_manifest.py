import sys

path = "build-android.sh"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

anchor = 'echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties'

replacement = '''echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties

# -- Patch AndroidManifest.xml: install-permission + FileProvider --
MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST_FILE" ]; then
  if ! grep -q "REQUEST_INSTALL_PACKAGES" "$MANIFEST_FILE"; then
    sed -i "s|</manifest>|    <uses-permission android:name=\\"android.permission.REQUEST_INSTALL_PACKAGES\\" />\\n</manifest>|" "$MANIFEST_FILE"
    echo "  added REQUEST_INSTALL_PACKAGES permission"
  else
    echo "  REQUEST_INSTALL_PACKAGES already present"
  fi

  if ! grep -q "fileprovider" "$MANIFEST_FILE"; then
    sed -i "s|</application>|    <provider\\n        android:name=\\"androidx.core.content.FileProvider\\"\\n        android:authorities=\\"\\${applicationId}.fileprovider\\"\\n        android:exported=\\"false\\"\\n        android:grantUriPermissions=\\"true\\">\\n        <meta-data android:name=\\"android.support.FILE_PROVIDER_PATHS\\" android:resource=\\"@xml/file_paths\\" />\\n    </provider>\\n</application>|" "$MANIFEST_FILE"
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
fi'''

if anchor not in src:
    print("ERROR: anchor not found -- build-android.sh may differ from what was shown in screenshots.")
    sys.exit(1)

src = src.replace(anchor, replacement, 1)
with open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("Manifest auto-patch added successfully.")
