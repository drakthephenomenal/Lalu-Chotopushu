#!/usr/bin/env python3
"""
Fixes "App not installed as package conflicts with an existing package" by
switching from ephemeral debug-signed builds to a persistent release
keystore that survives every fresh Codespace container.

ROOT CAUSE:
  build-android.sh always ran `./gradlew assembleDebug`, which signs with
  Android's auto-generated debug keystore. That keystore normally lives
  outside the repo (~/.android/debug.keystore) and is NOT guaranteed to
  persist across Codespace container restarts — a new container can mean
  a new debug key. Every install after that looks like a different app
  to Android's package manager, which refuses to "update" over it.

WHAT THIS SCRIPT DOES:
  1. Generates ONE release keystore at the repo root (release.keystore) —
     only if one doesn't already exist here. This file must be committed
     to your repo so every future Codespace/build reuses the SAME key.
  2. Writes keystore.properties (also at repo root) holding the
     store/key passwords + alias, so build-android.sh can find them.
  3. Patches build-android.sh to, on every run:
       - copy release.keystore into the freshly (re)generated android/
         folder (android/ gets wiped and rebuilt from scratch every run,
         so this has to be re-copied each time, same pattern this
         project already uses for google-services.json etc.)
       - inject a signingConfigs { release { ... } } block into
         android/app/build.gradle and wire it to buildTypes.release
       - build `assembleRelease` instead of `assembleDebug`

⚠️  IMPORTANT — READ BEFORE RUNNING:
  - This generates a REAL signing key. Once you've installed a build
    signed with it, you must keep using this exact keystore file for
    every future update, forever (this is an Android/Play Store rule,
    not something this script can change later). Losing it means you
    can never update this app again under the same package name — you'd
    have to publish as a new app.
  - Because of that, commit release.keystore AND keystore.properties to
    your git repo so they're never lost and every Codespace has them.
    This is safe or not safe to do depending on whether your repo is
    PRIVATE — if your repo is public, do NOT commit keystore.properties
    as-is (it contains the passwords in plain text). Tell me if your
    repo is public and I'll give you the GitHub Secrets version instead.
  - The FIRST time you build and install after this fix, you must
    UNINSTALL the currently-installed debug-signed app from your phone
    first — a release-signed build can never "update" over a
    debug-signed one either, this is a one-time manual step.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_persistent_signing_fix.py

Safe to re-run: skips keystore generation if one already exists, and
skips the build-android.sh patch if it's already applied.
"""
import os
import subprocess
import sys

REPO_KEYSTORE = "release.keystore"
KEYSTORE_PROPS = "keystore.properties"
BUILD_SCRIPT = "build-android.sh"

# Change these if you want different values — only matters before the
# keystore is first generated. After that, changing these does nothing
# (the keystore is already baked with whatever was used the first time).
STORE_PASSWORD = "RadhaNaamJap2026!"
KEY_ALIAS = "radhanaamjap"
KEY_PASSWORD = "RadhaNaamJap2026!"
DNAME = "CN=Radha Naam Jap, OU=App, O=Guru Kripahi Kevalam, L=Unknown, ST=Unknown, C=IN"


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def apply_edit(src, old, new, label, filename):
    count = src.count(old)
    if count == 0:
        die(
            f"[{filename}] Anchor for '{label}' not found. This file may "
            "differ from the version this patch was written against — "
            "aborting without changing anything."
        )
    if count > 1:
        die(
            f"[{filename}] Anchor for '{label}' appears {count} times "
            "(expected exactly 1) — aborting without changing anything."
        )
    return src.replace(old, new, 1)


def ensure_keystore():
    if os.path.isfile(REPO_KEYSTORE) and os.path.isfile(KEYSTORE_PROPS):
        print(f"  {REPO_KEYSTORE} and {KEYSTORE_PROPS} already exist — reusing them (not regenerating).")
        return

    if os.path.isfile(REPO_KEYSTORE) != os.path.isfile(KEYSTORE_PROPS):
        die(
            f"Only one of {REPO_KEYSTORE} / {KEYSTORE_PROPS} exists. That's an "
            "inconsistent state — please resolve manually (either restore the "
            "missing file from a backup/git history, or delete the other one "
            "and re-run this script to generate a fresh pair)."
        )

    # Neither exists — check keytool is available before doing anything else.
    try:
        subprocess.run(["keytool", "-help"], capture_output=True, check=False)
    except FileNotFoundError:
        die(
            "keytool not found on PATH. This ships with any JDK — if you've "
            "already run build-android.sh once in this Codespace, source the "
            "JDK it set up first, e.g.:\n"
            "  source ~/.sdkman/bin/sdkman-init.sh && sdk use java 21.0.5-tem\n"
            "then re-run this script."
        )

    print(f"  Generating new release keystore at {REPO_KEYSTORE} ...")
    result = subprocess.run(
        [
            "keytool", "-genkeypair",
            "-v",
            "-keystore", REPO_KEYSTORE,
            "-alias", KEY_ALIAS,
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-storepass", STORE_PASSWORD,
            "-keypass", KEY_PASSWORD,
            "-dname", DNAME,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        die("keytool failed to generate the keystore:\n" + result.stdout + result.stderr)

    with open(KEYSTORE_PROPS, "w") as f:
        f.write(
            f"storeFile={REPO_KEYSTORE}\n"
            f"storePassword={STORE_PASSWORD}\n"
            f"keyAlias={KEY_ALIAS}\n"
            f"keyPassword={KEY_PASSWORD}\n"
        )
    print(f"  Wrote {KEYSTORE_PROPS}")
    print(f"  ⚠️  Keep a personal backup of {REPO_KEYSTORE} and {KEYSTORE_PROPS} "
          "somewhere outside git too (e.g. your own drive) — losing both means "
          "you can never update this app again under this package name.")


def patch_build_script():
    if not os.path.isfile(BUILD_SCRIPT):
        die(f"Could not find {BUILD_SCRIPT} in the current directory.")

    with open(BUILD_SCRIPT, "r", encoding="utf-8") as f:
        src = f.read()

    if "-- Install persistent release signing --" in src:
        print(f"  {BUILD_SCRIPT} already patched — skipping.")
        return

    # ── Edit 1: insert the signing-config injection step right before the
    # final build step, using the same python-heredoc pattern this script
    # already uses for other post-regeneration AndroidManifest.xml patches.
    old1 = '''echo ""
echo "── Building APK ──────────────────────────────────────────────"
cd android
./gradlew assembleDebug --no-daemon
cd ..

echo ""
echo "✅ Done. APK at: android/app/build/outputs/apk/debug/app-debug.apk"
echo "   To download it: cd android/app/build/outputs/apk/debug && python3 -m http.server 8080"'''

    new1 = '''echo "── 9.5/9  Install persistent release signing ────────────────────"
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
        "def keystorePropertiesFile = rootProject.file(\\"../keystore.properties\\")\\n"
        "def keystoreProperties = new Properties()\\n"
        "if (keystorePropertiesFile.exists()) {\\n"
        "    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\\n"
        "}\\n\\n"
    )
    idx = content.find("android {")
    if idx == -1:
        raise SystemExit("Could not find 'android {' anchor in build.gradle")
    content = content[:idx] + props_loader + content[idx:]

    signing_block = (
        "    signingConfigs {\\n"
        "        release {\\n"
        "            storeFile file(\\"release.keystore\\")\\n"
        "            storePassword keystoreProperties[\\"storePassword\\"]\\n"
        "            keyAlias keystoreProperties[\\"keyAlias\\"]\\n"
        "            keyPassword keystoreProperties[\\"keyPassword\\"]\\n"
        "        }\\n"
        "    }\\n"
    )
    marker = "    buildTypes {"
    idx2 = content.find(marker)
    if idx2 == -1:
        raise SystemExit("Could not find 'buildTypes {' anchor in build.gradle")
    content = content[:idx2] + signing_block + content[idx2:]

    content = content.replace(
        "        release {\\n            minifyEnabled false",
        "        release {\\n            signingConfig signingConfigs.release\\n            minifyEnabled false",
        1,
    )

    with open(path, "w") as f:
        f.write(content)
    print("  added signingConfigs + wired buildTypes.release to it")
PYEOF

echo ""
echo "── Building APK (release, persistently signed) ──────────────────"
cd android
./gradlew assembleRelease --no-daemon
cd ..

echo ""
echo "✅ Done. APK at: android/app/build/outputs/apk/release/app-release.apk"
echo "   To download it: cd android/app/build/outputs/apk/release && python3 -m http.server 8080"
echo ""
echo "   ⚠ First install after this fix: UNINSTALL any previously debug-signed"
echo "     copy of the app from your phone first — a release-signed build can"
echo "     never update over a debug-signed one. After that first uninstall,"
echo "     every future build with this same keystore will update normally."'''

    src = apply_edit(src, old1, new1, "swap debug build for persistent release build", BUILD_SCRIPT)

    with open(BUILD_SCRIPT + ".bak-signingfix", "w", encoding="utf-8") as f:
        f.write(open(BUILD_SCRIPT, "r", encoding="utf-8").read())

    with open(BUILD_SCRIPT, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"  Patched {BUILD_SCRIPT}. Backup: {BUILD_SCRIPT}.bak-signingfix")


def main():
    print("Step 1 — release keystore:")
    ensure_keystore()
    print("")
    print("Step 2 — patching build-android.sh:")
    patch_build_script()
    print("")
    print("Next steps:")
    print("   git add release.keystore keystore.properties build-android.sh")
    print('   git commit -m "Add persistent release signing"')
    print("   git push")
    print("   bash build-android.sh")
    print("")
    print("   Then on your phone: UNINSTALL the current app first, then install")
    print("   the new android/app/build/outputs/apk/release/app-release.apk.")
    print("   Every build after that will update cleanly, no more re-installs needed.")


if __name__ == "__main__":
    main()
