#!/bin/bash
# ============================================================================
# add-audio-pack.sh
#
# Adds a Play Asset Delivery "install-time" asset pack (audio_pack) to the
# freshly generated android/ project, so the AAB can carry far more than the
# 200 MB base-module limit (pack limit ~1 GB, whole app ~4 GB).
#
# Packed:      Shri Hit Caturashi Ji - normal voice   audio/hcj_<n>.mp3
#              Shri Radha Sudha Nidhi - ALL voices    audio/rsn_<n>.mp3, rsn_alt_<n>, rsn_harindu_<n>, rsn_c ...
# NOT packed:  Maharaj Ji versions (audio/Hit caturashi ji/SHCJ*, audio/SMRSNJ/*)
#              and the Ankit / Shuvam Hit Caturashi voices - these keep streaming.
#
# How the app finds the clips: install-time packs are merged into the app's
# normal asset tree, and Capacitor serves assets/public/*, so the pack stores
# the clips at  assets/public/audio/...  and  audio/hcj_1.mp3  just works.
# (app.js leaves exactly these file names alone - keep AUDIO_RE below in sync
#  with the _packed pattern next to RJAP_PWA_URL in app.js.)
#
# Run from the repo root AFTER `npx cap sync` (android/ must exist).
# build-android.sh calls this when AUDIO_PACK=1.
# ============================================================================
set -e

PACK="audio_pack"
AUDIO_RE='^(hcj_[0-9]+|rsn(_[A-Za-z]+)?_([0-9]+|c))\.mp3$'
MAX_MB=1000   # Play limit per asset pack is 1 GB

[ -d android ] || { echo "::error::android/ not found - run this after the project is generated."; exit 1; }
[ -d audio ]   || { echo "::error::audio/ folder not found in the repo - nothing to pack."; exit 1; }

DEST="android/$PACK/src/main/assets/public/audio"
rm -rf "android/$PACK"
mkdir -p "$DEST"

# Top-level files only (never the 'Hit caturashi ji' or 'SMRSNJ' sub-folders).
COUNT=0
while IFS= read -r -d '' f; do
  b="$(basename "$f")"
  if [[ "$b" =~ $AUDIO_RE ]]; then
    cp "$f" "$DEST/$b"
    COUNT=$((COUNT + 1))
  fi
done < <(find audio -maxdepth 1 -type f -name '*.mp3' -print0)

if [ "$COUNT" -eq 0 ]; then
  echo "::error::No hcj_<n>.mp3 / rsn*.mp3 files found in audio/ - check the file names."
  exit 1
fi

# Safety net: Maharaj Ji and the other Hit Caturashi voices must never be in the pack.
if find "$DEST" -type f | grep -i -E 'SHCJ|SMRSNJ|maharaj|ankit|shuvam'; then
  echo "::error::A Maharaj Ji / Ankit / Shuvam file ended up in the pack (listed above)."
  exit 1
fi

HCJ=$(find "$DEST" -type f -name 'hcj_*' | wc -l)
RSN=$(find "$DEST" -type f -name 'rsn*'  | wc -l)
MB=$(( $(du -sb "$DEST" | cut -f1) / 1024 / 1024 ))
echo "  packed $COUNT clips ($HCJ Hit Caturashi, $RSN Radha Sudha Nidhi) = ${MB} MB"
if [ "$MB" -gt "$MAX_MB" ]; then
  echo "::error::audio_pack is ${MB} MB - over the ~1 GB per-pack limit. Pack fewer voices or split into two packs."
  exit 1
fi

# --- the asset-pack module ---
cat > "android/$PACK/build.gradle" <<GRADLE
apply plugin: 'com.android.asset-pack'

assetPack {
    packName = "$PACK"
    dynamicDelivery {
        deliveryType = "install-time"
    }
}
GRADLE

# --- register the module in settings.gradle ---
if ! grep -q "':$PACK'" android/settings.gradle; then
  printf "\ninclude ':%s'\n" "$PACK" >> android/settings.gradle
fi

# --- tell the app module to ship the pack in the AAB ---
python3 - <<'PYEOF'
import re
p = "android/app/build.gradle"
t = open(p, encoding="utf-8").read()
if "assetPacks" in t:
    print("  app/build.gradle already lists assetPacks")
else:
    t2, n = re.subn(r"(^android\s*\{\s*\n)", r'\1    assetPacks = [":audio_pack"]\n', t, count=1, flags=re.M)
    if n != 1:
        raise SystemExit("::error::could not find the android { block in android/app/build.gradle")
    open(p, "w", encoding="utf-8").write(t2)
    print("  added assetPacks = [\":audio_pack\"] to app/build.gradle")
PYEOF

echo "  audio_pack ready (install-time, ${MB} MB)."
