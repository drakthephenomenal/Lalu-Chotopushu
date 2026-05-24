/* ════════════════════════════════════════════════════════════
   stotram-patch.js  — add before </body> in index.html:
   <script src="./stotram-patch.js"></script>
   ════════════════════════════════════════════════════════════

   ROOT CAUSE OF "TEXT TOO SMALL" (fixed here):
   .lyr-line has  width:100%  in the original CSS.
   Switching to display:inline-block while keeping width:100%
   makes offsetWidth = container width (not text width), so the
   formula always returned MIN_PX.
   FIX: temporarily set  width:auto  during measurement.

   FONT BUTTONS: injected into document.body as position:fixed
   so they are always visible above everything else.
   ════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var MIN_PX      = 10;
  var MAX_PX      = 48;
  var STEP        = 1;
  var STORAGE_KEY = "lyr_manual_px";

  /* ── State ──────────────────────────────────────────────── */
  var _autoFitPx = null;
  var _manualPx  = null;
  var _pending   = false;

  try {
    var _saved = localStorage.getItem(STORAGE_KEY);
    if (_saved !== null) _manualPx = parseFloat(_saved);
  } catch (e) {}

  /* ── Measure + compute ideal px for one .lyr container ─── */
  function autoFitOne(lyrEl) {
    var lines = lyrEl.querySelectorAll(".lyr-line");
    if (!lines.length) return null;

    var cw = lyrEl.getBoundingClientRect().width;
    if (cw < 4) return null;

    /* Set baseline font via CSS variable */
    lyrEl.style.setProperty("--lyr-fs", MIN_PX + "px");

    /* Switch to inline-block + width:auto + nowrap for TRUE text width
       KEY FIX: width:auto overrides the original width:100% so
       offsetWidth reflects actual rendered text width, not the container */
    var i;
    for (i = 0; i < lines.length; i++) {
      lines[i].style.display    = "inline-block";
      lines[i].style.width      = "auto";        /* ← critical fix */
      lines[i].style.whiteSpace = "nowrap";
    }

    /* Single forced reflow — batch-read all widths */
    var maxW = 0;
    for (i = 0; i < lines.length; i++) {
      var w = lines[i].offsetWidth;
      if (w > maxW) maxW = w;
    }

    /* Restore */
    for (i = 0; i < lines.length; i++) {
      lines[i].style.display    = "";
      lines[i].style.width      = "";
      lines[i].style.whiteSpace = "";
    }

    if (maxW < 1) return null;

    /* Linear scale: at MIN_PX the widest line is maxW px wide.
       We want it to be exactly cw px wide → scale factor = cw/maxW */
    var ideal = (cw / maxW) * MIN_PX;
    return Math.min(MAX_PX, Math.max(MIN_PX, ideal));
  }

  /* ── Apply a font size to all .lyr elements in the modal ── */
  function applySize(px, modal) {
    var lyrs  = modal.querySelectorAll(".lyr");
    var value = (Math.floor(px * 10) / 10) + "px";
    for (var i = 0; i < lyrs.length; i++) {
      /* Set CSS variable (for any other consumers) */
      lyrs[i].style.setProperty("--lyr-fs", value);
      /* ALSO set directly on every .lyr-line (beats all CSS specificity) */
      var lines = lyrs[i].querySelectorAll(".lyr-line");
      for (var j = 0; j < lines.length; j++) {
        lines[j].style.fontSize = value;
      }
    }
    updateBarLabel(Math.round(px) + "px");
  }

  /* ── Main fit routine ───────────────────────────────────── */
  function fit() {
    if (_pending) return;
    var modal = document.querySelector(".lmo");
    if (!modal || !modal.classList.contains("show")) return;

    _pending = true;
    requestAnimationFrame(function () {
      var lyrs = modal.querySelectorAll(".lyr");
      var computed = null;
      if (lyrs.length) computed = autoFitOne(lyrs[0]);
      if (computed !== null) _autoFitPx = computed;

      var target = (_manualPx !== null) ? _manualPx : _autoFitPx;
      if (target !== null) applySize(target, modal);

      _pending = false;
    });
  }

  /* Retry several times with growing delays after modal opens,
     because lyrics are loaded asynchronously by stotrams.js   */
  function fitWithRetries() {
    var delays = [80, 250, 500, 900, 1500];
    for (var d = 0; d < delays.length; d++) {
      (function (delay) {
        setTimeout(fit, delay);
      })(delays[d]);
    }
  }

  window.fitLyrLines = fit;   /* app.js can call this */

  /* ── Resize ─────────────────────────────────────────────── */
  var _resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(fit, 220);
  });

  /* ════════════════════════════════════════════════════════
     FONT SIZE CONTROL BAR
     Injected into document.body as position:fixed so it
     floats above everything, regardless of modal z-index.
  ════════════════════════════════════════════════════════ */

  var _barEl = null;

  function buildBar() {
    if (_barEl) return;

    var wrap = document.createElement("div");
    wrap.id = "lyr-fs-ctrl";
    wrap.innerHTML =
      '<button id="lyr-fs-down" title="Smaller text">A<sup style="font-size:9px">−</sup></button>' +
      '<span id="lyr-fs-label">auto</span>' +
      '<button id="lyr-fs-up" title="Larger text">A<sup style="font-size:9px">+</sup></button>' +
      '<button id="lyr-fs-auto" title="Back to auto">↺</button>';

    document.body.appendChild(wrap);
    _barEl = wrap;

    /* ── Button handlers ─────────────────────────────────── */
    document.getElementById("lyr-fs-down").addEventListener("click", function (e) {
      e.stopPropagation();
      var base = (_manualPx !== null) ? _manualPx
               : (_autoFitPx !== null) ? _autoFitPx : MIN_PX;
      _manualPx = Math.max(MIN_PX, Math.floor(base) - STEP);
      savePref();
      var m = document.querySelector(".lmo");
      if (m) applySize(_manualPx, m);
    });

    document.getElementById("lyr-fs-up").addEventListener("click", function (e) {
      e.stopPropagation();
      var base = (_manualPx !== null) ? _manualPx
               : (_autoFitPx !== null) ? _autoFitPx : MIN_PX;
      _manualPx = Math.min(MAX_PX, Math.floor(base) + STEP);
      savePref();
      var m = document.querySelector(".lmo");
      if (m) applySize(_manualPx, m);
    });

    document.getElementById("lyr-fs-auto").addEventListener("click", function (e) {
      e.stopPropagation();
      _manualPx = null;
      savePref();
      fit();
    });
  }

  function showBar(show) {
    if (!_barEl) buildBar();
    _barEl.style.display = show ? "flex" : "none";
    /* Hide reset button when in auto mode */
    var autoBtn = document.getElementById("lyr-fs-auto");
    if (autoBtn) autoBtn.style.display = (_manualPx !== null) ? "inline-block" : "none";
  }

  function updateBarLabel(text) {
    var label = document.getElementById("lyr-fs-label");
    if (label) label.textContent = text;
    var autoBtn = document.getElementById("lyr-fs-auto");
    if (autoBtn) autoBtn.style.display = (_manualPx !== null) ? "inline-block" : "none";
  }

  function savePref() {
    try {
      if (_manualPx === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(_manualPx));
    } catch (e) {}
  }

  /* ── Watch modal open/close and verse content changes ───── */
  function init() {
    buildBar();   /* build bar immediately so it's ready */

    var modal = document.querySelector(".lmo");
    if (!modal) return;

    /* Watch for modal show/hide AND new verse content */
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];

        /* Modal class changed (show/hide toggled) */
        if (
          m.type === "attributes" &&
          m.target === modal &&
          m.attributeName === "class"
        ) {
          var isOpen = modal.classList.contains("show");
          showBar(isOpen);
          if (isOpen) fitWithRetries();
          return;
        }

        /* New verse lines injected into #lyrBody */
        if (m.type === "childList" && m.addedNodes.length > 0) {
          /* Ignore our own bar insertion (it's in body, not modal) */
          if (
            m.addedNodes[0] &&
            m.addedNodes[0].id === "lyr-fs-ctrl"
          ) continue;
          setTimeout(fit, 100);
          return;
        }
      }
    }).observe(modal, {
      attributes:      true,
      attributeFilter: ["class"],
      childList:       true,
      subtree:         true,
    });

    /* Also observe body so we catch the modal becoming visible
       if it was already in the DOM with class="lmo show"        */
    if (modal.classList.contains("show")) {
      showBar(true);
      fitWithRetries();
    }

    /* Nav clicks */
    modal.addEventListener("click", function (e) {
      if (
        e.target.closest(".lm-arr") ||
        e.target.closest(".lm-nav-btn") ||
        e.target.closest(".lm-dot") ||
        e.target.closest("[data-verse]")
      ) {
        setTimeout(fit, 150);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
