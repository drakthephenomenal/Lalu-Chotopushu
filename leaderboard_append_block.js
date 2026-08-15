
// ============================================================
// Leaderboard sync — appended, does not touch anything above.
// Triggers on every write to users/{uid}/data/main and computes
// the leaderboard entry server-side. See project notes for why:
// removes the leaderboard-goes-stale bug where the client's
// separate pushLeaderboard() write could silently fail while
// main data kept syncing fine.
// Uses the SAME `admin`/`functions` already required and
// initialized above — does NOT call admin.initializeApp() again.
// ============================================================

function _lbSumHistory(hist) {
  return Object.values(hist || {}).reduce((a, b) => a + (b || 0), 0);
}

function _lbShiftDateKey(dateKey, delta) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

exports.syncLeaderboardOnMainDataWrite = functions.firestore
  .document("users/{uid}/data/main")
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const after = change.after;

    if (!after.exists) {
      await admin.firestore().collection("leaderboard").doc(uid).delete().catch(() => {});
      return null;
    }

    const data = after.data() || {};

    if (!data.lbOptIn) {
      await admin.firestore().collection("leaderboard").doc(uid).delete().catch(() => {});
      return null;
    }

    const hist = data.history || {};
    const histRV = data.historyRV || {};
    const histKV = data.historyKV || {};
    const histSS = data.historySS || {};
    const histHK = data.historyHK || {};
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
    );

    let displayName = (data.lbDisplayName || "").trim();
    if (!displayName) {
      try {
        const userRecord = await admin.auth().getUser(uid);
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

    const liveTk = data.malaLogDate || "";

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
        key = _lbShiftDateKey(key, -1);
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
        _lbSumHistory(timerHist) + _lbSumHistory(timerHistRV) +
        _lbSumHistory(timerHistKV) + _lbSumHistory(timerHistSS) +
        _lbSumHistory(timerHistHK) + _lbSumHistory(timer28Hist),
      timerHistory: timerHist,
      timerHistoryRV: timerHistRV,
      timerHistoryKV: timerHistKV,
      timerHistorySS: timerHistSS,
      timerHistoryHK: timerHistHK,
      timer28History: timer28Hist,
    };

    await admin.firestore().collection("leaderboard").doc(uid).set(payload);
    return null;
  });
