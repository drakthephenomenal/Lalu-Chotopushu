#!/usr/bin/env python3
"""
Fix: in Gaudiya/ISKCON mode, tapping only animates the OLD mahamantra
color leaving (.hk-float-name rises + fades via the hkRise keyframe),
but the NEW color on #hkPersist is set instantly with no entrance
animation (spawnHK() just does el.style.color = nextColor). That's the
abrupt "old color floats up, new color just appears" the user is
seeing.

Fix: give the persistent text a pop-in animation (quick scale +
brightness flash) and retrigger it on every tap via a class
remove/reflow/add cycle, so the new color visibly "arrives" instead
of hard-cutting in.

Targets ROOT app.js + style.css (per repo convention — build-android.sh's
setup-www.sh syncs root -> www/, so www/ copies must never be patched
directly).
"""
import sys

APP_JS = "app.js"
STYLE_CSS = "style.css"

# ── style.css: add the pop-in keyframe + trigger class next to #hkPersist ──
CSS_OLD = """#hkPersist.hk-visible{opacity:1;}
#hkPersist > div{display:block;width:100%;}"""

CSS_NEW = """#hkPersist.hk-visible{opacity:1;}
#hkPersist > div{display:block;width:100%;}
/* New mantra color "arriving" pop — mirrors the old color's hkRise departure */
@keyframes hkPulseIn{
  0%{transform:scale(0.85);filter:brightness(1.7) saturate(1.3);}
  55%{transform:scale(1.06);}
  100%{transform:scale(1);filter:brightness(1) saturate(1);}
}
#hkPersist.hk-pulse{animation:hkPulseIn 0.32s cubic-bezier(0.34,1.56,0.64,1);}"""

# ── app.js: set the color, then restart the pulse class on every tap ──
JS_OLD = """  el.innerHTML = text
    .split("\\n")
    .map((l) => "<div>" + l + "</div>")
    .join("");
  el.style.color = nextColor;
  el.style.textShadow = nextShadow;
  if (!el.classList.contains("hk-visible")) {
    el.classList.add("hk-visible");
  }
}"""

JS_NEW = """  el.innerHTML = text
    .split("\\n")
    .map((l) => "<div>" + l + "</div>")
    .join("");
  el.style.color = nextColor;
  el.style.textShadow = nextShadow;
  if (!el.classList.contains("hk-visible")) {
    el.classList.add("hk-visible");
  }
  // Retrigger the "new color arriving" pop-in on every tap, not just
  // the first reveal (removing + forcing reflow restarts the CSS animation)
  el.classList.remove("hk-pulse");
  void el.offsetWidth;
  el.classList.add("hk-pulse");
}"""


def patch(path, old, new, label):
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if new in src:
        print(f"{label}: already patched — nothing to do.")
        return False

    if old not in src:
        print(f"ERROR: could not find expected block in {path} for {label}. "
              "It may already be modified. Aborting without changes.")
        sys.exit(1)

    with open(path + ".bak", "w", encoding="utf-8") as f:
        f.write(src)

    src = src.replace(old, new, 1)

    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"Patched {path} (backup saved to {path}.bak) — {label}")
    return True


def main():
    patch(STYLE_CSS, CSS_OLD, CSS_NEW, "hkPulseIn keyframe + trigger class")
    patch(APP_JS, JS_OLD, JS_NEW, "spawnHK() retriggers hk-pulse on every tap")
    print("Done. Rebuild and tap through a mala in Gaudiya Mode to check the new color pops in.")


if __name__ == "__main__":
    main()
