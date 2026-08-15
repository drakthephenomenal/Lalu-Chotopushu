/**
 * Leaderboard Cloud Function
 * ==========================
 * Replaces the client-side pushLeaderboard() write. Triggers automatically
 * whenever users/{uid}/data/main is written (i.e. every successful
 * fbPushFull), and the SERVER computes + writes leaderboard/{uid} itself.
 *
 * WHY: the client-side version required a second, separate write after
 * every main-data sync. If that second write failed (flaky connection,
 * app closed before it fired, anything) the leaderboard entry went stale
 * while the real jap data kept updating fine — exactly the mismatch seen
 * in production (a user's leaderboard entry showing fewer malas than
 * their actual synced total). Once this function is deployed, the client
 * only ever needs to do ONE write (main data) — leaderboard staleness of
 * that kind becomes structurally impossible, since this function can only
 * run in response to a CONFIRMED successful main-data write.
 *
 * This is a faithful, field-for-field port of the client's pushLeaderboard()
 * logic (as of the "Current" app.js reviewed on 2026-08-15), so leaderboard
 * values should come out identical to what the client used to compute.
 *
 * IMPORTANT — today's-date handling: the client computes "today" using the
 * DEVICE's local timezone (App.S.tk). A Cloud Function has no concept of a
 * user's timezone, so this deliberately does NOT compute "today" itself —
 * it uses the `malaLogDate` field already present in the main data payload
 * (the client's own local date key, pushed with every sync) as the anchor
 * for today/streak calculations. This avoids any timezone mismatch.
 *
 * ROLLOUT NOTE: this does NOT yet remove the client's own pushLeaderboard()
 * write or lock down firestore.rules to make leaderboard/{uid} read-only.
 * Deploy this function first and confirm it's producing correct entries
 * (it will simply overwrite whatever the client wrote, so it's safe to run
 * alongside the old client behavior). Only after that's confirmed working
 * should you (a) strip pushLeaderboard()'s write call from app.js in a
 * future release, and (b) tighten firestore.rules to deny client writes to
 * leaderboard/{uid} entirely (server-only via Admin SDK, which bypasses
 * rules). Doing both at once, before confirming the function works, risks
 * breaking leaderboard for anyone still on an older app version.
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

initializeApp();
const db = getFirestore();

/** Sum all values in a { 'YYYY-MM-DD': count } history object. */
function sumHistory(hist) {
  return Object.values(hist || {}).reduce((a, b) => a + (b || 0), 0);
}

/** Shift a 'YYYY-MM-DD' date key by `delta` days, using UTC to avoid DST issues. */
function shiftDateKey(dateKey, delta) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

exports.syncLeaderboardOnMainDataWrite = onDocumentWritten(
  "users/{uid}/data/main",
  async (event) => {
    const uid = event.params.uid;
    const after = event.data && event.data.after;

    // Main data doc deleted (e.g. account deletion) — remove leaderboard entry too.
    if (!after || !after.exists) {
      await db.collection("leaderboard").doc(uid).delete().catch(() => {});
      return;
    }

    const data = after.data() || {};

    // Mirrors the client: opted out (or never opted in) → no leaderboard entry.
    if (!data.lbOptIn) {
      await db.collection("leaderboard").doc(uid).delete().catch(() => {});
      return;
    }

    const hist = data.history || {};
    const histRV = data.historyRV || {};
    const histKV = data.historyKV || {};
    const histSS = data.historySS || {};
    const histHK = data.historyHK || {};
    const hist28 = data.h28 || {};

    const totalRadha = sumHistory(hist);
    const totalRV = sumHistory(histRV);
    const totalKV = sumHistory(histKV);
    const totalSS = sumHistory(histSS);
    const totalHK = sumHistory(histHK);
    const total28 = sumHistory(hist28);

    const totalJap = Math.max(
      0,
      totalRadha + totalRV + totalKV + totalSS + totalHK + total28 -
        (data.nameJapDeduct || 0) -
        (data.nameJapDeductRV || 0) -
        (data.nameJapDeductKV || 0) -
        (data.nameJapDeductSS || 0) -
        (data.nameJapDeductHK || 0) -
        (data.nameJapDeduct28 || 0)
    );

    // Display name — same fallback order as the client, using Admin Auth
    // for the account's email/displayName if lbDisplayName wasn't set.
    let displayName = (data.lbDisplayName || "").trim();
    if (!displayName) {
      try {
        const userRecord = await getAuth().getUser(uid);
        displayName = (
          userRecord.displayName ||
          (userRecord.email || "").split("@")[0] ||
          "Anonymous Devotee"
        ).slice(0, 30);
      } catch (_e) {
        displayName = "Anonymous Devotee";
      }
    }
    if (!displayName) displayName = "Anonymous Devotee";

    // liveTk — the client's own local "today" date key, pushed with every
    // sync as malaLogDate. This is the anchor for today/streak calculations,
    // deliberately NOT computed server-side (see file header for why).
    const liveTk = data.malaLogDate || "";

    // Streak — faithful port of the client's algorithm, including its
    // exact (dt || dtRV || dtKV || dtHK || 0) target formula.
    let streak = 0;
    if (liveTk) {
      const allHist = {};
      const allKeys = new Set([
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
      });
      const target = data.dt || data.dtRV || data.dtKV || data.dtHK || 0;
      let key = liveTk;
      let guard = 0;
      while (guard < 3650) {
        const dayJap = allHist[key] || 0;
        if (dayJap <= 0 || (target > 0 && dayJap < target)) break;
        streak++;
        key = shiftDateKey(key, -1);
        guard++;
      }
    }

    const todayBreakdown = {
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
      todayTimeBreakdown.ss + todayTimeBreakdown.hk + todayTimeBreakdown.n28;

    const payload = {
      displayName,
      totalJap,
      totalMalas: Math.floor(totalJap / (data.ms || 108)),
      streak,
      optIn: true,
      updatedAt: FieldValue.serverTimestamp(),
      todayKey: liveTk,
      todayJap,
      todayTimerSeconds,
      todayBreakdown,
      todayTimeBreakdown,
      history: hist,
      historyRV: histRV,
      historyKV: histKV,
      historySS: histSS,
      historyHK: histHK,
      history28: hist28,
      nameJapDeduct: data.nameJapDeduct || 0,
      nameJapDeductRV: data.nameJapDeductRV || 0,
      nameJapDeductKV: data.nameJapDeductKV || 0,
      nameJapDeductSS: data.nameJapDeductSS || 0,
      nameJapDeductHK: data.nameJapDeductHK || 0,
      nameJapDeduct28: data.nameJapDeduct28 || 0,
      timerSeconds:
        sumHistory(timerHist) + sumHistory(timerHistRV) +
        sumHistory(timerHistKV) + sumHistory(timerHistSS) +
        sumHistory(timerHistHK) + sumHistory(timer28Hist),
      timerHistory: timerHist,
      timerHistoryRV: timerHistRV,
      timerHistoryKV: timerHistKV,
      timerHistorySS: timerHistSS,
      timerHistoryHK: timerHistHK,
      timer28History: timer28Hist,
    };

    await db.collection("leaderboard").doc(uid).set(payload);
  }
);
