#!/usr/bin/env python3
"""
apply_sync_retry_and_leaderboard_fix.py  (v2 -- single atomic batch)

Supersedes any earlier version of this script. Folds the main history
doc AND the leaderboard doc into a SINGLE atomic Firestore batch under
one retry ladder, instead of two decoupled writes -- eliminating the
leaderboard-vs-ghost-mode count mismatch structurally, not just making
the leaderboard write "more reliable" on its own.

Also adds a tap-to-retry affordance to the sync pill: tapping it while
red (error state) now calls retrySync(), which re-runs the full sync.

All old_str values in this script were extracted VERBATIM from the
actual repo file (byte-for-byte, via Python line-slicing) rather than
hand-retyped, specifically to avoid silent mismatches from smart
punctuation (em dashes, curly quotes) that plain retyping can introduce.

Patches app.js, index.html, and style.css -- both the repo-root copies
and the www/ copies. Idempotent: safe to re-run; makes a
.bak-syncretryfix of each file before its first successful patch.

Usage:
    python3 apply_sync_retry_and_leaderboard_fix.py
"""

import os
import shutil
import sys

MARKER = 'v2 - single atomic batch: main doc + leaderboard doc'

APPJS_OLD_1 = "async function pushLeaderboard() {\n  if (!fbUser || !fbDb) return;\n  if (isGhostMode()) return; // ghost mode: read-only\n  // CRITICAL: never read/write the leaderboard from a half-loaded App.S.\n  // Before the cloud pull (fbMigrate) finishes, App.S.lbOptIn/history/etc.\n  // may still hold defaults (e.g. lbOptIn:false) or a partial local cache,\n  // not the user's real data. Pushing at that point can wrongly DELETE a\n  // real opt-in entry, or overwrite it with an incomplete score. Bail out\n  // until App._cloudHydrated is confirmed true; callers that fire on a\n  // fixed timer should await _waitForCloudHydration() first (see below).\n  if (!App._cloudHydrated) return;\n  if (!App.S.lbOptIn) {\n    // If opted out, remove the entry\n    try {\n      await fbDb.collection('leaderboard').doc(fbUser.uid).delete();\n    } catch(_) {}\n    return;\n  }\n\n  // Use a live date key when publishing leaderboard data; App.S.tk can be\n  // stale on devices left open across midnight or restored from cache.\n  const liveTk = (window.App && typeof App.getTk === 'function') ? App.getTk() : (App.S.tk || '');\n  if (liveTk && App.S.tk !== liveTk) App.S.tk = liveTk;\n\n  // Compute lifetime totals\n  const hist   = App.S.history   || {};\n  const histRV = App.S.historyRV || {};\n  const histKV = App.S.historyKV || {};\n  const histSS = App.S.historySS || {};\n  const histHK = App.S.historyHK || {};\n  const hist28 = App.S.h28 || {};\n  const totalRadha = Object.values(hist).reduce((a,b)=>a+b,0);\n  const totalRV    = Object.values(histRV).reduce((a,b)=>a+b,0);\n  const totalKV    = Object.values(histKV).reduce((a,b)=>a+b,0);\n  const totalSS    = Object.values(histSS).reduce((a,b)=>a+b,0);\n  const totalHK    = Object.values(histHK).reduce((a,b)=>a+b,0);\n  const total28    = Object.values(hist28).reduce((a,b)=>a+b,0);\n  const totalJap   = Math.max(0, totalRadha + totalRV + totalKV + totalSS + totalHK + total28 - (App.S.nameJapDeduct||0) - (App.S.nameJapDeductRV||0) - (App.S.nameJapDeductKV||0) - (App.S.nameJapDeductSS||0) - (App.S.nameJapDeductHK||0) - (App.S.nameJapDeduct28||0));\n\n  // Build display name\n  let displayName = (App.S.lbDisplayName || '').trim();\n  if (!displayName && fbUser) {\n    displayName = (fbUser.displayName || (fbUser.email || '').split('@')[0] || 'Anonymous Devotee').slice(0,30);\n  }\n  if (!displayName) displayName = 'Anonymous Devotee';\n\n  // Compute streak from App.S (reuse existing streak logic)\n  let streak = 0;\n  try {\n    const tk = liveTk || App.S.tk;\n    const allHist = {};\n    Object.keys({...hist,...histRV,...histKV,...histSS,...histHK}).forEach(function(k) {\n      allHist[k] = (hist[k]||0)+(histRV[k]||0)+(histKV[k]||0)+(histSS[k]||0)+(histHK[k]||0);\n    });\n    const today = new Date(tk+'T00:00:00');\n    let d = new Date(today);\n    while(true) {\n      const key = App.tkFromDate(d);\n      const dayJap = allHist[key] || 0;\n      const target = App.S.dt || App.S.dtRV || App.S.dtKV || App.S.dtHK || 0;\n      if (dayJap <= 0 || (target > 0 && dayJap < target)) break;\n      streak++;\n      d.setDate(d.getDate()-1);\n      if (streak > 3650) break;\n    }\n  } catch(_) {}\n\n  const todayBreakdown = {\n    r: hist[liveTk] || 0,\n    rv: histRV[liveTk] || 0,\n    kv: histKV[liveTk] || 0,\n    ss: histSS[liveTk] || 0,\n    hk: histHK[liveTk] || 0,\n    n28: hist28[liveTk] || 0,\n  };\n  const todayTimeBreakdown = {\n    r: (App.S.timerHistory || {})[liveTk] || 0,\n    rv: (App.S.timerHistoryRV || {})[liveTk] || 0,\n    kv: (App.S.timerHistoryKV || {})[liveTk] || 0,\n    ss: (App.S.timerHistorySS || {})[liveTk] || 0,\n    hk: (App.S.timerHistoryHK || {})[liveTk] || 0,\n    n28: (App.S.timer28History || {})[liveTk] || 0,\n  };\n  const todayJap = todayBreakdown.r + todayBreakdown.rv + todayBreakdown.kv + todayBreakdown.ss + todayBreakdown.hk + todayBreakdown.n28;\n  const todayTimerSeconds = todayTimeBreakdown.r + todayTimeBreakdown.rv + todayTimeBreakdown.kv + todayTimeBreakdown.ss + todayTimeBreakdown.hk + todayTimeBreakdown.n28;\n\n  const payload = {\n    displayName,\n    totalJap,\n    totalMalas: Math.floor(totalJap / (App.S.ms || 108)),\n    streak,\n    optIn: true,\n    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),\n    todayKey: liveTk,\n    todayJap,\n    todayTimerSeconds,\n    todayBreakdown,\n    todayTimeBreakdown,\n    // Store per-day histories so month/week filtering works\n    history:   hist,\n    historyRV: histRV,\n    historyKV: histKV,\n    historySS: histSS,\n    historyHK: histHK,\n    history28: hist28,\n    // Push each type's own deduct counter too, so the leaderboard breakdown\n    // (R/RV/KV/SS/HK/28N) can be netted the same way totalJap is — otherwise\n    // the breakdown shows raw pre-gift totals while totalJap shows the net\n    // remaining amount, which can make Total look smaller than one of its\n    // own listed parts.\n    nameJapDeduct:   App.S.nameJapDeduct   || 0,\n    nameJapDeductRV: App.S.nameJapDeductRV || 0,\n    nameJapDeductKV: App.S.nameJapDeductKV || 0,\n    nameJapDeductSS: App.S.nameJapDeductSS || 0,\n    nameJapDeductHK: App.S.nameJapDeductHK || 0,\n    nameJapDeduct28: App.S.nameJapDeduct28 || 0,\n    // Push total timer seconds for leaderboard display\n    timerSeconds: Object.values(App.S.timerHistory || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timerHistoryRV || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timerHistoryKV || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timerHistorySS || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timerHistoryHK || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timer28History || {}).reduce((a,b)=>a+b,0),\n    timerHistory:   App.S.timerHistory || {},\n    timerHistoryRV: App.S.timerHistoryRV || {},\n    timerHistoryKV: App.S.timerHistoryKV || {},\n    timerHistorySS: App.S.timerHistorySS || {},\n    timerHistoryHK: App.S.timerHistoryHK || {},\n    timer28History: App.S.timer28History || {},\n  };\n\n  try {\n    await fbDb.collection('leaderboard').doc(fbUser.uid).set(payload);\n  } catch(e) {\n    console.warn('pushLeaderboard error:', e.message);\n  }\n}\n"
APPJS_NEW_1 = "// -- v2 - single atomic batch: main doc + leaderboard doc --\n// Builds the leaderboard write WITHOUT performing it, so fbPushFull()\n// can fold it into the SAME atomic batch + retry ladder as the main\n// history doc (see fbPushFull below). Two decoupled writes -- one\n// reliably retried, one not -- is exactly what let a leaderboard entry\n// silently freeze while the main doc (read live by ghost mode) kept\n// advancing normally.\nfunction _buildLeaderboardWrite() {\n  if (!fbUser || !fbDb) return { action: 'skip' };\n  if (isGhostMode()) return { action: 'skip' }; // ghost mode: read-only\n  if (!App._cloudHydrated) return { action: 'skip' };\n  if (!App.S.lbOptIn) return { action: 'delete' }; // opted out -- remove entry\n\n  const liveTk = (window.App && typeof App.getTk === 'function') ? App.getTk() : (App.S.tk || '');\n  if (liveTk && App.S.tk !== liveTk) App.S.tk = liveTk;\n\n  const hist   = App.S.history   || {};\n  const histRV = App.S.historyRV || {};\n  const histKV = App.S.historyKV || {};\n  const histSS = App.S.historySS || {};\n  const histHK = App.S.historyHK || {};\n  const hist28 = App.S.h28 || {};\n  const totalRadha = Object.values(hist).reduce((a,b)=>a+b,0);\n  const totalRV    = Object.values(histRV).reduce((a,b)=>a+b,0);\n  const totalKV    = Object.values(histKV).reduce((a,b)=>a+b,0);\n  const totalSS    = Object.values(histSS).reduce((a,b)=>a+b,0);\n  const totalHK    = Object.values(histHK).reduce((a,b)=>a+b,0);\n  const total28    = Object.values(hist28).reduce((a,b)=>a+b,0);\n  const totalJap   = Math.max(0, totalRadha + totalRV + totalKV + totalSS + totalHK + total28 - (App.S.nameJapDeduct||0) - (App.S.nameJapDeductRV||0) - (App.S.nameJapDeductKV||0) - (App.S.nameJapDeductSS||0) - (App.S.nameJapDeductHK||0) - (App.S.nameJapDeduct28||0));\n\n  let displayName = (App.S.lbDisplayName || '').trim();\n  if (!displayName && fbUser) {\n    displayName = (fbUser.displayName || (fbUser.email || '').split('@')[0] || 'Anonymous Devotee').slice(0,30);\n  }\n  if (!displayName) displayName = 'Anonymous Devotee';\n\n  let streak = 0;\n  try {\n    const tk = liveTk || App.S.tk;\n    const allHist = {};\n    Object.keys({...hist,...histRV,...histKV,...histSS,...histHK}).forEach(function(k) {\n      allHist[k] = (hist[k]||0)+(histRV[k]||0)+(histKV[k]||0)+(histSS[k]||0)+(histHK[k]||0);\n    });\n    const today = new Date(tk+'T00:00:00');\n    let d = new Date(today);\n    while(true) {\n      const key = App.tkFromDate(d);\n      const dayJap = allHist[key] || 0;\n      const target = App.S.dt || App.S.dtRV || App.S.dtKV || App.S.dtHK || 0;\n      if (dayJap <= 0 || (target > 0 && dayJap < target)) break;\n      streak++;\n      d.setDate(d.getDate()-1);\n      if (streak > 3650) break;\n    }\n  } catch(_) {}\n\n  const todayBreakdown = {\n    r: hist[liveTk] || 0,\n    rv: histRV[liveTk] || 0,\n    kv: histKV[liveTk] || 0,\n    ss: histSS[liveTk] || 0,\n    hk: histHK[liveTk] || 0,\n    n28: hist28[liveTk] || 0,\n  };\n  const todayTimeBreakdown = {\n    r: (App.S.timerHistory || {})[liveTk] || 0,\n    rv: (App.S.timerHistoryRV || {})[liveTk] || 0,\n    kv: (App.S.timerHistoryKV || {})[liveTk] || 0,\n    ss: (App.S.timerHistorySS || {})[liveTk] || 0,\n    hk: (App.S.timerHistoryHK || {})[liveTk] || 0,\n    n28: (App.S.timer28History || {})[liveTk] || 0,\n  };\n  const todayJap = todayBreakdown.r + todayBreakdown.rv + todayBreakdown.kv + todayBreakdown.ss + todayBreakdown.hk + todayBreakdown.n28;\n  const todayTimerSeconds = todayTimeBreakdown.r + todayTimeBreakdown.rv + todayTimeBreakdown.kv + todayTimeBreakdown.ss + todayTimeBreakdown.hk + todayTimeBreakdown.n28;\n\n  const payload = {\n    displayName,\n    totalJap,\n    totalMalas: Math.floor(totalJap / (App.S.ms || 108)),\n    streak,\n    optIn: true,\n    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),\n    todayKey: liveTk,\n    todayJap,\n    todayTimerSeconds,\n    todayBreakdown,\n    todayTimeBreakdown,\n    history:   hist,\n    historyRV: histRV,\n    historyKV: histKV,\n    historySS: histSS,\n    historyHK: histHK,\n    history28: hist28,\n    nameJapDeduct:   App.S.nameJapDeduct   || 0,\n    nameJapDeductRV: App.S.nameJapDeductRV || 0,\n    nameJapDeductKV: App.S.nameJapDeductKV || 0,\n    nameJapDeductSS: App.S.nameJapDeductSS || 0,\n    nameJapDeductHK: App.S.nameJapDeductHK || 0,\n    nameJapDeduct28: App.S.nameJapDeduct28 || 0,\n    timerSeconds: Object.values(App.S.timerHistory || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timerHistoryRV || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timerHistoryKV || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timerHistorySS || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timerHistoryHK || {}).reduce((a,b)=>a+b,0) +\n                  Object.values(App.S.timer28History || {}).reduce((a,b)=>a+b,0),\n    timerHistory:   App.S.timerHistory || {},\n    timerHistoryRV: App.S.timerHistoryRV || {},\n    timerHistoryKV: App.S.timerHistoryKV || {},\n    timerHistorySS: App.S.timerHistorySS || {},\n    timerHistoryHK: App.S.timerHistoryHK || {},\n    timer28History: App.S.timer28History || {},\n  };\n\n  return { action: 'set', payload };\n}\n\n// Standalone leaderboard push -- used by call sites with no simultaneous\n// main-doc write (opt-in toggle, display-name change, etc). Now goes\n// through the same retry ladder as the main doc instead of one bare\n// attempt, so a transient failure here gets retried too.\nasync function pushLeaderboard() {\n  const w = _buildLeaderboardWrite();\n  if (w.action === 'skip') return;\n  try {\n    if (w.action === 'delete') {\n      await fbCloudPushWithRetryLadder(\n        () => fbDb.collection('leaderboard').doc(fbUser.uid).delete(),\n        'Leaderboard delete'\n      );\n    } else {\n      await fbCloudPushWithRetryLadder(\n        () => fbDb.collection('leaderboard').doc(fbUser.uid).set(w.payload),\n        'Leaderboard push'\n      );\n    }\n  } catch(e) {\n    console.warn('pushLeaderboard error (after retries):', e.message);\n  }\n}\n"

APPJS_OLD_2 = '    await fbCloudPushWithRetryLadder(\n      () =>\n        fbDb\n          .collection("users")\n          .doc(fbUser.uid)\n          .collection("data")\n          .doc("main")\n          .set(payload),\n      "Cloud push",\n      (attemptNum, totalAttempts) => {\n        if (totalAttempts > 1) {\n          setSyncPill("syncing", "☁️ Syncing… (attempt " + attemptNum + " of " + totalAttempts + ")");\n        }\n      },\n    );\n'
APPJS_NEW_2 = '    // v2 - single atomic batch: main doc + leaderboard doc -- main doc + leaderboard doc now write together\n    // in one atomic batch under this same retry ladder, instead of the\n    // leaderboard being a second, independent write (see\n    // _buildLeaderboardWrite / pushLeaderboard above).\n    const _lbWrite = _buildLeaderboardWrite();\n    await fbCloudPushWithRetryLadder(\n      () => {\n        const batch = fbDb.batch();\n        batch.set(\n          fbDb.collection("users").doc(fbUser.uid).collection("data").doc("main"),\n          payload,\n        );\n        if (_lbWrite.action === "set") {\n          batch.set(fbDb.collection("leaderboard").doc(fbUser.uid), _lbWrite.payload);\n        } else if (_lbWrite.action === "delete") {\n          batch.delete(fbDb.collection("leaderboard").doc(fbUser.uid));\n        }\n        return batch.commit();\n      },\n      "Cloud push",\n      (attemptNum, totalAttempts) => {\n        if (totalAttempts > 1) {\n          setSyncPill("syncing", "☁️ Syncing… (attempt " + attemptNum + " of " + totalAttempts + ")");\n        }\n      },\n    );'

APPJS_OLD_3 = '    // ── Push leaderboard entry if opted in ──\n    // Only announce this device as "present" on the community board AFTER\n    // the authoritative history doc above was actually confirmed — a\n    // separate, smaller leaderboard write must never succeed on its own\n    // and imply the full sync did too. That mismatch (leaderboard fine,\n    // real history doc silently behind) is exactly what made missing days\n    // invisible until a device switch.\n    pushLeaderboard().catch((e) => console.warn(\'pushLeaderboard (post-tap) error:\', e && e.message));\n'
APPJS_NEW_3 = '    // Leaderboard entry was already written above, atomically with the\n    // main doc -- see _buildLeaderboardWrite / the batch above.\n    // (v2 - single atomic batch: main doc + leaderboard doc)'

APPJS_OLD_4 = 'function setSyncPill(state, text) {\n  const p = document.getElementById("syncPill");\n  const tx = document.getElementById("syncPillText");\n  if (!p || !tx) return;\n  p.className =\n    "sync-pill" +\n    (state === "syncing" ? " syncing" : state === "error" ? " error" : "");\n  tx.textContent = text;\n}'
APPJS_NEW_4 = 'function setSyncPill(state, text) {\n  const p = document.getElementById("syncPill");\n  const tx = document.getElementById("syncPillText");\n  if (!p || !tx) return;\n  p.className =\n    "sync-pill" +\n    (state === "syncing" ? " syncing" : state === "error" ? " error" : "");\n  tx.textContent = text;\n}\n\n// -- sync-pill retry affordance --\n// Manual retry when the sync pill is tapped while in the error state.\nlet _retrySyncInFlight = false;\nasync function retrySync() {\n  const p = document.getElementById("syncPill");\n  if (!p || !p.classList.contains("error")) return; // only meaningful on failure\n  if (_retrySyncInFlight) return; // ignore stacked taps\n  if (!fbUser) return;\n  if (typeof isGhostMode === "function" && isGhostMode()) return; // never retry-sync someone else\'s data\n  _retrySyncInFlight = true;\n  try {\n    await fbAutoSync();\n  } catch (e) {\n    console.warn("Manual retry failed:", e && e.message);\n  } finally {\n    _retrySyncInFlight = false;\n  }\n}'

HTML_OLD = '<span class="sync-pill" id="syncPill"><span class="sync-dot"></span><span id="syncPillText">Ready</span></span>'
HTML_NEW = '<span class="sync-pill" id="syncPill" onclick="retrySync()"><span class="sync-dot"></span><span id="syncPillText">Ready</span></span>'

CSS_MARKER = "/* sync-pill retry affordance */"
CSS_APPEND = CSS_MARKER + """
.sync-pill.error { cursor: pointer; }
.sync-pill.error #syncPillText::after {
  content: " \00b7 tap to retry";
  opacity: 0.75;
  font-size: 0.9em;
}
"""


def backup_once(path):
    b = path + ".bak-syncretryfix"
    if not os.path.isfile(b):
        shutil.copy2(path, b)


def patch_replace(path, old, new):
    if not os.path.isfile(path):
        return "missing"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if new in content:
        return "already-applied"
    if old not in content:
        return "pattern-not-found"
    backup_once(path)
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return "patched"


def patch_append_css(path):
    if not os.path.isfile(path):
        return "missing"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if CSS_MARKER in content:
        return "already-applied"
    backup_once(path)
    with open(path, "a", encoding="utf-8") as f:
        if not content.endswith("\n"):
            f.write("\n")
        f.write("\n" + CSS_APPEND)
    return "patched"


def main():
    targets = [
        ("app.js", os.path.join("www", "app.js")),
    ]
    patches = [
        (APPJS_OLD_1, APPJS_NEW_1, "pushLeaderboard -> _buildLeaderboardWrite"),
        (APPJS_OLD_2, APPJS_NEW_2, "fbPushFull -> atomic batch"),
        (APPJS_OLD_3, APPJS_NEW_3, "remove redundant standalone leaderboard call"),
        (APPJS_OLD_4, APPJS_NEW_4, "add retrySync()"),
    ]

    print("-- sync retry + atomic leaderboard batch fix (v2) --")

    any_missing = False
    any_not_found = False

    for root_path, www_path in targets:
        for path in (root_path, www_path):
            statuses = []
            for old, new, label in patches:
                status = patch_replace(path, old, new)
                statuses.append((label, status))
                if status == "missing":
                    any_missing = True
                if status == "pattern-not-found":
                    any_not_found = True
            print(f"  {path}:")
            for label, status in statuses:
                print(f"    [{status}] {label}")

    for path in ("index.html", os.path.join("www", "index.html")):
        status = patch_replace(path, HTML_OLD, HTML_NEW)
        print(f"  {path}: {status}")
        if status == "missing":
            any_missing = True
        if status == "pattern-not-found":
            any_not_found = True

    for path in ("style.css", os.path.join("www", "style.css")):
        status = patch_append_css(path)
        print(f"  {path}: {status}")
        if status == "missing":
            any_missing = True

    if any_missing:
        print("\nRun this from the project root (where app.js/index.html/style.css live).")
    if any_not_found:
        print(
            "\nWarning: one or more expected code patterns weren\'t found -- "
            "the file may have changed since this script was written. "
            "No changes were made to that specific patch; nothing was corrupted."
        )
    if any_missing or any_not_found:
        sys.exit(1)

    print(
        "\nDone. Backups saved as *.bak-syncretryfix next to each patched file.\n"
        "\nNext steps:\n"
        "  npx cap sync android\n"
        "  cd android && ./gradlew assembleRelease && cd ..\n"
    )


if __name__ == "__main__":
    main()
