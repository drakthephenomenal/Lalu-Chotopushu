/* ════════════════════════════════════════════════════════════
   stotram-patch.js  — add before </body> in index.html:
   <script src="./stotram-patch.js"></script>
   ════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── Config ─────────────────────────────────────────────── */
  var MIN_PX      = 10;
  var MAX_PX      = 48;
  var STEP        = 1;          /* px per tap                  */
  var STORAGE_KEY = "lyr_manual_px";

  /* ── State ──────────────────────────────────────────────── */
  var _autoFitPx  = null;       /* last computed auto size     */
  var _manualPx   = null;       /* null = auto mode            */

  /* Restore saved preference */
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) _manualPx = parseFloat(saved);
  } catch (e) {}

  /* ── Compute auto size for one .lyr container ───────────── */
  function autoFitOne(lyrEl) {
    var lines = lyrEl.querySelectorAll(".lyr-line");
    if (!lines.length) return null;

    var cw = lyrEl.getBoundingClientRect().width;
    if (cw < 4) return null;

    /* Baseline: set MIN_PX, convert to inline-block for true width */
    lyrEl.style.setProperty("--lyr-fs", MIN_PX + "px");

    for (var i = 0; i < lines.length; i++) {
      lines[i].style.display    = "inline-block";
      lines[i].style.whiteSpace = "nowrap";
    }
    var maxW = 0;
    for (var j = 0; j < lines.length; j++) {
      var w = lines[j].offsetWidth;
      if (w > maxW) maxW = w;
    }
    for (var k = 0; k < lines.length; k++) {
      lines[k].style.display    = "";
      lines[k].style.whiteSpace = "";
    }

    if (maxW < 1) return null;

    var ideal = (cw / maxW) * MIN_PX;
    return Math.min(MAX_PX, Math.max(MIN_PX, ideal));
  }

  /* ── Apply a px value to all .lyr elements in modal ────── */
  function applySize(px, modal) {
    var lyrs = modal.querySelectorAll(".lyr");
    for (var i = 0; i < lyrs.length; i++) {
      lyrs[i].style.setProperty(
        "--lyr-fs", (Math.floor(px * 10) / 10) + "px"
      );
    }
    updateUI(modal, px);
  }

  /* ── Main fit routine ───────────────────────────────────── */
  var _pending = false;

  function fit() {
    if (_pending) return;
    var modal = document.querySelector(".lmo");
    if (!modal || !modal.classList.contains("show")) return;

    _pending = true;
    requestAnimationFrame(function () {
      /* Compute auto size from the first .lyr (all share same container) */
      var lyrs = modal.querySelectorAll(".lyr");
      if (lyrs.length) {
        var computed = autoFitOne(lyrs[0]);
        if (computed !== null) _autoFitPx = computed;
      }

      /* Apply manual override or auto */
      var target = (_manualPx !== null) ? _manualPx : _autoFitPx;
      if (target !== null) {
        /* Apply same size to ALL .lyr containers */
        for (var i = 0; i < lyrs.length; i++) {
          lyrs[i].style.setProperty(
            "--lyr-fs", (Math.floor(target * 10) / 10) + "px"
          );
        }
        updateUI(modal, target);
      }
      _pending = false;
    });
  }

  window.fitLyrLines = fit;

  /* ── Font control UI ─────────────────────────────────────
     Injected once into .lmo. Shows current size, A−/A+ buttons,
     and a ↺ reset-to-auto button (visible only in manual mode).  */

  var _uiEl = null;

  function buildUI(modal) {
    if (_uiEl) return;                  /* already built */

    var wrap = document.createElement("div");
    wrap.id = "lyr-fs-ctrl";
    wrap.innerHTML =
      '<button id="lyr-fs-down" title="Smaller">A<sup>−</sup></button>' +
      '<span id="lyr-fs-label">auto</span>' +
      '<button id="lyr-fs-up"   title="Larger">A<sup>+</sup></button>' +
      '<button id="lyr-fs-auto" title="Reset to auto">↺</button>';

    /* Inject after .lm-card-inner so it floats above the frame */
    modal.appendChild(wrap);
    _uiEl = wrap;

    /* Styles (injected once, scoped to #lyr-fs-ctrl) */
    var style = document.createElement("style");
    style.textContent = [
      "#lyr-fs-ctrl {",
      "  position: absolute;",
      "  top: 10px;",
      "  right: 12px;",
      "  z-index: 60;",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 4px;",
      "  background: rgba(3,10,20,0.72);",
      "  border-radius: 20px;",
      "  padding: 4px 8px;",
      "  touch-action: manipulation;",
      "  user-select: none;",
      "}",
      "#lyr-fs-ctrl button {",
      "  background: rgba(255,220,120,0.15);",
      "  border: 1px solid rgba(255,220,120,0.5);",
      "  border-radius: 12px;",
      "  color: #ffd87a;",
      "  font-size: 14px;",
      "  line-height: 1;",
      "  padding: 3px 8px;",
      "  cursor: pointer;",
      "  min-width: 30px;",
      "  -webkit-tap-highlight-color: transparent;",
      "}",
      "#lyr-fs-ctrl button:active {",
      "  background: rgba(255,220,120,0.35);",
      "}",
      "#lyr-fs-label {",
      "  color: #ffd87a;",
      "  font-size: 12px;",
      "  min-width: 32px;",
      "  text-align: center;",
      "  font-family: monospace;",
      "}",
      "#lyr-fs-auto {",
      "  display: none;",   /* hidden in auto mode */
      "}"
    ].join("\n");
    document.head.appendChild(style);

    /* Button handlers */
    document.getElementById("lyr-fs-down").addEventListener("click", function (e) {
      e.stopPropagation();
      var base = (_manualPx !== null) ? _manualPx
               : (_autoFitPx !== null) ? _autoFitPx : MIN_PX;
      _manualPx = Math.max(MIN_PX, base - STEP);
      saveManual();
      var modal2 = document.querySelector(".lmo");
      if (modal2) applySize(_manualPx, modal2);
    });

    document.getElementById("lyr-fs-up").addEventListener("click", function (e) {
      e.stopPropagation();
      var base = (_manualPx !== null) ? _manualPx
               : (_autoFitPx !== null) ? _autoFitPx : MIN_PX;
      _manualPx = Math.min(MAX_PX, base + STEP);
      saveManual();
      var modal2 = document.querySelector(".lmo");
      if (modal2) applySize(_manualPx, modal2);
    });

    document.getElementById("lyr-fs-auto").addEventListener("click", function (e) {
      e.stopPropagation();
      _manualPx = null;
      saveManual();
      fit();
    });
  }

  function updateUI(modal, currentPx) {
    if (!_uiEl) return;
    var label = modal.querySelector("#lyr-fs-label");
    var resetBtn = modal.querySelector("#lyr-fs-auto");
    if (label) label.textContent = Math.round(currentPx) + "px";
    if (resetBtn) resetBtn.style.display = (_manualPx !== null) ? "inline-flex" : "none";
  }

  function saveManual() {
    try {
      if (_manualPx === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, _manualPx);
    } catch (e) {}
  }

  /* ── Resize / orientation ───────────────────────────────── */
  var _resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(fit, 220);
  });

  /* ── Watch modal open/close + verse swaps ───────────────── */
  function init() {
    var modal = document.querySelector(".lmo");
    if (!modal) return;

    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (
          m.type === "attributes" &&
          m.target === modal &&
          m.attributeName === "class"
        ) {
          if (modal.classList.contains("show")) {
            buildUI(modal);
            setTimeout(fit, 80);
          }
          return;
        }
        if (m.type === "childList" && m.addedNodes.length > 0) {
          setTimeout(fit, 80);
          return;
        }
      }
    }).observe(modal, {
      attributes:      true,
      attributeFilter: ["class"],
      childList:       true,
      subtree:         true,
    });

    modal.addEventListener("click", function (e) {
      if (
        e.target.closest(".lm-arr") ||
        e.target.closest(".lm-dot") ||
        e.target.closest("[data-verse]")
      ) {
        setTimeout(fit, 120);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
