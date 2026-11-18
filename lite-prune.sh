set -e
KEEP=( ! -path 'www/sampraday/tilaks/*' ! -path 'www/vedic-panchanga/*' ! -path 'www/background/*' ! -path 'www/.well-known/*' )
IMGS=( \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) )
find www -mindepth 2 -type f "${IMGS[@]}" "${KEEP[@]}" -printf '%h/\n' | sed 's|^www/||' | sort -u > .lite-dirs.txt
find www -mindepth 2 -type f "${IMGS[@]}" "${KEEP[@]}" -delete
find www -mindepth 1 -type d -empty -delete
rm -f www/*.zip www/*.bak* www/og-image.png www/lite-* www/.lite* www/build-lite.sh www/lite.log
rm -rf www/resources
pip install --quiet pillow >/dev/null 2>&1 || true
python3 lite-post.py "$1"
for f in www/guru.jpg www/icon-192.png www/index.html www/stotrams.js; do [ -f "$f" ] || { echo "MISSING $f"; exit 1; }; done
du -sh www
