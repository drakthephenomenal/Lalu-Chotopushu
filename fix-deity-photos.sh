#!/usr/bin/env bash
# Run from the repo root:  bash fix-deity-photos.sh
# Writes deities/<name>/list.txt for every deity folder that has photos.
# The app reads list.txt first, so photos no longer have to be numbered 1,2,3
# with no gaps (a single missing number was hiding every photo after it).
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1
[ -d deities ] || { echo "No deities/ folder here. Run from the repo root."; exit 1; }

total=0
for dir in deities/*/; do
  name=$(basename "$dir")
  # image files only (jpg/jpeg/png/webp, any case), numbered ones first in numeric order
  mapfile -t files < <(
    cd "$dir" && ls -1 2>/dev/null \
      | grep -iE '\.(jpe?g|png|webp)$' \
      | awk '{ n=$0; sub(/\..*$/,"",n); k=(n ~ /^[0-9]+$/) ? sprintf("0 %09d",n) : "1 " n; print k "\t" $0 }' \
      | sort \
      | cut -f2
  )
  [ "${#files[@]}" -eq 0 ] && continue

  printf '%s\n' "${files[@]}" > "${dir}list.txt"
  total=$((total + ${#files[@]}))

  # report gaps in the 1..N numbering (these are files that never got uploaded)
  missing=$(cd "$dir" && for f in "${files[@]}"; do n="${f%%.*}"; [[ "$n" =~ ^[0-9]+$ ]] && echo "$n"; done \
    | sort -n | awk 'NR==1{p=$1; if($1>1) for(i=1;i<$1;i++) printf "%d ", i; next} {for(i=p+1;i<$1;i++) printf "%d ", i; p=$1}')
  if [ -n "$missing" ]; then
    printf '%-24s %3d photos   (numbers with no file: %s)\n' "$name" "${#files[@]}" "$missing"
  else
    printf '%-24s %3d photos\n' "$name" "${#files[@]}"
  fi
done
echo "Done. $total photos listed."
echo
echo "Now publish it:"
echo "  git add deities && git commit -m 'Deity photo lists' && git push"
