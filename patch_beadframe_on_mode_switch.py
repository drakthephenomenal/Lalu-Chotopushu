#!/usr/bin/env python3
"""
Fix: bead ring around Daily/Target boxes gets distorted after switching
modes (Gaudiya / Trahimam / Ramanandi).

Root cause: renderBeadFrame() sizes/positions the SVG bead ring off
beadFrameWrap.getBoundingClientRect(), but it's only re-run on
window 'resize'/'load'. _placeTarget28Card() moves the #target28Card
between slots on every mode toggle (and Gaudiya mode makes it
grid-column:1/-1, changing the wrap's width), so the ring keeps
rendering against stale dimensions until the user manually resizes.

Fix: after _placeTarget28Card() moves the card, wait one frame for
the browser to reflow the new layout, then re-render the bead frame.
Patching it once inside _placeTarget28Card() covers every call site
(mode toggles, backup restore, init) instead of patching each caller.

Targets ROOT app.js (per repo convention — build-android.sh's
setup-www.sh syncs root -> www/, so www/app.js must never be
patched directly).
"""
import re
import sys

TARGET = "app.js"

OLD = '''function _placeTarget28Card() {
  const card = document.getElementById("target28Card");
  if (!card) return;
  const slot = App.S.gaudiyaMode
    ? document.getElementById("target28SlotGaudiya")
    : document.getElementById("target28SlotDefault");
  if (slot && card.parentElement !== slot) slot.appendChild(card);
}'''

NEW = '''function _placeTarget28Card() {
  const card = document.getElementById("target28Card");
  if (!card) return;
  const slot = App.S.gaudiyaMode
    ? document.getElementById("target28SlotGaudiya")
    : document.getElementById("target28SlotDefault");
  const moved = slot && card.parentElement !== slot;
  if (moved) slot.appendChild(card);
  // The bead ring (renderBeadFrame) sizes itself off beadFrameWrap's
  // measured rect. Moving the target card can resize that wrap (e.g.
  // Gaudiya mode makes it grid-column:1/-1), so re-render the ring
  // once the browser has reflowed the new layout, or it stays
  // distorted until the next window resize.
  if (moved && typeof renderBeadFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(() => renderBeadFrame()));
  }
}'''

def main():
    with open(TARGET, "r", encoding="utf-8") as f:
        src = f.read()

    if NEW in src:
        print("Already patched — nothing to do.")
        return

    if OLD not in src:
        print("ERROR: could not find expected _placeTarget28Card() block in "
              f"{TARGET}. It may already be modified. Aborting without changes.")
        sys.exit(1)

    with open(TARGET + ".bak", "w", encoding="utf-8") as f:
        f.write(src)

    src = src.replace(OLD, NEW, 1)

    with open(TARGET, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"Patched {TARGET} (backup saved to {TARGET}.bak)")
    print("_placeTarget28Card() now re-renders the bead frame after the card moves.")

if __name__ == "__main__":
    main()
