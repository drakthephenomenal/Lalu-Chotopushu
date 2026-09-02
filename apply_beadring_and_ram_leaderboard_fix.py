#!/usr/bin/env python3
"""
apply_beadring_and_ram_leaderboard_fix.py

Fixes two bugs:

1. Bead ring still misaligned right after switching TO Ramanandi mode
   (and generally after ANY naam/mode switch), only fixing itself once
   you reopen the mantra-name dropdown.
   Root cause: switchJapMode() changes the title/target-box text (which
   can change the bead-frame wrap's width) but never calls
   renderBeadFrame() itself. The earlier fix in _placeTarget28Card()
   fires BEFORE switchJapMode() runs (wrong order), so it measures the
   wrap before the real layout change lands. It only "looked fixed"
   before because reopening the dropdown happened to trigger a stray
   `resize` event that re-ran renderBeadFrame() by accident.
   Fix: call renderBeadFrame() (double rAF, to wait for layout) at the
   very end of switchJapMode() itself, so every mode/naam switch is
   covered directly instead of relying on an accidental resize event.

2. Ramanandi mode's jap totals never reach the leaderboard.
   Root cause: _buildLeaderboardPayload() computes totalJap, today's
   breakdown, today's time breakdown, streak, and the pushed
   history/timerHistory objects from history/historyRV/historyKV/
   historySS/historyHK/hist28 — historyRam and timerHistoryRam were
   never added when Ramanandi mode was introduced. Ram taps are
   recorded locally (App.S.historyRam) but silently excluded from
   every leaderboard calculation.
   Fix: add historyRam/timerHistoryRam/nameJapDeductRam into every
   relevant sum and into the pushed payload, mirroring how hk/ss/kv
   are already handled.

Run from the repo root:
    python3 apply_beadring_and_ram_leaderboard_fix.py
"""
import sys

APP_JS = "app.js"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def must_replace(content, old, new, label):
    if old not in content:
        print(f"  ✗ ANCHOR NOT FOUND for: {label}")
        print("    (file may have changed since this patch was written — aborting)")
        sys.exit(1)
    if content.count(old) > 1:
        print(f"  ⚠ anchor for '{label}' appears more than once — replacing all occurrences")
    return content.replace(old, new)


app = read(APP_JS)

# ─────────────────────────────────────────────────────────────────
# 1. switchJapMode(): re-sync bead ring at the very end
# ─────────────────────────────────────────────────────────────────
print("[1/2] Making switchJapMode() re-sync the bead ring directly…")

old = """  toast(toastMap[mode] || _nt.radha + " 🙏");
}

function escHtml(t) {"""

new = """  toast(toastMap[mode] || _nt.radha + " 🙏");

  // Title/target-box text just changed (can resize beadFrameWrap, e.g.
  // going into Ramanandi/Gaudiya/Trahimam mode). Re-sync the 108-bead
  // ring once the browser has reflowed the new layout, instead of
  // relying on an accidental resize event to fix it later.
  if (typeof renderBeadFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(() => renderBeadFrame()));
  }
}

function escHtml(t) {"""

app = must_replace(app, old, new, "end of switchJapMode()")
print("  ✓ switchJapMode() now re-syncs the bead ring on every call.")

# ─────────────────────────────────────────────────────────────────
# 2. _buildLeaderboardPayload(): include Ramanandi (Ram) totals
# ─────────────────────────────────────────────────────────────────
print("[2/2] Including Ramanandi mode in the leaderboard payload…")

# 2a. lifetime totals
old = """  const histHK = S.historyHK || {};
  const hist28 = S.h28 || {};
  const totalRadha = Object.values(hist).reduce((a,b)=>a+b,0);
  const totalRV    = Object.values(histRV).reduce((a,b)=>a+b,0);
  const totalKV    = Object.values(histKV).reduce((a,b)=>a+b,0);
  const totalSS    = Object.values(histSS).reduce((a,b)=>a+b,0);
  const totalHK    = Object.values(histHK).reduce((a,b)=>a+b,0);
  const total28    = Object.values(hist28).reduce((a,b)=>a+b,0);
  const totalJap   = Math.max(0, totalRadha + totalRV + totalKV + totalSS + totalHK + total28 - (S.nameJapDeduct||0) - (S.nameJapDeductRV||0) - (S.nameJapDeductKV||0) - (S.nameJapDeductSS||0) - (S.nameJapDeductHK||0) - (S.nameJapDeduct28||0));"""
new = """  const histHK = S.historyHK || {};
  const histRam = S.historyRam || {};
  const hist28 = S.h28 || {};
  const totalRadha = Object.values(hist).reduce((a,b)=>a+b,0);
  const totalRV    = Object.values(histRV).reduce((a,b)=>a+b,0);
  const totalKV    = Object.values(histKV).reduce((a,b)=>a+b,0);
  const totalSS    = Object.values(histSS).reduce((a,b)=>a+b,0);
  const totalHK    = Object.values(histHK).reduce((a,b)=>a+b,0);
  const totalRam   = Object.values(histRam).reduce((a,b)=>a+b,0);
  const total28    = Object.values(hist28).reduce((a,b)=>a+b,0);
  const totalJap   = Math.max(0, totalRadha + totalRV + totalKV + totalSS + totalHK + totalRam + total28 - (S.nameJapDeduct||0) - (S.nameJapDeductRV||0) - (S.nameJapDeductKV||0) - (S.nameJapDeductSS||0) - (S.nameJapDeductHK||0) - (S.nameJapDeductRam||0) - (S.nameJapDeduct28||0));"""
app = must_replace(app, old, new, "lifetime totals (totalJap)")

# 2b. streak calc's allHist
old = """    Object.keys({...hist,...histRV,...histKV,...histSS,...histHK}).forEach(function(k) {
      allHist[k] = (hist[k]||0)+(histRV[k]||0)+(histKV[k]||0)+(histSS[k]||0)+(histHK[k]||0);
    });"""
new = """    Object.keys({...hist,...histRV,...histKV,...histSS,...histHK,...histRam}).forEach(function(k) {
      allHist[k] = (hist[k]||0)+(histRV[k]||0)+(histKV[k]||0)+(histSS[k]||0)+(histHK[k]||0)+(histRam[k]||0);
    });"""
app = must_replace(app, old, new, "streak allHist")

# 2c. today's jap breakdown
old = """  const todayBreakdown = {
    r: hist[liveTk] || 0,
    rv: histRV[liveTk] || 0,
    kv: histKV[liveTk] || 0,
    ss: histSS[liveTk] || 0,
    hk: histHK[liveTk] || 0,
    n28: hist28[liveTk] || 0,
  };"""
new = """  const todayBreakdown = {
    r: hist[liveTk] || 0,
    rv: histRV[liveTk] || 0,
    kv: histKV[liveTk] || 0,
    ss: histSS[liveTk] || 0,
    hk: histHK[liveTk] || 0,
    ram: histRam[liveTk] || 0,
    n28: hist28[liveTk] || 0,
  };"""
app = must_replace(app, old, new, "todayBreakdown")

# 2d. today's timer breakdown
old = """    hk: (S.timerHistoryHK || {})[liveTk] || 0,
    n28: (S.timer28History || {})[liveTk] || 0,
  };
  const todayJap = todayBreakdown.r + todayBreakdown.rv + todayBreakdown.kv + todayBreakdown.ss + todayBreakdown.hk + todayBreakdown.n28;
  const todayTimerSeconds = todayTimeBreakdown.r + todayTimeBreakdown.rv + todayTimeBreakdown.kv + todayTimeBreakdown.ss + todayTimeBreakdown.hk + todayTimeBreakdown.n28;"""
new = """    hk: (S.timerHistoryHK || {})[liveTk] || 0,
    ram: (S.timerHistoryRam || {})[liveTk] || 0,
    n28: (S.timer28History || {})[liveTk] || 0,
  };
  const todayJap = todayBreakdown.r + todayBreakdown.rv + todayBreakdown.kv + todayBreakdown.ss + todayBreakdown.hk + todayBreakdown.ram + todayBreakdown.n28;
  const todayTimerSeconds = todayTimeBreakdown.r + todayTimeBreakdown.rv + todayTimeBreakdown.kv + todayTimeBreakdown.ss + todayTimeBreakdown.hk + todayTimeBreakdown.ram + todayTimeBreakdown.n28;"""
app = must_replace(app, old, new, "todayTimeBreakdown + todayJap/todayTimerSeconds")

# 2e. pushed history/timerHistory objects + deduct counters
old = """    history:   hist,
    historyRV: histRV,
    historyKV: histKV,
    historySS: histSS,
    historyHK: histHK,
    history28: hist28,"""
new = """    history:   hist,
    historyRV: histRV,
    historyKV: histKV,
    historySS: histSS,
    historyHK: histHK,
    historyRam: histRam,
    history28: hist28,"""
app = must_replace(app, old, new, "pushed history objects")

old = """    nameJapDeduct:   S.nameJapDeduct   || 0,
    nameJapDeductRV: S.nameJapDeductRV || 0,
    nameJapDeductKV: S.nameJapDeductKV || 0,
    nameJapDeductSS: S.nameJapDeductSS || 0,
    nameJapDeductHK: S.nameJapDeductHK || 0,
    nameJapDeduct28: S.nameJapDeduct28 || 0,
    // Push total timer seconds for leaderboard display
    timerSeconds: Object.values(S.timerHistory || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistoryRV || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistoryKV || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistorySS || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistoryHK || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timer28History || {}).reduce((a,b)=>a+b,0),
    timerHistory:   S.timerHistory || {},
    timerHistoryRV: S.timerHistoryRV || {},
    timerHistoryKV: S.timerHistoryKV || {},
    timerHistorySS: S.timerHistorySS || {},
    timerHistoryHK: S.timerHistoryHK || {},
    timer28History: S.timer28History || {},"""
new = """    nameJapDeduct:   S.nameJapDeduct   || 0,
    nameJapDeductRV: S.nameJapDeductRV || 0,
    nameJapDeductKV: S.nameJapDeductKV || 0,
    nameJapDeductSS: S.nameJapDeductSS || 0,
    nameJapDeductHK: S.nameJapDeductHK || 0,
    nameJapDeductRam: S.nameJapDeductRam || 0,
    nameJapDeduct28: S.nameJapDeduct28 || 0,
    // Push total timer seconds for leaderboard display
    timerSeconds: Object.values(S.timerHistory || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistoryRV || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistoryKV || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistorySS || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistoryHK || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timerHistoryRam || {}).reduce((a,b)=>a+b,0) +
                  Object.values(S.timer28History || {}).reduce((a,b)=>a+b,0),
    timerHistory:   S.timerHistory || {},
    timerHistoryRV: S.timerHistoryRV || {},
    timerHistoryKV: S.timerHistoryKV || {},
    timerHistorySS: S.timerHistorySS || {},
    timerHistoryHK: S.timerHistoryHK || {},
    timerHistoryRam: S.timerHistoryRam || {},
    timer28History: S.timer28History || {},"""
app = must_replace(app, old, new, "pushed timerHistory objects + deduct counters + timerSeconds")

write(APP_JS, app)
print("  ✓ Ramanandi (Ram) totals now flow into totalJap, streak, today's")
print("    breakdown, and the full pushed history — same as HK/SS/KV.")

print("\nAll patches applied successfully.")
print("Note: existing leaderboard docs pushed BEFORE this fix won't retroactively")
print("gain their Ram totals until each user's app pushes again (next tap, or")
print("next app open — pushLeaderboard() already runs on those triggers).")
