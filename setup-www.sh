#!/bin/bash
# Run this from your repo root inside the Codespace terminal:
#   bash setup-www.sh
set -e

echo "Creating www/ with a clean copy of your web files..."
mkdir -p www

EXCLUDES=(
  --exclude='android'
  --exclude='node_modules'
  --exclude='www'
  --exclude='.git'
  --exclude='.github'
  --exclude='package.json'
  --exclude='package-lock.json'
  --exclude='capacitor.config.json'
  --exclude='CAPACITOR_SETUP.md'
  --exclude='setup-www.sh'

  # SECRETS: never allow these to ship in the app bundle, no matter what
  --exclude='release.keystore'
  --exclude='*.keystore'
  --exclude='*.jks'
  --exclude='keystore.properties'
  --exclude='google-services.json'
  --exclude='GoogleService-Info.plist'
  --exclude='firestore.rules'
  --exclude='firebase.json'
  --exclude='.firebaserc'
  --exclude='.env'
  --exclude='.env.*'
  --exclude='*.pem'
  --exclude='*.p12'

  # Cloud Functions / server-side source - never client-shippable
  --exclude='functions'
  --exclude='functions_index.js'
  --exclude='cloud-functions'
  --exclude='*cloud-function*.zip'

  # Dev scripts, one-off patches, and their notes
  --exclude='apply_*.py'
  --exclude='apply *.py'
  --exclude='patch_*.py'
  --exclude='patch *.py'
  --exclude='add-drive-functions.py'
  --exclude='*.patch'
  --exclude='*.patch-notes.md'
  --exclude='*_patch-notes.md'
  --exclude='__pycache__'
  --exclude='*.pyc'

  # Backup files (any .bak / .bak-* variant)
  --exclude='*.bak'
  --exclude='*.bak-*'

  # Build/dev scripts and Windows/local-only helpers
  --exclude='build-android.sh'
  --exclude='check_and_build.sh'
  --exclude='check_signing.sh'
  --exclude='setup-android.sh'
  --exclude='*.bat'
  --exclude='*.ps1'
  --exclude='android-setup'
  --exclude='android-src'

  # Internal docs, dumps, and one-off zips/context files
  --exclude='*.md'
  --exclude='README*'
  --exclude='manifest_dump.txt'
  --exclude='pair_context.txt'
  --exclude='patch_context.txt'
  --exclude='app-patch-bundle.zip'
  --exclude='vercel.json'

  # Play Store listing assets - not part of the running app
  --exclude='screenshot-narrow-*.png'

  # Dev-only test page
  --exclude='testlink.html'
)

rsync -a --delete "${EXCLUDES[@]}" ./ www/

echo "Done. www/ now contains a copy of your web app."
echo "Next: npx cap sync android"
