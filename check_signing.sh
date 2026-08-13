#!/bin/bash
set -e
ROOT="/workspaces/Lalu-Chotopushu"

echo "=== 1. Are all 4 release.keystore copies identical? ==="
sha256sum "$ROOT/android/app/release.keystore" \
          "$ROOT/release.keystore" \
          "$ROOT/www/release.keystore" \
          "$ROOT/android/app/src/main/assets/public/release.keystore"

echo ""
echo "=== 2. Does keystore.properties exist and look populated? ==="
PROPS=$(find "$ROOT" -iname "keystore.properties")
if [ -z "$PROPS" ]; then
  echo "MISSING: no keystore.properties file found anywhere in the repo."
else
  echo "Found at: $PROPS"
  echo "Keys present (values hidden):"
  sed 's/=.*/=[hidden]/' "$PROPS"
fi
