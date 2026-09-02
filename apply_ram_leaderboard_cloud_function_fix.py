#!/usr/bin/env python3
"""
apply_ram_leaderboard_cloud_function_fix.py

The client-side leaderboard push (pushLeaderboard()) was retired back
in mid-August in favor of a Firestore-triggered Cloud Function,
syncLeaderboardOnMainDataWrite (functions/index.js), which computes
and writes the leaderboard entry automatically and server-side
whenever users/{uid}/data/main is written.

That Cloud Function was written as a mirror of the old client-side
_buildLeaderboardPayload() — and inherited the exact same bug:
historyRam / timerHistoryRam / nameJapDeductRam were never added, so
Ramanandi (Ram Vijay Mantra) jap is silently excluded from totalJap,
streak, today's breakdown, and the pushed history — even though it's
saved correctly in the user's own data.

A previous client-side patch (apply_beadring_and_ram_leaderboard_fix.py)
fixed this in app.js's _buildLeaderboardPayload() — but since that
function is no longer what actually writes the leaderboard doc
(pushLeaderboard() is a no-op now), that fix has no real effect. This
patch fixes the ACTUAL leaderboard-writing code, in functions/index.js.

⚠ IMPORTANT — THIS REQUIRES A SEPARATE DEPLOY STEP.
Editing functions/index.js does nothing on its own. After running this
script you MUST redeploy the Cloud Function:

    cd functions && npm install   # only if you haven't already
    firebase deploy --only functions:syncLeaderboardOnMainDataWrite

Rebuilding/releasing the Android APK does NOT deploy this — it's a
completely separate artifact (Firebase Cloud Functions, not the app).

Run from the repo root:
    python3 apply_ram_leaderboard_cloud_function_fix.py
"""
import sys

FUNCTIONS_INDEX = "functions/index.js"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def must_replace(content, old, new, label):
    if old not in content:
        print(f"  ✗ ANCHOR NOT FOUND for: {label}")
        print("    (functions/index.js may have changed since this patch was")
        print("     written — aborting)")
        sys.exit(1)
    if content.count(old) > 1:
        print(f"  ⚠ anchor for '{label}' appears more than once — replacing all occurrences")
    return content.replace(old, new)


src = read(FUNCTIONS_INDEX)

print("[1/6] histRam extraction + lifetime totalJap…")
old = """    const histHK = data.historyHK || {};
    const hist28 = data.h28 || {};

    const totalRadha = _lbSumHistory(hist);
    const totalRV = _lbSumHistory(histRV);
    const totalKV = _lbSumHistory(histKV);
    const totalSS = _lbSumHistory(histSS);
    const totalHK = _lbSumHistory(histHK);
    const total28 = _lbSumHistory(hist28);

    const totalJap = Math.max(
      0,
      totalRadha + totalRV + totalKV + totalSS + totalHK + total28 -
        (data.nameJapDeduct || 0) -
        (data.nameJapDeductRV || 0) -
        (data.nameJapDeductKV || 0) -
        (data.nameJapDeductSS || 0) -
        (data.nameJapDeductHK || 0) -
        (data.nameJapDeduct28 || 0)
    );"""
new = """    const histHK = data.historyHK || {};
    const histRam = data.historyRam || {};
    const hist28 = data.h28 || {};

    const totalRadha = _lbSumHistory(hist);
    const totalRV = _lbSumHistory(histRV);
    const totalKV = _lbSumHistory(histKV);
    const totalSS = _lbSumHistory(histSS);
    const totalHK = _lbSumHistory(histHK);
    const totalRam = _lbSumHistory(histRam);
    const total28 = _lbSumHistory(hist28);

    const totalJap = Math.max(
      0,
      totalRadha + totalRV + totalKV + totalSS + totalHK + totalRam + total28 -
        (data.nameJapDeduct || 0) -
        (data.nameJapDeductRV || 0) -
        (data.nameJapDeductKV || 0) -
        (data.nameJapDeductSS || 0) -
        (data.nameJapDeductHK || 0) -
        (data.nameJapDeductRam || 0) -
        (data.nameJapDeduct28 || 0)
    );"""
src = must_replace(src, old, new, "histRam + totalJap")

print("[2/6] streak calc allHist…")
old = """      const allKeys = new Set([
        ...Object.keys(hist),
        ...Object.keys(histRV),
        ...Object.keys(histKV),
        ...Object.keys(histSS),
        ...Object.keys(histHK),
      ]);
      allKeys.forEach((k) => {
        allHist[k] =
          (hist[k] || 0) + (histRV[k] || 0) + (histKV[k] || 0) +
          (histSS[k] || 0) + (histHK[k] || 0);
      });"""
new = """      const allKeys = new Set([
        ...Object.keys(hist),
        ...Object.keys(histRV),
        ...Object.keys(histKV),
        ...Object.keys(histSS),
        ...Object.keys(histHK),
        ...Object.keys(histRam),
      ]);
      allKeys.forEach((k) => {
        allHist[k] =
          (hist[k] || 0) + (histRV[k] || 0) + (histKV[k] || 0) +
          (histSS[k] || 0) + (histHK[k] || 0) + (histRam[k] || 0);
      });"""
src = must_replace(src, old, new, "streak allHist")

print("[3/6] today's jap breakdown…")
old = """    const todayBreakdown = {
      r: hist[liveTk] || 0,
      rv: histRV[liveTk] || 0,
      kv: histKV[liveTk] || 0,
      ss: histSS[liveTk] || 0,
      hk: histHK[liveTk] || 0,
      n28: hist28[liveTk] || 0,
    };
    const timerHist = data.timerHistory || {};
    const timerHistRV = data.timerHistoryRV || {};
    const timerHistKV = data.timerHistoryKV || {};
    const timerHistSS = data.timerHistorySS || {};
    const timerHistHK = data.timerHistoryHK || {};
    const timer28Hist = data.timer28History || {};
    const todayTimeBreakdown = {
      r: timerHist[liveTk] || 0,
      rv: timerHistRV[liveTk] || 0,
      kv: timerHistKV[liveTk] || 0,
      ss: timerHistSS[liveTk] || 0,
      hk: timerHistHK[liveTk] || 0,
      n28: timer28Hist[liveTk] || 0,
    };
    const todayJap =
      todayBreakdown.r + todayBreakdown.rv + todayBreakdown.kv +
      todayBreakdown.ss + todayBreakdown.hk + todayBreakdown.n28;
    const todayTimerSeconds =
      todayTimeBreakdown.r + todayTimeBreakdown.rv + todayTimeBreakdown.kv +
      todayTimeBreakdown.ss + todayTimeBreakdown.hk + todayTimeBreakdown.n28;"""
new = """    const todayBreakdown = {
      r: hist[liveTk] || 0,
      rv: histRV[liveTk] || 0,
      kv: histKV[liveTk] || 0,
      ss: histSS[liveTk] || 0,
      hk: histHK[liveTk] || 0,
      ram: histRam[liveTk] || 0,
      n28: hist28[liveTk] || 0,
    };
    const timerHist = data.timerHistory || {};
    const timerHistRV = data.timerHistoryRV || {};
    const timerHistKV = data.timerHistoryKV || {};
    const timerHistSS = data.timerHistorySS || {};
    const timerHistHK = data.timerHistoryHK || {};
    const timerHistRam = data.timerHistoryRam || {};
    const timer28Hist = data.timer28History || {};
    const todayTimeBreakdown = {
      r: timerHist[liveTk] || 0,
      rv: timerHistRV[liveTk] || 0,
      kv: timerHistKV[liveTk] || 0,
      ss: timerHistSS[liveTk] || 0,
      hk: timerHistHK[liveTk] || 0,
      ram: timerHistRam[liveTk] || 0,
      n28: timer28Hist[liveTk] || 0,
    };
    const todayJap =
      todayBreakdown.r + todayBreakdown.rv + todayBreakdown.kv +
      todayBreakdown.ss + todayBreakdown.hk + todayBreakdown.ram + todayBreakdown.n28;
    const todayTimerSeconds =
      todayTimeBreakdown.r + todayTimeBreakdown.rv + todayTimeBreakdown.kv +
      todayTimeBreakdown.ss + todayTimeBreakdown.hk + todayTimeBreakdown.ram + todayTimeBreakdown.n28;"""
src = must_replace(src, old, new, "todayBreakdown + todayTimeBreakdown + todayJap/todayTimerSeconds")

print("[4/6] pushed history objects…")
old = """      history: hist,
      historyRV: histRV,
      historyKV: histKV,
      historySS: histSS,
      historyHK: histHK,
      history28: hist28,"""
new = """      history: hist,
      historyRV: histRV,
      historyKV: histKV,
      historySS: histSS,
      historyHK: histHK,
      historyRam: histRam,
      history28: hist28,"""
src = must_replace(src, old, new, "pushed history objects")

print("[5/6] deduct counters…")
old = """      nameJapDeduct: data.nameJapDeduct || 0,
      nameJapDeductRV: data.nameJapDeductRV || 0,
      nameJapDeductKV: data.nameJapDeductKV || 0,
      nameJapDeductSS: data.nameJapDeductSS || 0,
      nameJapDeductHK: data.nameJapDeductHK || 0,
      nameJapDeduct28: data.nameJapDeduct28 || 0,"""
new = """      nameJapDeduct: data.nameJapDeduct || 0,
      nameJapDeductRV: data.nameJapDeductRV || 0,
      nameJapDeductKV: data.nameJapDeductKV || 0,
      nameJapDeductSS: data.nameJapDeductSS || 0,
      nameJapDeductHK: data.nameJapDeductHK || 0,
      nameJapDeductRam: data.nameJapDeductRam || 0,
      nameJapDeduct28: data.nameJapDeduct28 || 0,"""
src = must_replace(src, old, new, "deduct counters")

print("[6/6] timerSeconds total + pushed timerHistory objects…")
old = """      timerSeconds:
        _lbSumHistory(timerHist) + _lbSumHistory(timerHistRV) +
        _lbSumHistory(timerHistKV) + _lbSumHistory(timerHistSS) +
        _lbSumHistory(timerHistHK) + _lbSumHistory(timer28Hist),
      timerHistory: timerHist,
      timerHistoryRV: timerHistRV,
      timerHistoryKV: timerHistKV,
      timerHistorySS: timerHistSS,
      timerHistoryHK: timerHistHK,
      timer28History: timer28Hist,"""
new = """      timerSeconds:
        _lbSumHistory(timerHist) + _lbSumHistory(timerHistRV) +
        _lbSumHistory(timerHistKV) + _lbSumHistory(timerHistSS) +
        _lbSumHistory(timerHistHK) + _lbSumHistory(timerHistRam) +
        _lbSumHistory(timer28Hist),
      timerHistory: timerHist,
      timerHistoryRV: timerHistRV,
      timerHistoryKV: timerHistKV,
      timerHistorySS: timerHistSS,
      timerHistoryHK: timerHistHK,
      timerHistoryRam: timerHistRam,
      timer28History: timer28Hist,"""
src = must_replace(src, old, new, "timerSeconds + pushed timerHistory objects")

write(FUNCTIONS_INDEX, src)
print("\nAll 6 edits applied to functions/index.js.")
print("\n" + "=" * 70)
print("⚠  YOU MUST DEPLOY THIS — editing the file alone does nothing live:")
print()
print("    cd functions")
print("    npm install   # only if node_modules isn't already set up")
print("    cd ..")
print("    firebase deploy --only functions:syncLeaderboardOnMainDataWrite")
print()
print("After deploying, existing leaderboard docs still won't retroactively")
print("update — each user's Ram total appears once their app next writes to")
print("users/{uid}/data/main (any tap, or app open), which re-triggers this")
print("function with the corrected logic.")
print("=" * 70)
