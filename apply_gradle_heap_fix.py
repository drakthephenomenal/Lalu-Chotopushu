#!/usr/bin/env python3
"""
Fixes the "Java heap space" failure during :app:compressReleaseAssets by
giving Gradle more memory to work with - permanently, so it survives
every future build (not just a one-time terminal fix, which gets wiped
every time build-android.sh regenerates the android/ folder from scratch).

ROOT CAUSE: this project's asset folder (audio recordings, images) is
large enough that Gradle's default JVM heap runs out of memory while
compressing everything into the release APK. A one-off `echo ... >>
android/gradle.properties` fixes it for a single build, but android/ gets
deleted and rebuilt from scratch every time build-android.sh runs, so
that edit silently disappears on the next build.

FIX: patches build-android.sh to write the increased heap size into
gradle.properties every time, right after android/ is regenerated and
right before the gradlew build step runs - same pattern already used for
the persistent signing config and native permission plugin registration.

Sets: org.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m
(3GB heap - safe margin under this Codespace's ~5GB available RAM,
confirmed via `free -h` before choosing this value.)

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_gradle_heap_fix.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up build-android.sh -> build-android.sh.bak-heapfix first.

After running:
    bash build-android.sh
"""
import os
import sys

BUILD_SCRIPT = "build-android.sh"
MARKER = "-- Gradle heap space fix --"

OLD_BLOCK = '''echo ""
echo "── Building APK (release, persistently signed) ──────────────────"
cd android
./gradlew assembleRelease --no-daemon
cd ..'''

NEW_BLOCK = '''echo ""
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
if grep -q "org.gradle.jvmargs" android/gradle.properties 2>/dev/null; then
  sed -i '/org.gradle.jvmargs/d' android/gradle.properties
fi
echo "org.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m" >> android/gradle.properties
echo "org.gradle.workers.max=2" >> android/gradle.properties
echo "  set Gradle heap size (3GB) and capped parallel workers to 2 in gradle.properties"

echo ""
echo "── Building APK (release, persistently signed) ──────────────────"
cd android
./gradlew assembleRelease --no-daemon
cd ..'''


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def apply_edit(src, old, new, label, filename):
    count = src.count(old)
    if count == 0:
        die(
            f"[{filename}] Anchor for '{label}' not found. This file may "
            "differ from the version this patch was written against - "
            "aborting without changing anything."
        )
    if count > 1:
        die(
            f"[{filename}] Anchor for '{label}' appears {count} times "
            "(expected exactly 1) - aborting without changing anything."
        )
    return src.replace(old, new, 1)


def main():
    if not os.path.isfile(BUILD_SCRIPT):
        die(f"Could not find {BUILD_SCRIPT} in the current directory.")

    with open(BUILD_SCRIPT, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        print(f"{BUILD_SCRIPT} already patched with the Gradle heap fix - nothing to do.")
        sys.exit(0)

    src = apply_edit(src, OLD_BLOCK, NEW_BLOCK, "insert Gradle heap fix before build step", BUILD_SCRIPT)

    with open(BUILD_SCRIPT + ".bak-heapfix", "w", encoding="utf-8") as f:
        f.write(open(BUILD_SCRIPT, "r", encoding="utf-8").read())

    with open(BUILD_SCRIPT, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"Patched {BUILD_SCRIPT}. Backup: {BUILD_SCRIPT}.bak-heapfix")
    print("")
    print("Next steps:")
    print("   git add build-android.sh")
    print('   git commit -m "Permanently fix Gradle heap space error"')
    print("   git push")
    print("   bash build-android.sh")


if __name__ == "__main__":
    main()
