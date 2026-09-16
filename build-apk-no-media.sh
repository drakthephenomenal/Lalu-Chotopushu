#!/bin/bash
# ============================================================================
# build-apk-no-media.sh
#
# ONE-OFF build: produces an APK that does NOT bundle the /audio folder
# (mp3 stotram clips) or any *.mp4 video files. Everything else builds
# exactly as build-android.sh normally does. Those files will instead be
# streamed over the internet at playback time:
#   - audio/*.mp3  -> app.js's _hcjPlayVerse already retries from
#                      RJAP_PWA_URL (the live deployed site) whenever the
#                      local file is missing, so leaving it out of the
#                      bundle just means it *always* takes that path.
#   - *.mp4 videos -> already streamed from raw.githubusercontent.com via
#                      videos/manifest.json (never bundled anyway); this
#                      is just a safety net for any stray .mp4 that isn't
#                      inside the /videos folder.
#
# This does NOT change your project permanently: it patches a scratch
# copy of setup-www.sh for this build only, and restores the real
# setup-www.sh afterward (even if the build fails or is interrupted).
#
# Usage:
#   bash build-apk-no-media.sh          # fresh android/ + full build
#   bash build-apk-no-media.sh --keep   # same --keep flag as build-android.sh
#
# Run this from the repo root (same place you'd run build-android.sh).
# ============================================================================
set -e

if [ ! -f setup-www.sh ] || [ ! -f build-android.sh ]; then
  echo "❌ Run this from the repo root (setup-www.sh / build-android.sh not found here)."
  exit 1
fi

BACKUP="setup-www.sh.bak-$$"
cp setup-www.sh "$BACKUP"

restore_setup_www() {
  if [ -f "$BACKUP" ]; then
    mv "$BACKUP" setup-www.sh
    echo "↩ Restored the original setup-www.sh (this was a one-off build only)."
  fi
}
trap restore_setup_www EXIT

echo "▶ Temporarily excluding audio/ and *.mp4 from this build's www/ ..."
sed -i "/--exclude='videos'/a\\
\\
  # ONE-OFF: skip bundling audio so it streams from the internet instead\\
  --exclude='audio'\\
  --exclude='*.mp4'" setup-www.sh

# IMPORTANT: rsync's --delete does NOT remove files that match an
# --exclude pattern — it just leaves them alone. If a previous normal
# build already populated www/audio/, adding the exclude above wouldn't
# remove it, and the APK would come out the same size as before. Wiping
# www/ first guarantees this build starts from nothing, so the exclude
# actually keeps audio/*.mp4 out.
echo "▶ Wiping any existing www/ so stale bundled audio can't leak in ..."
rm -rf www

echo "▶ Running the normal build pipeline (build-android.sh) ..."
bash build-android.sh "$@"

echo ""
echo "✅ Built without bundling /audio or any *.mp4 — they'll play over the"
echo "   internet instead of from inside the APK. setup-www.sh has been"
echo "   restored to normal for your next build."
