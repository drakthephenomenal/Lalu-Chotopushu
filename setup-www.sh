#!/bin/bash
# Run this from your repo root inside the Codespace terminal:
#   bash setup-www.sh
set -e

echo "Creating www/ with a clean copy of your web files..."
mkdir -p www
rsync -a --delete \
  --exclude='android' \
  --exclude='node_modules' \
  --exclude='www' \
  --exclude='.git' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='capacitor.config.json' \
  --exclude='CAPACITOR_SETUP.md' \
  --exclude='setup-www.sh' \
  ./ www/

echo "Done. www/ now contains a copy of your web app."
echo "Next: npx cap sync android"
