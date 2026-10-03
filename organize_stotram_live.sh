#!/usr/bin/env bash
R="stotram-live"
CATS=" rv krishna shiv hanuman "
[ -d "$R" ] || exit 0
shopt -s nocasematch
for p in "$R"/*; do
  [ -f "$p" ] || continue
  f="${p##*/}"
  [[ "$f" =~ ^([A-Za-z]+)_(.+)(\.bn\.txt|\.hn\.txt|\.mp3)$ ]] || continue
  cat="${BASH_REMATCH[1],,}"
  title="$(printf '%s' "${BASH_REMATCH[2]}" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  ext="${BASH_REMATCH[3],,}"
  if [[ "$CATS" != *" $cat "* ]]; then
    echo "skip $f: unknown section '$cat' (use rv, krishna, shiv, hanuman)"; continue
  fi
  case "$ext" in
    .bn.txt) dest="lyrics.txt" ;;
    .hn.txt) dest="lyrics.hi.txt" ;;
    .mp3)    dest="audio.mp3" ;;
  esac
  slug="$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
  [ -n "$slug" ] || slug="s$(printf '%s' "$title" | sha1sum | cut -c1-8)"
  d="$R/$cat/$slug"
  mkdir -p "$d"
  mv -f "$p" "$d/$dest"
  if [ ! -f "$d/meta.json" ]; then
    esc="$(printf '%s' "$title" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    printf '{\n  "name": "%s",\n  "nameHi": "%s"\n}\n' "$esc" "$esc" > "$d/meta.json"
  fi
  echo "moved $f -> $d/$dest"
done
