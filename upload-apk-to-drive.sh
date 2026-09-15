#!/usr/bin/env bash
# Uploads the freshly-built release APK to the same Google Drive folder
# used by RJAP_APK_URL in app.js:
#   https://drive.google.com/drive/folders/1f5LsU7nL0KycW1_KkTu6lWivrEnd8l48
#
# One-time setup (only needs doing once per machine):
#   1. curl https://rclone.org/install.sh | sudo bash
#   2. rclone config
#        n) New remote
#        name> gdrive
#        Storage> drive (Google Drive)
#        follow the prompts, authorize in browser
#   3. chmod +x upload-apk-to-drive.sh
#
# Usage:
#   ./upload-apk-to-drive.sh            # names the upload with a timestamp
#   ./upload-apk-to-drive.sh v1.0.106   # names the upload with your tag/version

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
DRIVE_REMOTE="gdrive"                                  # name you gave it in `rclone config`
DRIVE_FOLDER_ID="1f5LsU7nL0KycW1_KkTu6lWivrEnd8l48"    # same folder as RJAP_APK_URL
VERSION="${1:-$(date +%Y%m%d-%H%M%S)}"
UPLOAD_NAME="app-release-${VERSION}.apk"

# ── Checks ──────────────────────────────────────────────────────────
if [ ! -f "$APK_PATH" ]; then
  echo "❌ No APK at $APK_PATH — run your build first." >&2
  exit 1
fi

if ! command -v rclone >/dev/null 2>&1; then
  echo "❌ rclone isn't installed. See the setup notes at the top of this script." >&2
  exit 1
fi

# ── Upload the versioned copy ────────────────────────────────────────
echo "⬆️  Uploading ${APK_PATH} as ${UPLOAD_NAME} ..."
rclone copyto "$APK_PATH" "${DRIVE_REMOTE}:${UPLOAD_NAME}" \
  --drive-root-folder-id "$DRIVE_FOLDER_ID"

# ── Also refresh a stable "latest.apk" so any link you've shared      ──
# ── elsewhere (e.g. manualApkLink in Settings) keeps working.         ──
echo "⬆️  Refreshing latest.apk ..."
rclone copyto "$APK_PATH" "${DRIVE_REMOTE}:latest.apk" \
  --drive-root-folder-id "$DRIVE_FOLDER_ID"

echo "✅ Done. Folder: https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}"
