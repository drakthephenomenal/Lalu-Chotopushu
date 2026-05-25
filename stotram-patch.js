/* ════════════════════════════════════════════════════════════
   stotram-patch.js  — add before </body> in index.html:
   <script src="./stotram-patch.js"></script>

   KEY FIX vs previous versions:
   The control bar is now injected INSIDE #lmo (the modal div),
   not into document.body. Since #lmo uses display:none/flex to
   show/hide itself, the bar automatically appears and disappears
   with it — no MutationObserver toggling of display needed.

   Other fixes:
   • width:auto during measurement → correct auto-fit
   • Audio pause/resume button (⏸/▶)
   • Padding-bottom on scroll area when audio player is visible
   ════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var MIN_PX      = 10;
  var MAX_PX      = 48;
  var STEP        = 1;
  var STORAGE_KEY = "lyr_manual_px";

  var _autoFitPx = null;
  var _manualPx  = null;
  var _pending   = false;
  var _barBuilt  = false;
  var _audioEl   = null;

  try {
    var _sv = localStorage.getItem(STORAGE_KEY);
    if (_sv !== null) _manualPx = parseFloat(_sv);
  } catch (e) {}

  /* ══════════════════════════════════════════════════════════
     ADAPTIVE FONT SIZING
     Fix: also set width:auto so inline-block gives true text
     width rather than the container's 100% width.
  ══════════════════════════════════════════════════════════ */
  function autoFitOne(lyrEl) {
    var lines = lyrEl.querySelectorAll(".lyr-line");
    if (!lines.length) return null;

    var cw = lyrEl.getBoundingClientRect().width;
    if (cw < 4) return null;

    lyrEl.style.setProperty("--lyr-fs", MIN_PX + "px");

    var i;
    for (i = 0; i < lines.length; i++) {
      lines[i].style.display    = "inline-block";
      lines[i].style.width      = "auto";        /* critical fix */
      lines[i].style.whiteSpace = "nowrap";
    }
    /* One forced reflow — read all widths */
    var maxW = 0;
    for (i = 0; i < lines.length; i++) {
      if (lines[i].offsetWidth > maxW) maxW = lines[i].offsetWidth;
    }
    /* Restore */
    for (i = 0; i < lines.length; i++) {
      lines[i].style.display    = "";
      lines[i].style.width      = "";
      lines[i].style.whiteSpace = "";
    }

    if (maxW < 1) return null;
    var ideal = (cw / maxW) * MIN_PX;
    return Math.min(MAX_PX, Math.max(MIN_PX, ideal));
  }

  function applySize(px, modal) {
    var value = (Math.floor(px * 10) / 10) + "px";
    var lyrs  = modal.querySelectorAll(".lyr");
    for (var i = 0; i < lyrs.length; i++) {
      lyrs[i].style.setProperty("--lyr-fs", value);
      var lines = lyrs[i].querySelectorAll(".lyr-line");
      for (var j = 0; j < lines.length; j++) {
        lines[j].style.fontSize = value;  /* inline beats all CSS */
      }
    }
    updateLabel(Math.round(px) + "px");
  }

  function fit() {
    if (_pending) return;
    var modal = document.querySelector(".lmo");
    if (!modal || !modal.classList.contains("show")) return;

    _pending = true;
    requestAnimationFrame(function () {
      var lyrs    = modal.querySelectorAll(".lyr");
      var computed = lyrs.length ? autoFitOne(lyrs[0]) : null;
      if (computed !== null) _autoFitPx = computed;

      var target = (_manualPx !== null) ? _manualPx : _autoFitPx;
      if (target !== null) applySize(target, modal);
      _pending = false;
    });
  }

  function fitSoon() {
    [80, 300, 600, 1100, 2000].forEach(function (d) {
      setTimeout(fit, d);
    });
  }

  window.fitLyrLines = fit;

  var _resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(fit, 220);
  });

  /* ══════════════════════════════════════════════════════════
     CONTROL BAR — injected INSIDE #lmo
     Because it is a child of #lmo it shows and hides with the
     modal automatically. position:absolute + top/left places it
     relative to #lmo which is position:fixed covering the full
     viewport — so top:8px / left:8px = top-left of the screen.
  ══════════════════════════════════════════════════════════ */
  function buildBar() {
    if (_barBuilt) return;
    var modal = document.getElementById("lmo");
    if (!modal) return;
    _barBuilt = true;

    var wrap = document.createElement("div");
    wrap.id = "lyr-fs-ctrl";
    wrap.innerHTML =
      '<button id="lyr-fs-pause" style="display:none" title="Pause/Resume">⏸</button>' +
      '<button id="lyr-fs-down" title="Smaller">A<sup style="font-size:8px;vertical-align:top">−</sup></button>' +
      '<span id="lyr-fs-label">—</span>' +
      '<button id="lyr-fs-up" title="Larger">A<sup style="font-size:8px;vertical-align:top">+</sup></button>' +
      '<button id="lyr-fs-auto" style="display:none" title="Auto">↺</button>';

    modal.appendChild(wrap);   /* ← inside #lmo, not document.body */

    /* A− */
    document.getElementById("lyr-fs-down").addEventListener("click", function (e) {
      e.stopPropagation();
      var base = (_manualPx !== null) ? _manualPx
               : (_autoFitPx !== null) ? _autoFitPx : MIN_PX;
      _manualPx = Math.max(MIN_PX, Math.floor(base) - STEP);
      savePref();
      var m = document.querySelector(".lmo");
      if (m) applySize(_manualPx, m);
      refreshAutoBtn();
    });

    /* A+ */
    document.getElementById("lyr-fs-up").addEventListener("click", function (e) {
      e.stopPropagation();
      var base = (_manualPx !== null) ? _manualPx
               : (_autoFitPx !== null) ? _autoFitPx : MIN_PX;
      _manualPx = Math.min(MAX_PX, Math.floor(base) + STEP);
      savePref();
      var m = document.querySelector(".lmo");
      if (m) applySize(_manualPx, m);
      refreshAutoBtn();
    });

    /* ↺ auto reset */
    document.getElementById("lyr-fs-auto").addEventListener("click", function (e) {
      e.stopPropagation();
      _manualPx = null;
      savePref();
      refreshAutoBtn();
      fit();
    });

    /* ⏸ pause/resume */
    document.getElementById("lyr-fs-pause").addEventListener("click", function (e) {
      e.stopPropagation();
      if (!_audioEl) return;
      if (_audioEl.paused) { _audioEl.play(); }
      else                 { _audioEl.pause(); }
      syncPauseBtn();
    });
  }

  function updateLabel(text) {
    var el = document.getElementById("lyr-fs-label");
    if (el) el.textContent = text;
  }

  function refreshAutoBtn() {
    var el = document.getElementById("lyr-fs-auto");
    if (el) el.style.display = (_manualPx !== null) ? "inline-block" : "none";
  }

  function syncPauseBtn() {
    var btn = document.getElementById("lyr-fs-pause");
    if (!btn) return;
    if (!_audioEl || (_audioEl.ended)) {
      btn.style.display = "none";
      return;
    }
    btn.style.display = "inline-block";
    btn.textContent   = _audioEl.paused ? "▶" : "⏸";
    btn.title         = _audioEl.paused ? "Resume" : "Pause";
  }

  function savePref() {
    try {
      if (_manualPx === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(_manualPx));
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     SCROLL FIX DURING AUDIO PLAYBACK
     When the player renders at the bottom it overlaps the
     scroll area. We detect its height and add padding-bottom.
  ══════════════════════════════════════════════════════════ */
  function getPlayerHeight() {
    var ids = ["hcj-player-wrap", "lm-audio-player", "audio-player-wrap",
               "playerWrap", "player-wrap"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.offsetHeight > 20) return el.offsetHeight + 12;
    }
    /* Walk up from the <audio> element */
    if (_audioEl) {
      var p = _audioEl.parentElement;
      for (var k = 0; k < 5 && p; k++) {
        if (p.offsetHeight > 30 && p.offsetHeight < 300) return p.offsetHeight + 12;
        p = p.parentElement;
      }
    }
    return 110;
  }

  function setScrollPadding(active) {
    var modal = document.querySelector(".lmo");
    if (!modal) return;
    var inner = modal.querySelector(".lm-card-inner");
    if (inner) inner.style.paddingBottom = active ? getPlayerHeight() + "px" : "";
  }

  /* ══════════════════════════════════════════════════════════
     GLOBAL AUDIO DETECTION (capture phase catches everything)
  ══════════════════════════════════════════════════════════ */
  document.addEventListener("play", function (e) {
    if (!e.target || e.target.tagName !== "AUDIO") return;
    _audioEl = e.target;
    /* Remove old listeners to avoid stacking */
    _audioEl.removeEventListener("pause",  syncPauseBtn);
    _audioEl.removeEventListener("play",   syncPauseBtn);
    _audioEl.removeEventListener("ended",  onAudioEnded);
    _audioEl.addEventListener("pause",  syncPauseBtn);
    _audioEl.addEventListener("play",   syncPauseBtn);
    _audioEl.addEventListener("ended",  onAudioEnded);
    syncPauseBtn();
    setScrollPadding(true);
  }, true);

  function onAudioEnded() {
    setScrollPadding(false);
    syncPauseBtn();
  }

  document.addEventListener("pause", function (e) {
    if (e.target && e.target.tagName === "AUDIO") syncPauseBtn();
  }, true);

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  function init() {
    buildBar();   /* bar now lives inside #lmo — always in sync */

    var modal = document.querySelector(".lmo");
    if (!modal) return;

    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        /* Modal opened */
        if (m.type === "attributes" &&
            m.target === modal &&
            m.attributeName === "class") {
          if (modal.classList.contains("show")) fitSoon();
          return;
        }
        /* New verse lines injected */
        if (m.type === "childList" && m.addedNodes.length) {
          /* Ignore our own bar injection */
          if (m.addedNodes[0] && m.addedNodes[0].id === "lyr-fs-ctrl") continue;
          setTimeout(fit, 120);
          return;
        }
      }
    }).observe(modal, {
      attributes:      true,
      attributeFilter: ["class"],
      childList:       true,
      subtree:         true,
    });

    if (modal.classList.contains("show")) fitSoon();

    /* Nav clicks */
    modal.addEventListener("click", function (e) {
      if (e.target.closest(".lm-nav-btn") ||
          e.target.closest(".lm-arr")     ||
          e.target.closest(".lm-dot")     ||
          e.target.closest("[data-verse]")) {
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
