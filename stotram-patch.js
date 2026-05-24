/* ════════════════════════════════════════════════════════════
   stotram-patch.js  — add this line before </body> in index.html:
   <script src="./stotram-patch.js"></script>
   ════════════════════════════════════════════════════════════

   Adaptive text sizing: makes .lyr-line text as large as possible
   without breaking any line onto a second row.

   HOW IT WORKS (no binary search, no feedback loop):
   Font size and text width scale LINEARLY. So:
     1. Set font to MIN_PX.
     2. Force white-space:nowrap on every line and measure its
        natural (unwrapped) width — one batch reflow.
     3. Restore normal wrapping.
     4. Ideal size = container_width × MIN_PX / widest_line_width
     5. Clamp to [MIN_PX, MAX_PX].
     6. Apply — exactly ONE more reflow. Done.

   WHY THIS STOPS THE SHAKING:
   • No loop → no repeated style mutations → MutationObserver
     never re-triggers fitLyrLines.
   • Measurement happens at MIN_PX (small = no wrap), so
     scrollWidth is always the TRUE unwrapped text width.
   ════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  var MIN_PX = 14;
  var MAX_PX = 34;

  /* ── Core: fit one .lyr container ──────────────────────── */
  function fitOne(lyrEl) {
    var lines = lyrEl.querySelectorAll(".lyr-line");
    if (!lines.length) return;

    /* Available text width */
    var cw = lyrEl.getBoundingClientRect().width;
    if (cw < 4) return;

    /* Step 1 — set to MIN so text is definitely unwrapped */
    lyrEl.style.setProperty("--lyr-fs", MIN_PX + "px");

    /* Step 2 — batch-measure natural widths with nowrap */
    var maxW = 0;
    for (var i = 0; i < lines.length; i++) {
      lines[i].style.whiteSpace = "nowrap";
    }
    /* Single forced reflow here */
    for (var j = 0; j < lines.length; j++) {
      var w = lines[j].scrollWidth;
      if (w > maxW) maxW = w;
    }
    /* Step 3 — restore wrapping */
    for (var k = 0; k < lines.length; k++) {
      lines[k].style.whiteSpace = "";
    }

    if (maxW < 1) return;

    /* Step 4 — compute ideal size (linear scale) */
    var ideal = (cw / maxW) * MIN_PX;

    /* Step 5 — clamp */
    var best = Math.min(MAX_PX, Math.max(MIN_PX, ideal));

    /* Step 6 — apply (one final reflow) */
    lyrEl.style.setProperty("--lyr-fs", (Math.floor(best * 10) / 10) + "px");
  }

  /* ── Fit all .lyr elements inside the open modal ───────── */
  var _pending = false;

  function fit() {
    if (_pending) return;
    var modal = document.querySelector(".lmo");
    if (!modal || !modal.classList.contains("show")) return;

    _pending = true;
    requestAnimationFrame(function () {
      var lyrs = modal.querySelectorAll(".lyr");
      for (var i = 0; i < lyrs.length; i++) fitOne(lyrs[i]);
      _pending = false;
    });
  }

  /* Expose globally — app.js can call window.fitLyrLines()
     after it renders a new verse */
  window.fitLyrLines = fit;

  /* ── Re-fit on orientation / resize ────────────────────── */
  var _resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(fit, 200);
  });

  /* ── Watch modal visibility + verse changes ─────────────── */
  function init() {
    var modal = document.querySelector(".lmo");
    if (!modal) return;

    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        /* Only react to the modal's own class toggle (show/hide) */
        if (
          m.type === "attributes" &&
          m.target === modal &&
          m.attributeName === "class"
        ) {
          if (modal.classList.contains("show")) setTimeout(fit, 60);
          return;
        }
        /* New verse content injected */
        if (m.type === "childList" && m.addedNodes.length > 0) {
          setTimeout(fit, 60);
          return;
        }
      }
    }).observe(modal, {
      attributes:      true,
      attributeFilter: ["class"],   /* ← ONLY class changes, never style */
      childList:       true,
      subtree:         true,
    });

    /* Verse navigation clicks */
    modal.addEventListener("click", function (e) {
      var t = e.target;
      if (
        t.closest(".lm-arr") ||
        t.closest(".lm-dot") ||
        t.closest("[data-verse]")
      ) {
        setTimeout(fit, 100);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
