// ═══════════════════════════════════════════════════════════════════
// Radha Naam Jap — Gemini AI Spiritual Companion
// Developer-only feature (drakthephenomenal@gmail.com)
// ═══════════════════════════════════════════════════════════════════

const GEMINI_URL = ‘https://radharadharadha.vercel.app/api/gemini’;

const AI_DEV_EMAIL = ‘drakthephenomenal@gmail.com’;

let aiChatHistory = [];
let aiPendingUndo = null;
let aiSpeechRecognition = null;
let aiListening = false;

// ═══════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════
function initGeminiAI(userEmail) {
if (userEmail !== AI_DEV_EMAIL) return;
const btn = document.getElementById(‘aiNavBtn’);
if (btn) btn.style.display = ‘flex’;
try {
const saved = sessionStorage.getItem(‘rjap_ai_history’);
if (saved) aiChatHistory = JSON.parse(saved);
} catch(e) {}
_setupSpeechRecognition();
console.log(’[GeminiAI] Developer AI companion initialized 🙏’);
}

// ═══════════════════════════════════════════════════════════════════
// BUILD CONTEXT — full spiritual data snapshot for Gemini
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

// Last 60 days summary
const days = [];
for (let i = 0; i < 60; i++) {
const d = new Date();
d.setDate(d.getDate() - i);
const k = d.toISOString().split(‘T’)[0];
const radhaCount = hist[k] || 0;
const rvCount = histRV[k] || 0;
const totalCount = radhaCount + rvCount;
const timeSec = (timerHist[k] || 0) + (timerHistRV[k] || 0);
const brahmaEntry = (S.brahma || {})[k];
const bcBroken = brahmaEntry && brahmaEntry.status === ‘b’;
if (totalCount > 0 || bcBroken) {
days.push({
date: k,
japRadha: radhaCount,
japRV: rvCount,
japTotal: totalCount,
malasTotal: Math.floor(totalCount / ms),
timeMinutes: Math.round(timeSec / 60),
brahmacharya_broken: bcBroken,
brahmacharya_break_count: bcBroken ? (brahmaEntry.count || 1) : 0
});
}
}

// Today’s mala-by-mala log (concentration analysis)
const todayMalaLog = malaLog.map((sec, i) => ({
mala: i + 1,
durationSeconds: sec,
durationMinutes: +(sec / 60).toFixed(2),
quality: sec < 120 ? ‘false/very-fast’ : sec < 180 ? ‘fast’ : sec < 420 ? ‘normal’ : ‘deep’
}));

// Brahmacharya
const brahma = S.brahma || {};
const bcStart = S.brahmacharya_start_date || ‘’;
const allBcBrokenDates = Object.keys(brahma).filter(k => brahma[k]?.status === ‘b’).sort();
let bcStreak = 0;
const d2 = new Date();
while (bcStreak < 999) {
const k = d2.toISOString().split(‘T’)[0];
if (k < bcStart) break;
const en = brahma[k];
if (!en || en.status !== ‘b’) { bcStreak++; d2.setDate(d2.getDate() - 1); } else break;
}

// Lifetime totals
const lifetimeRadha = Math.max(0, Object.values(hist).reduce((a,b)=>a+b,0) - (S.nameJapDeduct||0));
const lifetimeRV = Math.max(0, Object.values(histRV).reduce((a,b)=>a+b,0) - (S.nameJapDeductRV||0));

return {
today,
currentTime: new Date().toLocaleTimeString(‘en-IN’, {hour:‘2-digit’, minute:‘2-digit’}),
currentMode: S.japMode || ‘radha’,
malaSize: ms,
targets: { daily: S.dt || 0, dailyMalas: Math.floor((S.dt||0)/ms), lifetime: S.lt || 0 },
today_summary: {
japCount: hist[today] || 0,
japMalas: Math.floor((hist[today]||0) / ms),
timeMinutes: Math.round((timerHist[today]||0) / 60),
malaLog: todayMalaLog,
brahmacharya_broken: !!(brahma[today]?.status === ‘b’)
},
lifetime: {
radhaJap: lifetimeRadha, rvJap: lifetimeRV,
totalJap: lifetimeRadha + lifetimeRV,
totalMalas: Math.floor((lifetimeRadha + lifetimeRV) / ms)
},
brahmacharya: {
startDate: bcStart, currentStreak: bcStreak,
totalBrokenDays: allBcBrokenDates.length,
brokenDates: allBcBrokenDates,
brahmaDetails: brahma
},
last60Days: days,
names28: {
todayCount: (S.h28||{})[today] || 0,
todayTimeMinutes: Math.round(((S.timer28History||{})[today]||0)/60)
}
};
}

// ═══════════════════════════════════════════════════════════════════
// SEND MESSAGE TO GEMINI
// ═══════════════════════════════════════════════════════════════════
async function aiSendMessage(userText) {
if (!userText.trim()) return { reply: ‘’, update: null };

const context = _buildAppContext();

const systemPrompt = `তুমি আমার ব্যক্তিগত আধ্যাত্মিক AI সহায়ক। আমার নাম Drak। আমি একজন বৈষ্ণব সাধক। তুমি আমার Radha Naam Jap sadhana অ্যাপের সাথে সংযুক্ত এবং আমার সমস্ত আধ্যাত্মিক ডেটা দেখতে পাও।

তোমার ভূমিকা:

1. আমার জাপ, ব্রহ্মচর্য এবং সাধনার তথ্য বিশ্লেষণ করা
1. আমি বলি “আজকে X জাপ করলাম Y সময়ে” — তুমি সেটা updateAppStats এর মাধ্যমে আপডেট করবে
1. মিথ্যা জাপ শনাক্ত করা (প্রতি মালা ২ মিনিটের কম = মিথ্যা জাপ)
1. বাংলা, ইংরেজি এবং হিন্দি মিশিয়ে কথা বলা (বাংলা প্রাধান্য)
1. আধ্যাত্মিক উৎসাহ দেওয়া — রাধে রাধে ভাব বজায় রাখা

বর্তমান অ্যাপ ডেটা:
${JSON.stringify(context, null, 2)}

যদি আমি stats আপডেট করতে বলি, উত্তরের শেষে এই format এ দাও:
[UPDATE_STATS]{“action”:“set_jap”,“date”:“2026-05-02”,“value”:21000,“timeSec”:18000}[/UPDATE_STATS]

সম্ভব actions:

- “set_jap”: নির্দিষ্ট দিনে জাপ সেট করা। value=জাপ সংখ্যা, timeSec=সেকেন্ডে সময় (optional)
- “add_jap”: জাপ যোগ করা
- “set_brahmacharya_broken”: ব্রহ্মচর্য ভঙ্গ চিহ্নিত করা। count=কতবার
- “restore_brahmacharya”: ব্রহ্মচর্য পুনরুদ্ধার

মিথ্যা জাপ: প্রতি মালা গড় ৩০ সেকেন্ডের কম হলে সতর্ক করো।
সংক্ষিপ্ত উত্তর দাও। রাধে রাধে! 🙏`;

aiChatHistory.push({ role: ‘user’, parts: [{ text: userText }] });
if (aiChatHistory.length > 40) aiChatHistory = aiChatHistory.slice(-40);

const body = {
system_instruction: { parts: [{ text: systemPrompt }] },
contents: aiChatHistory,
generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
};

try {
const resp = await fetch(GEMINI_URL, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify(body)
});
if (!resp.ok) {
const err = await resp.json();
throw new Error(err.error?.message || ’Gemini API error ’ + resp.status);
}
const data = await resp.json();
const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || ‘কোনো উত্তর পাওয়া যায়নি।’;

```
aiChatHistory.push({ role: 'model', parts: [{ text: replyText }] });
try { sessionStorage.setItem('rjap_ai_history', JSON.stringify(aiChatHistory)); } catch(e) {}

const updateMatch = replyText.match(/\[UPDATE_STATS\]([\s\S]*?)\[\/UPDATE_STATS\]/);
const cleanReply = replyText.replace(/\[UPDATE_STATS\][\s\S]*?\[\/UPDATE_STATS\]/g, '').trim();
let pendingUpdate = null;
if (updateMatch) {
  try { pendingUpdate = JSON.parse(updateMatch[1].trim()); } catch(e) {}
}
return { reply: cleanReply, update: pendingUpdate };
```

} catch(e) {
console.error(’[GeminiAI]’, e);
return { reply: ’❌ Error: ’ + e.message + ‘\n\nAPI key restrict করা আছে কি? console.cloud.google.com এ চেক করো।’, update: null };
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
malaLog: […(S.malaLog || [])],
action: update
};

switch(update.action) {
case ‘set_jap’: {
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
case ‘add_jap’:
S.history[key] = (S.history[key] || 0) + (parseInt(update.value) || 0);
break;
case ‘set_brahmacharya_broken’:
if (!S.brahma) S.brahma = {};
S.brahma[key] = { status: ‘b’, count: parseInt(update.count) || 1 };
break;
case ‘restore_brahmacharya’:
if (S.brahma?.[key]) delete S.brahma[key];
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
if (!aiPendingUndo) { _aiToast(‘পূর্বাবস্থায় ফেরানোর কিছু নেই।’); return; }
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
_aiToast(‘↩️ পরিবর্তন বাতিল করা হয়েছে।’);
_aiAddMessage(‘system’, ‘↩️ আগের পরিবর্তন undo করা হয়েছে।’);
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
aiSpeechRecognition.lang = ‘bn-BD’;

aiSpeechRecognition.onstart = () => {
aiListening = true;
const btn = document.getElementById(‘aiVoiceBtn’);
if (btn) { btn.classList.add(‘listening’); btn.textContent = ‘🔴’; }
};
aiSpeechRecognition.onresult = (e) => {
let interim = ‘’, final = ‘’;
for (let i = e.resultIndex; i < e.results.length; i++) {
if (e.results[i].isFinal) final += e.results[i][0].transcript;
else interim += e.results[i][0].transcript;
}
const inp = document.getElementById(‘aiInput’);
if (inp) inp.value = final || interim;
};
aiSpeechRecognition.onend = () => {
aiListening = false;
const btn = document.getElementById(‘aiVoiceBtn’);
if (btn) { btn.classList.remove(‘listening’); btn.textContent = ‘🎤’; }
const inp = document.getElementById(‘aiInput’);
if (inp && inp.value.trim()) setTimeout(() => aiHandleSend(), 300);
};
aiSpeechRecognition.onerror = (e) => {
aiListening = false;
const btn = document.getElementById(‘aiVoiceBtn’);
if (btn) { btn.classList.remove(‘listening’); btn.textContent = ‘🎤’; }
if (e.error !== ‘no-speech’) _aiToast(’Voice error: ’ + e.error);
};
}

function aiToggleVoice() {
if (!aiSpeechRecognition) { _aiToast(‘এই ব্রাউজারে voice সাপোর্ট নেই।’); return; }
if (aiListening) aiSpeechRecognition.stop();
else { try { aiSpeechRecognition.start(); } catch(e) {} }
}

// ═══════════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════════
async function aiHandleSend() {
const inp = document.getElementById(‘aiInput’);
if (!inp) return;
const text = inp.value.trim();
if (!text) return;
inp.value = ‘’;
inp.style.height = ‘auto’;
_aiAddMessage(‘user’, text);
_aiShowTyping();
const { reply, update } = await aiSendMessage(text);
_aiHideTyping();
_aiAddMessage(‘assistant’, reply);
if (update) _aiShowUpdateConfirm(update);
}

function _aiShowUpdateConfirm(update) {
const chat = document.getElementById(‘aiChatBody’);
if (!chat) return;
const div = document.createElement(‘div’);
div.className = ‘ai-update-confirm’;
const safeUpdate = JSON.stringify(update).replace(/’/g, “\’”);
div.innerHTML = ` <div class="ai-update-label">📊 AI পরিবর্তন প্রস্তাব</div> <div class="ai-update-detail">${_formatUpdateForDisplay(update)}</div> <div class="ai-update-btns"> <button class="ai-confirm-btn" onclick='aiApplyUpdate(${JSON.stringify(update)},this)'>✅ প্রয়োগ করো</button> <button class="ai-dismiss-btn" onclick="this.closest('.ai-update-confirm').remove()">❌ বাতিল</button> </div>`;
chat.appendChild(div);
chat.scrollTop = chat.scrollHeight;
}

function aiApplyUpdate(update, btn) {
const success = applyAIStatUpdate(update);
const container = btn.closest(’.ai-update-confirm’);
if (success) {
container.innerHTML = ‘<div class="ai-update-done">✅ পরিবর্তন সম্পন্ন! <button class="ai-undo-btn" onclick="undoAIChange()">↩️ Undo</button></div>’;
_aiToast(‘Stats আপডেট হয়েছে ✅’);
} else {
container.innerHTML = ‘<div class="ai-update-done" style="color:#f88">❌ আপডেট ব্যর্থ হয়েছে।</div>’;
}
}

function _formatUpdateForDisplay(u) {
const ms = App.S.ms || 108;
switch(u.action) {
case ‘set_jap’: return `${u.date} — জাপ: ${(u.value||0).toLocaleString()} (${Math.floor((u.value||0)/ms)} মালা)${u.timeSec ? `, সময়: ${Math.round(u.timeSec/60)} মিনিট` : ''}`;
case ‘add_jap’: return `${u.date} — ${(u.value||0).toLocaleString()} জাপ যোগ`;
case ‘set_brahmacharya_broken’: return `${u.date} — ব্রহ্মচর্য ভঙ্গ (${u.count||1} বার)`;
case ‘restore_brahmacharya’: return `${u.date} — ব্রহ্মচর্য পুনরুদ্ধার`;
default: return JSON.stringify(u);
}
}

function _aiAddMessage(role, text) {
const chat = document.getElementById(‘aiChatBody’);
if (!chat) return;
const div = document.createElement(‘div’);
div.className = ‘ai-msg ai-msg-’ + role;
div.innerHTML = text
.replace(/**(.*?)**/g, ‘<strong>$1</strong>’)
.replace(/*(.*?)*/g, ‘<em>$1</em>’)
.replace(/\n/g, ‘<br>’);
chat.appendChild(div);
chat.scrollTop = chat.scrollHeight;
}

function _aiShowTyping() {
const chat = document.getElementById(‘aiChatBody’);
if (!chat) return;
const div = document.createElement(‘div’);
div.className = ‘ai-msg ai-msg-assistant ai-typing’;
div.id = ‘aiTypingIndicator’;
div.innerHTML = ‘<span></span><span></span><span></span>’;
chat.appendChild(div);
chat.scrollTop = chat.scrollHeight;
}

function _aiHideTyping() {
const el = document.getElementById(‘aiTypingIndicator’);
if (el) el.remove();
}

function _aiToast(msg) {
const t = document.createElement(‘div’);
t.className = ‘ai-toast’;
t.textContent = msg;
document.body.appendChild(t);
setTimeout(() => t.classList.add(‘show’), 10);
setTimeout(() => { t.classList.remove(‘show’); setTimeout(() => t.remove(), 300); }, 3000);
}

function aiClearChat() {
aiChatHistory = [];
try { sessionStorage.removeItem(‘rjap_ai_history’); } catch(e) {}
const chat = document.getElementById(‘aiChatBody’);
if (chat) {
chat.innerHTML = `<div class="ai-welcome"> <div class="ai-welcome-icon">🕉️</div> <div class="ai-welcome-title">রাধে রাধে, Drak!</div> <div class="ai-welcome-sub">আমি তোমার AI সাধনা সহায়ক। তোমার জাপ, ব্রহ্মচর্য বা যেকোনো আধ্যাত্মিক তথ্য জিজ্ঞেস করো।</div> <div class="ai-suggestions"> <button onclick="aiQuickAsk('আজকে আমার সাধনা কেমন হয়েছে?')">📊 আজকের সারসংক্ষেপ</button> <button onclick="aiQuickAsk('এই মাসে কোন দিন ব্রহ্মচর্য ভেঙেছি?')">🛡️ ব্রহ্মচর্য রিপোর্ট</button> <button onclick="aiQuickAsk('কোন দিন আমার একাগ্রতা সবচেয়ে ভালো ছিল?')">🎯 সেরা দিন</button> <button onclick="aiQuickAsk('আমার জাপের গতি কেমন? মিথ্যা জাপ হচ্ছে কি?')">🔍 জাপ বিশ্লেষণ</button> </div> </div>`;
}
}

function aiQuickAsk(text) {
const inp = document.getElementById(‘aiInput’);
if (inp) { inp.value = text; aiHandleSend(); }
}

function aiInputKeydown(e) {
if (e.key === ‘Enter’ && !e.shiftKey) { e.preventDefault(); aiHandleSend(); }
}
