#!/usr/bin/env python3
"""fix-screen-session.py - run once from the repo root:  python3 fix-screen-session.py
The Screen Time box keeps looking and counting exactly as before (today's total).  Swipe it left or right and it shows
THIS SESSION's screen time (time on the jap / 28-names screen since the app was opened); swipe again -> today's total.
Two tiny dots in the box corner show which one you are looking at.  Works on the Jap screen and the 28 Names screen.
Safe to run twice."""
import os, re, sys
if not os.path.exists('app.js'): sys.exit('app.js not found - run from the repo root')
s = open('app.js', encoding='utf-8').read()
if '_scrSessionSec' in s:
    print('already applied'); sys.exit(0)

def rep(old, new, label):
    global s
    if s.count(old) < 1: sys.exit('PATTERN NOT FOUND: %s - the file changed, send me app.js' % label)
    s = s.replace(old, new, 1); print('  patched:', label)

rep("  _screenTimeRunning: false,\n  _screenTimeInterval: null,",
    "  _screenTimeRunning: false,\n  _screenTimeInterval: null,\n  _scrSessionSec: 0,      // screen time since the app was opened (not saved - a new app start is a new session)\n  _scrMode: \"today\",      // what the Screen Time box shows: \"today\" (total) or \"session\"",
    'session counter + mode')
rep("      this.S.screenTimeHistory[tk] = (this.S.screenTimeHistory[tk] || 0) + 1;\n      try {\n        localStorage.setItem(\"rjap_screenTimeHistory\"",
    "      this.S.screenTimeHistory[tk] = (this.S.screenTimeHistory[tk] || 0) + 1;\n      this._scrSessionSec = (this._scrSessionSec || 0) + 1;\n      try {\n        localStorage.setItem(\"rjap_screenTimeHistory\"",
    'count session seconds')
rep('''  updateScreenTimeDisplay() {
    const sec = (this.S.screenTimeHistory && this.S.screenTimeHistory[this.S.tk]) || 0;
    const e1 = document.getElementById("screenTimeDisplay");
    if (e1) e1.textContent = this.fmtTime(sec);
    const e2 = document.getElementById("n28ScreenTimeDisplay");
    if (e2) e2.textContent = this.fmtTime(sec);
  },''',
'''  updateScreenTimeDisplay() {
    const today = (this.S.screenTimeHistory && this.S.screenTimeHistory[this.S.tk]) || 0;
    const mode = this._scrMode === "session" ? "session" : "today";
    const sec = mode === "session" ? (this._scrSessionSec || 0) : today;
    ["screenTimeDisplay", "n28ScreenTimeDisplay"].forEach((id) => {
      const e = document.getElementById(id);
      if (!e) return;
      e.textContent = this.fmtTime(sec);
      const box = e.closest ? e.closest(".timer-box") : null;
      if (box) {
        box.setAttribute("data-scr-mode", mode);
        const lbl = box.querySelector(".timer-box-lbl");
        if (lbl) lbl.textContent = mode === "session" ? "Screen · Session" : "Screen Time";
      }
    });
  },
  // Swipe on the Screen Time box: today's total <-> this session
  toggleScreenTimeMode() {
    this._scrMode = this._scrMode === "session" ? "today" : "session";
    ["screenTimeDisplay", "n28ScreenTimeDisplay"].forEach((id) => {
      const e = document.getElementById(id), box = e && e.closest ? e.closest(".timer-box") : null;
      if (box) { box.classList.add("scr-flip"); setTimeout(() => box.classList.remove("scr-flip"), 170); }
    });
    this.updateScreenTimeDisplay();
  },''', 'display shows today / session')

s = s.rstrip('\n') + '''

// ── Screen Time box: swipe left/right to switch between today's total and this session ──
(function () {
  function css() {
    if (document.getElementById("scrSwipeCss")) return;
    const st = document.createElement("style");
    st.id = "scrSwipeCss";
    st.textContent =
      ".timer-box.scr-swipe{position:relative;touch-action:pan-y;-webkit-user-select:none;user-select:none}" +
      ".scr-dots{position:absolute;top:4px;right:5px;display:flex;gap:3px;pointer-events:none}" +
      ".scr-dots i{display:block;width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.28)}" +
      ".timer-box[data-scr-mode=today] .scr-dots i:nth-child(1),.timer-box[data-scr-mode=session] .scr-dots i:nth-child(2){background:#f5d17a}" +
      ".timer-box.scr-swipe .timer-display{transition:opacity .17s}.timer-box.scr-flip .timer-display{opacity:.12}";
    document.head.appendChild(st);
  }
  function attach(id) {
    const e = document.getElementById(id), box = e && e.closest ? e.closest(".timer-box") : null;
    if (!box || box.__scrSwipe) return;
    box.__scrSwipe = true;
    box.classList.add("scr-swipe");
    box.setAttribute("data-scr-mode", App._scrMode === "session" ? "session" : "today");
    const dots = document.createElement("span");
    dots.className = "scr-dots"; dots.setAttribute("aria-hidden", "true"); dots.innerHTML = "<i></i><i></i>";
    box.appendChild(dots);
    box.title = "Swipe: today / this session";
    let x0 = 0, y0 = 0, t0 = 0, on = false;
    box.addEventListener("pointerdown", (ev) => { x0 = ev.clientX; y0 = ev.clientY; t0 = Date.now(); on = true; });
    box.addEventListener("pointercancel", () => { on = false; });
    box.addEventListener("pointerup", (ev) => {
      if (!on) return; on = false;
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (Math.abs(dx) >= 28 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - t0 < 900) App.toggleScreenTimeMode();
    });
  }
  function setup() {
    if (typeof App === "undefined" || !App || !document.getElementById("screenTimeDisplay")) return setTimeout(setup, 150);
    css(); attach("screenTimeDisplay"); attach("n28ScreenTimeDisplay"); App.updateScreenTimeDisplay();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();
})();
'''
open('app.js', 'w', encoding='utf-8').write(s)

if os.path.exists('index.html'):
    h = open('index.html', encoding='utf-8').read()
    h = re.sub(r'app\.js\?v=(\d+)', lambda m: 'app.js?v=%d' % (int(m.group(1)) + 1), h, count=1)
    open('index.html', 'w', encoding='utf-8').write(h); print('  patched: app.js version bump')
print('done')
