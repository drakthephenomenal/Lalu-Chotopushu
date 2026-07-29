import sys

path = "build-android.sh"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

anchor = '''if [ "$KEEP_ANDROID" = true ] && [ -d "android" ]; then
  echo "  --keep passed, leaving existing android/ folder as-is."
else
  rm -rf android
  npx cap add android
fi

echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties'''

replacement = '''if [ "$KEEP_ANDROID" = true ] && [ -d "android" ]; then
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
sed -i -E "s/versionName \\"[^\\"]*\\"/versionName \\"$NEXT_VERSION_NAME\\"/" android/app/build.gradle
echo "  bumped to versionCode $NEXT_VERSION_CODE / versionName $NEXT_VERSION_NAME"

echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties'''

if anchor not in src:
    print("ERROR: anchor not found -- build-android.sh may differ from what was shown in screenshots.")
    sys.exit(1)

src = src.replace(anchor, replacement, 1)
with open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("Patch applied successfully.")
