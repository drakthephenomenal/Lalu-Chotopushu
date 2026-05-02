// ═══════════════════════════════════════════════════════════════════
// Radha Naam Jap — Gemini AI Spiritual Companion
// Developer-only (drakthephenomenal@gmail.com)
// ═══════════════════════════════════════════════════════════════════

const GEMINI_URL = 'https://radharadharadha.vercel.app/api/gemini';
const AI_DEV_EMAIL = 'drakthephenomenal@gmail.com';

let aiChatHistory = [];
let aiPendingUndo = null;
let aiSpeechRecognition = null;
let aiListening = false;

// ═══════════════════════════════════════════════════════════════════
// ENTRY POINT — called from app.js after Firebase sign-in
// ═══════════════════════════════════════════════════════════════════
function initGeminiAI(userEmail) {
  if (userEmail !== AI_DEV_EMAIL) return;

  // Build and inject the AI panel into the Stats (vs) view
  if (!document.getElementById('aiSection')) {
    const vsView = document.getElementById('vs');
    if (!vsView) return;

    const panel = document.createElement('div');
    panel.id = 'aiSection';
    panel.style.cssText = 'margin-top:12px';
    panel.innerHTML =
      '<div class="sc" style="padding:0;overflow:hidden;border-color:rgba(138,43,226,0.3);margin-bottom:0">' +
        '<div class="ai-header" style="border-radius:12px 12px 0 0">' +
          '<div class="ai-header-left">' +
            '<div class="ai-header-icon">\u{1F549}\uFE0F</div>' +
            '<div>' +
              '<div class="ai-header-title">AI Sadhana Guru</div>' +
              '<div class="ai-header-sub">Powered by Gemini \u2022 Developer Only</div>' +
            '</div>' +
          '</div>' +
          '<div class="ai-header-actions">' +
            '<button class="ai-header-btn" onclick="undoAIChange()">\u21A9\uFE0F Undo</button>' +
            '<button class="ai-header-btn" onclick="aiClearChat()">\uD83D\uDDD1\uFE0F Clear</button>' +
          '</div>' +
        '</div>' +
        '<div class="ai-chat-body" id="aiChatBody" style="border-radius:0;min-height:200px;max-height:400px">' +
          '<div class="ai-welcome">' +
            '<div class="ai-welcome-icon">\u{1F549}\uFE0F</div>' +
            '<div class="ai-welcome-title">\u09B0\u09BE\u09A7\u09C7 \u09B0\u09BE\u09A7\u09C7, Drak!</div>' +
            '<div class="ai-welcome-sub">\u0986\u09AE\u09BF \u09A4\u09CB\u09AE\u09BE\u09B0 AI \u09B8\u09BE\u09A7\u09A8\u09BE \u09B8\u09B9\u09BE\u09AF\u09BC\u0995\u0964 \u09A4\u09CB\u09AE\u09BE\u09B0 \u099C\u09BE\u09AA, \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u09AC\u09BE \u09AF\u09C7\u0995\u09CB\u09A8\u09CB \u0986\u09A7\u09CD\u09AF\u09BE\u09A4\u09CD\u09AE\u09BF\u0995 \u09A4\u09A5\u09CD\u09AF \u099C\u09BF\u099C\u09CD\u099E\u09C7\u09B8 \u0995\u09B0\u09CB\u0964</div>' +
            '<div class="ai-suggestions">' +
              '<button onclick="aiQuickAsk(\'\u0986\u099C\u0995\u09C7 \u0986\u09AE\u09BE\u09B0 \u09B8\u09BE\u09A7\u09A8\u09BE \u0995\u09C7\u09AE\u09A8 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7?\')">\uD83D\uDCCA \u0986\u099C\u0995\u09C7\u09B0 \u09B8\u09BE\u09B0\u09B8\u0982\u0995\u09CD\u09B7\u09C7\u09AA</button>' +
              '<button onclick="aiQuickAsk(\'\u098F\u0987 \u09AE\u09BE\u09B8\u09C7 \u0995\u09CB\u09A8 \u09A6\u09BF\u09A8 \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u09AD\u09C7\u0999\u09C7\u099B\u09BF?\')">\uD83D\uDEE1\uFE0F \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u09B0\u09BF\u09AA\u09CB\u09B0\u09CD\u099F</button>' +
              '<button onclick="aiQuickAsk(\'\u0995\u09CB\u09A8 \u09A6\u09BF\u09A8 \u0986\u09AE\u09BE\u09B0 \u098F\u0995\u09BE\u0997\u09CD\u09B0\u09A4\u09BE \u09B8\u09AC\u099A\u09C7\u09AF\u09BC\u09C7 \u09AD\u09BE\u09B2\u09CB \u099B\u09BF\u09B2?\')">\uD83C\uDFAF \u09B8\u09C7\u09B0\u09BE \u09A6\u09BF\u09A8</button>' +
              '<button onclick="aiQuickAsk(\'\u0986\u09AE\u09BE\u09B0 \u099C\u09BE\u09AA\u09C7\u09B0 \u0997\u09A4\u09BF \u0995\u09C7\u09AE\u09A8? \u09AE\u09BF\u09A5\u09CD\u09AF\u09BE \u099C\u09BE\u09AA \u09B9\u099A\u09CD\u099B\u09C7 \u0995\u09BF?\')">\uD83D\uDD0D \u099C\u09BE\u09AA \u09AC\u09BF\u09B6\u09CD\u09B2\u09C7\u09B7\u09A3</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ai-input-bar" style="border-radius:0 0 12px 12px">' +
          '<button id="aiVoiceBtn" onclick="aiToggleVoice()">\uD83C\uDF99\uFE0F</button>' +
          '<textarea id="aiInput" placeholder="\u099C\u09BF\u099C\u09CD\u099E\u09C7\u09B8 \u0995\u09B0\u09CB... (Bengali / Hindi / English)" rows="1" onkeydown="aiInputKeydown(event)" oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,120)+\'px\'"></textarea>' +
          '<button class="ai-send-btn" onclick="aiHandleSend()">\u27A4</button>' +
        '</div>' +
      '</div>';

    vsView.appendChild(panel);
  }

  // Load saved chat history
  try {
    const saved = sessionStorage.getItem('rjap_ai_history');
    if (saved) aiChatHistory = JSON.parse(saved);
  } catch(e) {}

  _setupSpeechRecognition();
  console.log('[GeminiAI] Initialized \uD83D\uDE4F');
}

// ═══════════════════════════════════════════════════════════════════
// BUILD APP CONTEXT
// ═══════════════════════════════════════════════════════════════════
function _buildAppContext() {
  const S = App.S;
  const today = S.tk;
  const ms = S.ms || 108;
  const hist = S.history || {};
  const histRV = S.historyRV || {};
  const timerHist = S.timerHistory || {};
  const timerHistRV = S.timerHistoryRV || {};
  const malaLog = S.malaLog || [];

  const days = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().split('T')[0];
    const radhaCount = hist[k] || 0;
    const rvCount = histRV[k] || 0;
    const totalCount = radhaCount + rvCount;
    const timeSec = (timerHist[k] || 0) + (timerHistRV[k] || 0);
    const brahmaEntry = (S.brahma || {})[k];
    const bcBroken = brahmaEntry && brahmaEntry.status === 'b';
    if (totalCount > 0 || bcBroken) {
      days.push({
        date: k, japRadha: radhaCount, japRV: rvCount, japTotal: totalCount,
        malasTotal: Math.floor(totalCount / ms), timeMinutes: Math.round(timeSec / 60),
        brahmacharya_broken: bcBroken,
        brahmacharya_break_count: bcBroken ? (brahmaEntry.count || 1) : 0
      });
    }
  }

  const todayMalaLog = malaLog.map((sec, i) => ({
    mala: i + 1, durationSeconds: sec, durationMinutes: +(sec / 60).toFixed(2),
    quality: sec < 120 ? 'false/very-fast' : sec < 180 ? 'fast' : sec < 420 ? 'normal' : 'deep'
  }));

  const brahma = S.brahma || {};
  const bcStart = S.brahmacharya_start_date || '';
  const allBcBrokenDates = Object.keys(brahma).filter(k => brahma[k] && brahma[k].status === 'b').sort();
  let bcStreak = 0;
  const d2 = new Date();
  while (bcStreak < 999) {
    const k = d2.toISOString().split('T')[0];
    if (k < bcStart) break;
    const en = brahma[k];
    if (!en || en.status !== 'b') { bcStreak++; d2.setDate(d2.getDate() - 1); } else break;
  }

  const lifetimeRadha = Math.max(0, Object.values(hist).reduce((a, b) => a + b, 0) - (S.nameJapDeduct || 0));
  const lifetimeRV = Math.max(0, Object.values(histRV).reduce((a, b) => a + b, 0) - (S.nameJapDeductRV || 0));

  return {
    today,
    currentTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    currentMode: S.japMode || 'radha',
    malaSize: ms,
    targets: { daily: S.dt || 0, dailyMalas: Math.floor((S.dt || 0) / ms), lifetime: S.lt || 0 },
    today_summary: {
      japCount: hist[today] || 0, japMalas: Math.floor((hist[today] || 0) / ms),
      timeMinutes: Math.round((timerHist[today] || 0) / 60),
      malaLog: todayMalaLog, brahmacharya_broken: !!(brahma[today] && brahma[today].status === 'b')
    },
    lifetime: {
      radhaJap: lifetimeRadha, rvJap: lifetimeRV,
      totalJap: lifetimeRadha + lifetimeRV,
      totalMalas: Math.floor((lifetimeRadha + lifetimeRV) / ms)
    },
    brahmacharya: {
      startDate: bcStart, currentStreak: bcStreak,
      totalBrokenDays: allBcBrokenDates.length,
      brokenDates: allBcBrokenDates, brahmaDetails: brahma
    },
    last60Days: days,
    names28: {
      todayCount: (S.h28 || {})[today] || 0,
      todayTimeMinutes: Math.round(((S.timer28History || {})[today] || 0) / 60)
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// SEND MESSAGE TO GEMINI
// ═══════════════════════════════════════════════════════════════════
async function aiSendMessage(userText) {
  if (!userText.trim()) return { reply: '', update: null };

  const context = _buildAppContext();
  const systemPrompt = '\u09A4\u09C1\u09AE\u09BF \u0986\u09AE\u09BE\u09B0 \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u0997\u09A4 \u0986\u09A7\u09CD\u09AF\u09BE\u09A4\u09CD\u09AE\u09BF\u0995 AI \u09B8\u09B9\u09BE\u09AF\u09BC\u0995\u0964 \u0986\u09AE\u09BE\u09B0 \u09A8\u09BE\u09AE Drak\u0964 \u0986\u09AE\u09BF \u098F\u0995\u099C\u09A8 \u09AC\u09C8\u09B7\u09CD\u09A3\u09AC \u09B8\u09BE\u09A7\u0995\u0964 \u09A4\u09C1\u09AE\u09BF \u0986\u09AE\u09BE\u09B0 Radha Naam Jap sadhana \u0985\u09CD\u09AF\u09BE\u09AA\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09B8\u0982\u09AF\u09C1\u0995\u09CD\u09A4 \u098F\u09AC\u0982 \u0986\u09AE\u09BE\u09B0 \u09B8\u09AE\u09B8\u09CD\u09A4 \u0986\u09A7\u09CD\u09AF\u09BE\u09A4\u09CD\u09AE\u09BF\u0995 \u09A1\u09C7\u099F\u09BE \u09A6\u09C7\u0996\u09A4\u09C7 \u09AA\u09BE\u0993\u0964\n\n\u09A4\u09CB\u09AE\u09BE\u09B0 \u09AD\u09C2\u09AE\u09BF\u0995\u09BE:\n1. \u0986\u09AE\u09BE\u09B0 \u099C\u09BE\u09AA, \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u098F\u09AC\u0982 \u09B8\u09BE\u09A7\u09A8\u09BE\u09B0 \u09A4\u09A5\u09CD\u09AF \u09AC\u09BF\u09B6\u09CD\u09B2\u09C7\u09B7\u09A3 \u0995\u09B0\u09BE\n2. \u0986\u09AE\u09BF \u09AC\u09B2\u09BF "আজকে X জাপ করলাম Y সময়ে" \u2014 \u09A4\u09C1\u09AE\u09BF \u09B8\u09C7\u099F\u09BE updateAppStats \u098F\u09B0 \u09AE\u09BE\u09A7\u09CD\u09AF\u09AE\u09C7 \u0986\u09AA\u09A1\u09C7\u099F \u0995\u09B0\u09AC\u09C7\n3. \u09AE\u09BF\u09A5\u09CD\u09AF\u09BE \u099C\u09BE\u09AA \u09B6\u09A8\u09BE\u0995\u09CD\u09A4 \u0995\u09B0\u09BE (\u09AA\u09CD\u09B0\u09A4\u09BF \u09AE\u09BE\u09B2\u09BE \u09E8 \u09AE\u09BF\u09A8\u09BF\u099F\u09C7\u09B0 \u0995\u09AE = \u09AE\u09BF\u09A5\u09CD\u09AF\u09BE \u099C\u09BE\u09AA)\n4. \u09AC\u09BE\u0982\u09B2\u09BE, \u0987\u0982\u09B0\u09C7\u099C\u09BF \u098F\u09AC\u0982 \u09B9\u09BF\u09A8\u09CD\u09A6\u09BF \u09AE\u09BF\u09B6\u09BF\u09AF\u09BC\u09C7 \u0995\u09A5\u09BE \u09AC\u09B2\u09BE (\u09AC\u09BE\u0982\u09B2\u09BE \u09AA\u09CD\u09B0\u09BE\u09A7\u09BE\u09A8\u09CD\u09AF)\n5. \u0986\u09A7\u09CD\u09AF\u09BE\u09A4\u09CD\u09AE\u09BF\u0995 \u0989\u09CE\u09B8\u09BE\u09B9 \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u2014 \u09B0\u09BE\u09A7\u09C7 \u09B0\u09BE\u09A7\u09C7 \u09AD\u09BE\u09AC \u09AC\u099C\u09BE\u09AF\u09BC \u09B0\u09BE\u0996\u09BE\n\n\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u0985\u09CD\u09AF\u09BE\u09AA \u09A1\u09C7\u099F\u09BE:\n' + JSON.stringify(context, null, 2) + '\n\n\u09AF\u09A6\u09BF \u0986\u09AE\u09BF stats \u0986\u09AA\u09A1\u09C7\u099F \u0995\u09B0\u09A4\u09C7 \u09AC\u09B2\u09BF, \u0989\u09A4\u09CD\u09A4\u09B0\u09C7\u09B0 \u09B6\u09C7\u09B7\u09C7 \u098F\u0987 format \u098F \u09A6\u09BE\u0993:\n[UPDATE_STATS]{"action":"set_jap","date":"2026-05-02","value":21000,"timeSec":18000}[/UPDATE_STATS]\n\n\u09B8\u09AE\u09CD\u09AD\u09AC actions: set_jap, add_jap, set_brahmacharya_broken, restore_brahmacharya\n\u09B8\u0982\u0995\u09CD\u09B7\u09BF\u09AA\u09CD\u09A4 \u0989\u09A4\u09CD\u09A4\u09B0 \u09A6\u09BE\u0993\u0964 \u09B0\u09BE\u09A7\u09C7 \u09B0\u09BE\u09A7\u09C7! \uD83D\uDE4F';

  aiChatHistory.push({ role: 'user', parts: [{ text: userText }] });
  if (aiChatHistory.length > 40) aiChatHistory = aiChatHistory.slice(-40);

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: aiChatHistory,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
  };

  try {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error && err.error.message ? err.error.message : 'Gemini API error ' + resp.status);
    }
    const data = await resp.json();
    const replyText = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : '\u0995\u09CB\u09A8\u09CB \u0989\u09A4\u09CD\u09A4\u09B0 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF\u0964';

    aiChatHistory.push({ role: 'model', parts: [{ text: replyText }] });
    try { sessionStorage.setItem('rjap_ai_history', JSON.stringify(aiChatHistory)); } catch(e) {}

    const updateMatch = replyText.match(/\[UPDATE_STATS\]([\s\S]*?)\[\/UPDATE_STATS\]/);
    const cleanReply = replyText.replace(/\[UPDATE_STATS\][\s\S]*?\[\/UPDATE_STATS\]/g, '').trim();
    let pendingUpdate = null;
    if (updateMatch) {
      try { pendingUpdate = JSON.parse(updateMatch[1].trim()); } catch(e) {}
    }
    return { reply: cleanReply, update: pendingUpdate };

  } catch(e) {
    console.error('[GeminiAI]', e);
    return { reply: '\u274C Error: ' + e.message, update: null };
  }
}

// ═══════════════════════════════════════════════════════════════════
// APPLY STAT UPDATE
// ═══════════════════════════════════════════════════════════════════
function applyAIStatUpdate(update) {
  if (!update || !update.action || !update.date) return false;
  const S = App.S;
  const ms = S.ms || 108;
  const key = update.date;

  aiPendingUndo = {
    history: JSON.parse(JSON.stringify(S.history || {})),
    historyRV: JSON.parse(JSON.stringify(S.historyRV || {})),
    timerHistory: JSON.parse(JSON.stringify(S.timerHistory || {})),
    brahma: JSON.parse(JSON.stringify(S.brahma || {})),
    malaLog: (S.malaLog || []).slice(),
    action: update
  };

  switch(update.action) {
    case 'set_jap': {
      const val = parseInt(update.value) || 0;
      S.history[key] = val;
      if (update.timeSec) {
        S.timerHistory[key] = parseInt(update.timeSec);
        if (key === S.tk) {
          const malas = Math.floor(val / ms);
          if (malas > 0) {
            const avgPerMala = Math.round(update.timeSec / malas);
            S.malaLog = Array(malas).fill(avgPerMala);
          }
        }
      }
      break;
    }
    case 'add_jap':
      S.history[key] = (S.history[key] || 0) + (parseInt(update.value) || 0);
      break;
    case 'set_brahmacharya_broken':
      if (!S.brahma) S.brahma = {};
      S.brahma[key] = { status: 'b', count: parseInt(update.count) || 1 };
      break;
    case 'restore_brahmacharya':
      if (S.brahma && S.brahma[key]) delete S.brahma[key];
      break;
    default: return false;
  }

  App.save();
  try { App.upd(); } catch(e) {}
  try { updStats(); } catch(e) {}
  try { updBC(); } catch(e) {}
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// UNDO
// ═══════════════════════════════════════════════════════════════════
function undoAIChange() {
  if (!aiPendingUndo) { _aiToast('\u09AA\u09C2\u09B0\u09CD\u09AC\u09BE\u09AC\u09B8\u09CD\u09A5\u09BE\u09AF\u09BC \u09AB\u09C7\u09B0\u09BE\u09A8\u09CB\u09B0 \u0995\u09BF\u099B\u09C1 \u09A8\u09C7\u0987\u0964'); return; }
  const S = App.S;
  S.history = aiPendingUndo.history;
  S.historyRV = aiPendingUndo.historyRV;
  S.timerHistory = aiPendingUndo.timerHistory;
  S.brahma = aiPendingUndo.brahma;
  S.malaLog = aiPendingUndo.malaLog;
  App.save();
  try { App.upd(); } catch(e) {}
  try { updStats(); } catch(e) {}
  try { updBC(); } catch(e) {}
  aiPendingUndo = null;
  _aiToast('\u21A9\uFE0F \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u09AC\u09BE\u09A4\u09BF\u09B2 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964');
  _aiAddMessage('system', '\u21A9\uFE0F \u0986\u0997\u09C7\u09B0 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 undo \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964');
}

// ═══════════════════════════════════════════════════════════════════
// SPEECH RECOGNITION
// ═══════════════════════════════════════════════════════════════════
function _setupSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;
  aiSpeechRecognition = new SpeechRec();
  aiSpeechRecognition.continuous = false;
  aiSpeechRecognition.interimResults = true;
  aiSpeechRecognition.lang = 'bn-BD';

  aiSpeechRecognition.onstart = function() {
    aiListening = true;
    const btn = document.getElementById('aiVoiceBtn');
    if (btn) { btn.classList.add('listening'); btn.textContent = '\uD83D\uDD34'; }
  };
  aiSpeechRecognition.onresult = function(e) {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    const inp = document.getElementById('aiInput');
    if (inp) inp.value = final || interim;
  };
  aiSpeechRecognition.onend = function() {
    aiListening = false;
    const btn = document.getElementById('aiVoiceBtn');
    if (btn) { btn.classList.remove('listening'); btn.textContent = '\uD83C\uDF99\uFE0F'; }
    const inp = document.getElementById('aiInput');
    if (inp && inp.value.trim()) setTimeout(function() { aiHandleSend(); }, 300);
  };
  aiSpeechRecognition.onerror = function(e) {
    aiListening = false;
    const btn = document.getElementById('aiVoiceBtn');
    if (btn) { btn.classList.remove('listening'); btn.textContent = '\uD83C\uDF99\uFE0F'; }
    if (e.error !== 'no-speech') _aiToast('Voice error: ' + e.error);
  };
}

function aiToggleVoice() {
  if (!aiSpeechRecognition) { _aiToast('\u098F\u0987 \u09AC\u09CD\u09B0\u09BE\u0989\u099C\u09BE\u09B0\u09C7 voice \u09B8\u09BE\u09AA\u09CB\u09B0\u09CD\u099F \u09A8\u09C7\u0987\u0964'); return; }
  if (aiListening) aiSpeechRecognition.stop();
  else { try { aiSpeechRecognition.start(); } catch(e) {} }
}

// ═══════════════════════════════════════════════════════════════════
// UI HANDLERS
// ═══════════════════════════════════════════════════════════════════
async function aiHandleSend() {
  const inp = document.getElementById('aiInput');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.style.height = 'auto';
  _aiAddMessage('user', text);
  _aiShowTyping();
  const result = await aiSendMessage(text);
  _aiHideTyping();
  _aiAddMessage('assistant', result.reply);
  if (result.update) _aiShowUpdateConfirm(result.update);
}

function _aiShowUpdateConfirm(update) {
  const chat = document.getElementById('aiChatBody');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'ai-update-confirm';
  const updateJson = JSON.stringify(update);
  div.innerHTML =
    '<div class="ai-update-label">\uD83D\uDCCA AI \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u09AA\u09CD\u09B0\u09B8\u09CD\u09A4\u09BE\u09AC</div>' +
    '<div class="ai-update-detail">' + _formatUpdateForDisplay(update) + '</div>' +
    '<div class="ai-update-btns">' +
      '<button class="ai-confirm-btn" onclick=\'aiApplyUpdate(' + updateJson + ',this)\'>\u2705 \u09AA\u09CD\u09B0\u09AF\u09BC\u09CB\u0997 \u0995\u09B0\u09CB</button>' +
      '<button class="ai-dismiss-btn" onclick="this.closest(\'.ai-update-confirm\').remove()">\u274C \u09AC\u09BE\u09A4\u09BF\u09B2</button>' +
    '</div>';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function aiApplyUpdate(update, btn) {
  const success = applyAIStatUpdate(update);
  const container = btn.closest('.ai-update-confirm');
  if (success) {
    container.innerHTML = '<div class="ai-update-done">\u2705 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8! <button class="ai-undo-btn" onclick="undoAIChange()">\u21A9\uFE0F Undo</button></div>';
    _aiToast('Stats \u0986\u09AA\u09A1\u09C7\u099F \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 \u2705');
  } else {
    container.innerHTML = '<div class="ai-update-done" style="color:#f88">\u274C \u0986\u09AA\u09A1\u09C7\u099F \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964</div>';
  }
}

function _formatUpdateForDisplay(u) {
  const ms = App.S.ms || 108;
  switch(u.action) {
    case 'set_jap': return u.date + ' \u2014 \u099C\u09BE\u09AA: ' + (u.value || 0).toLocaleString() + ' (' + Math.floor((u.value || 0) / ms) + ' \u09AE\u09BE\u09B2\u09BE)' + (u.timeSec ? ', \u09B8\u09AE\u09AF\u09BC: ' + Math.round(u.timeSec / 60) + ' \u09AE\u09BF\u09A8\u09BF\u099F' : '');
    case 'add_jap': return u.date + ' \u2014 ' + (u.value || 0).toLocaleString() + ' \u099C\u09BE\u09AA \u09AF\u09CB\u0997';
    case 'set_brahmacharya_broken': return u.date + ' \u2014 \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u09AD\u0999\u09CD\u0997 (' + (u.count || 1) + ' \u09AC\u09BE\u09B0)';
    case 'restore_brahmacharya': return u.date + ' \u2014 \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u09AA\u09C1\u09A8\u09B0\u09C1\u09A6\u09CD\u09A7\u09BE\u09B0';
    default: return JSON.stringify(u);
  }
}

function _aiAddMessage(role, text) {
  const chat = document.getElementById('aiChatBody');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-' + role;
  div.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function _aiShowTyping() {
  const chat = document.getElementById('aiChatBody');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-assistant ai-typing';
  div.id = 'aiTypingIndicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function _aiHideTyping() {
  const el = document.getElementById('aiTypingIndicator');
  if (el) el.remove();
}

function _aiToast(msg) {
  const t = document.createElement('div');
  t.className = 'ai-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.classList.add('show'); }, 10);
  setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 300); }, 3000);
}

function aiClearChat() {
  aiChatHistory = [];
  try { sessionStorage.removeItem('rjap_ai_history'); } catch(e) {}
  const chat = document.getElementById('aiChatBody');
  if (chat) {
    chat.innerHTML =
      '<div class="ai-welcome">' +
        '<div class="ai-welcome-icon">\u{1F549}\uFE0F</div>' +
        '<div class="ai-welcome-title">\u09B0\u09BE\u09A7\u09C7 \u09B0\u09BE\u09A7\u09C7, Drak!</div>' +
        '<div class="ai-welcome-sub">\u0986\u09AE\u09BF \u09A4\u09CB\u09AE\u09BE\u09B0 AI \u09B8\u09BE\u09A7\u09A8\u09BE \u09B8\u09B9\u09BE\u09AF\u09BC\u0995\u0964 \u09A4\u09CB\u09AE\u09BE\u09B0 \u099C\u09BE\u09AA, \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u09AC\u09BE \u09AF\u09C7\u0995\u09CB\u09A8\u09CB \u0986\u09A7\u09CD\u09AF\u09BE\u09A4\u09CD\u09AE\u09BF\u0995 \u09A4\u09A5\u09CD\u09AF \u099C\u09BF\u099C\u09CD\u099E\u09C7\u09B8 \u0995\u09B0\u09CB\u0964</div>' +
        '<div class="ai-suggestions">' +
          '<button onclick="aiQuickAsk(\'\u0986\u099C\u0995\u09C7 \u0986\u09AE\u09BE\u09B0 \u09B8\u09BE\u09A7\u09A8\u09BE \u0995\u09C7\u09AE\u09A8 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7?\')">\uD83D\uDCCA \u0986\u099C\u0995\u09C7\u09B0 \u09B8\u09BE\u09B0\u09B8\u0982\u0995\u09CD\u09B7\u09C7\u09AA</button>' +
          '<button onclick="aiQuickAsk(\'\u098F\u0987 \u09AE\u09BE\u09B8\u09C7 \u0995\u09CB\u09A8 \u09A6\u09BF\u09A8 \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u09AD\u09C7\u0999\u09C7\u099B\u09BF?\')">\uD83D\uDEE1\uFE0F \u09AC\u09CD\u09B0\u09B9\u09CD\u09AE\u099A\u09B0\u09CD\u09AF \u09B0\u09BF\u09AA\u09CB\u09B0\u09CD\u099F</button>' +
          '<button onclick="aiQuickAsk(\'\u0995\u09CB\u09A8 \u09A6\u09BF\u09A8 \u0986\u09AE\u09BE\u09B0 \u098F\u0995\u09BE\u0997\u09CD\u09B0\u09A4\u09BE \u09B8\u09AC\u099A\u09C7\u09AF\u09BC\u09C7 \u09AD\u09BE\u09B2\u09CB \u099B\u09BF\u09B2?\')">\uD83C\uDFAF \u09B8\u09C7\u09B0\u09BE \u09A6\u09BF\u09A8</button>' +
          '<button onclick="aiQuickAsk(\'\u0986\u09AE\u09BE\u09B0 \u099C\u09BE\u09AA\u09C7\u09B0 \u0997\u09A4\u09BF \u0995\u09C7\u09AE\u09A8? \u09AE\u09BF\u09A5\u09CD\u09AF\u09BE \u099C\u09BE\u09AA \u09B9\u099A\u09CD\u099B\u09C7 \u0995\u09BF?\')">\uD83D\uDD0D \u099C\u09BE\u09AA \u09AC\u09BF\u09B6\u09CD\u09B2\u09C7\u09B7\u09A3</button>' +
        '</div>' +
      '</div>';
  }
}

function aiQuickAsk(text) {
  const inp = document.getElementById('aiInput');
  if (inp) { inp.value = text; aiHandleSend(); }
}

function aiInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiHandleSend(); }
}
