#!/usr/bin/env python3
"""
Change: Ramanandi Mode (Raam Vijay Mantra) tap animation. Previously
spawnRam() set the whole new-color mantra text at once with no entrance
animation (only the OLD color's departure was animated, via the
existing .hk-float-name / hkRise rise-and-fade).

Now: each WORD of the mantra flies in from a random angle/distance
around the tap zone with a spin, and settles into place — staggered
per word so the phrase visibly assembles itself, instead of the whole
line snapping in.

Only touches Ramanandi mode (#ramPersist / spawnRam()) — Gaudiya (HK)
and Krishnay Vasudevay (KV) persistent displays are untouched.

Targets ROOT app.js + style.css (per repo convention — build-android.sh's
setup-www.sh syncs root -> www/, so www/ copies must never be patched
directly).
"""
import sys

APP_JS = "app.js"
STYLE_CSS = "style.css"

# ── style.css: word-spin-in keyframe + per-word class, and switch the
#    line wrapper from a plain block to a flex row so words can wrap and
#    center themselves as they land ──
CSS_OLD = """#ramPersist.hk-visible{opacity:1;}
#ramPersist > div{display:block;width:100%;}"""

CSS_NEW = """#ramPersist.hk-visible{opacity:1;}
#ramPersist > div{display:flex;flex-wrap:wrap;justify-content:center;gap:0.3em;width:100%;}
/* Each word of the Raam Vijay mantra spins in from a random margin of
   the jap display and settles into place, instead of the whole line
   popping in at once. --wx/--wy/--wr are set per word in JS. */
.ram-word{display:inline-block;opacity:0;animation:ramWordIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards;}
@keyframes ramWordIn{
  0%{opacity:0;transform:translate(var(--wx,0px),var(--wy,0px)) rotate(var(--wr,0deg)) scale(0.5);}
  70%{opacity:1;}
  100%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1);}
}"""

# ── app.js: build each word as its own span with a random fly-in
#    angle/distance/spin and a small stagger, instead of setting the
#    whole line as static innerHTML ──
JS_OLD = """  // Persistent display immediately shows NEXT color (arriving text)
  el.innerHTML = text
    .split("\\n")
    .map((l) => "<div>" + l + "</div>")
    .join("");
  el.style.color = nextColor;
  el.style.textShadow = nextShadow;
  if (!el.classList.contains("hk-visible")) {
    el.classList.add("hk-visible");
  }
}

function showRamMalaComplete(line1, line2) {"""

JS_NEW = """  // Persistent display: each word spins in from a random margin of the
  // jap display and converges into place (instead of the whole line
  // appearing at once).
  el.innerHTML = "";
  el.style.color = nextColor;
  el.style.textShadow = nextShadow;
  let _ramWordIdx = 0;
  text.split("\\n").forEach((line) => {
    const lineDiv = document.createElement("div");
    line.split(" ").forEach((word) => {
      if (!word) return;
      const span = document.createElement("span");
      span.className = "ram-word";
      span.textContent = word;
      // Random point around the display to fly in from, plus a random spin
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 90;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360);
      span.style.setProperty("--wx", Math.cos(angle) * dist + "px");
      span.style.setProperty("--wy", Math.sin(angle) * dist + "px");
      span.style.setProperty("--wr", spin + "deg");
      span.style.animationDelay = (_ramWordIdx * 0.06) + "s";
      _ramWordIdx++;
      lineDiv.appendChild(span);
    });
    el.appendChild(lineDiv);
  });
  if (!el.classList.contains("hk-visible")) {
    el.classList.add("hk-visible");
  }
}

function showRamMalaComplete(line1, line2) {"""


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
    patch(STYLE_CSS, CSS_OLD, CSS_NEW, "ramWordIn keyframe + .ram-word class")
    patch(APP_JS, JS_OLD, JS_NEW, "spawnRam() builds per-word spin-in spans")
    print("Done. Rebuild/test in Ramanandi (Raam Vijay Mantra) mode and tap through a mala.")


if __name__ == "__main__":
    main()
