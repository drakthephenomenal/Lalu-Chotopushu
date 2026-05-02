// ═══════════════════════════════════════════════════════════════════
//  RADHA JAP AI — Claude AI Assistant
//  Icon lives at top of Stats section (vs view)
//  Calls /api/chat (Vercel serverless — key hidden from GitHub)
//  Knows full app state, activityLog, Firebase schema, all features
// ═══════════════════════════════════════════════════════════════════

const RJ_AI = {

  history: [],
  isOpen: false,
  isLoading: false,

  buildContext() {
    const S = App.S;
    const today = S.tk;
    const ms = S.ms || 108;
    const totalRadha = Math.max(0, Object.values(S.history||{}).reduce((a,b)=>a+b,0) - (S.nameJapDeduct||0));
    const totalRV = Math.max(0, Object.values(S.historyRV||{}).reduce((a,b)=>a+b,0) - (S.nameJapDeductRV||0));
    const totalJap = totalRadha + totalRV;

    let streak = 0;
    const cd = new Date();
    for (let i = 0; i < 365; i++) {
      const k = cd.getFullYear()+'-'+String(cd.getMonth()+1).padStart(2,'0')+'-'+String(cd.getDate()).padStart(2,'0');
      if (((S.history||{})[k]||0)+((S.historyRV||{})[k]||0) > 0) { streak++; cd.setDate(cd.getDate()-1); } else break;
    }

    const combined = App.getCombinedHistory();
    const bestEntry = Object.entries(combined).sort(([,a],[,b])=>b-a)[0];
    const activeDays = Object.values(combined).filter(v=>v>0);
    const avgPerDay = activeDays.length ? Math.round(activeDays.reduce((a,b)=>a+b,0)/activeDays.length) : 0;
    const allTimerSec = Object.values(S.timerHistory||{}).reduce((a,b)=>a+b,0) + Object.values(S.timerHistoryRV||{}).reduce((a,b)=>a+b,0);

    const last7 = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      last7.push({ date:k, radha:(S.history||{})[k]||0, rv:(S.historyRV||{})[k]||0, timeSec:((S.timerHistory||{})[k]||0)+((S.timerHistoryRV||{})[k]||0), names28:(S.h28||{})[k]||0 });
    }

    const recentLog = (S.activityLog||[]).slice(-100).map(e => {
      const d = new Date(e.ts);
      return { ...e, human_time: d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}) };
    });

    const bcDays = Object.entries(S.brahma||{});
    const bcMaint = bcDays.filter(([,v])=>(v==='m'||(v?.status==='m'))).length;
    const bcBroken = bcDays.filter(([,v])=>(v==='b'||(v?.status==='b'))).length;

    const bcLog = (S.activityLog||[]).filter(e=>e.t==='brahma').slice(-30).map(e=>{
      const d = new Date(e.ts);
      return { date:e.date, status:e.status, marked_at:d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}), day_of_week:d.toLocaleDateString('en-IN',{weekday:'long'}), hour:d.getHours() };
    });

    const malaLog = (S.activityLog||[]).filter(e=>e.t==='mala').slice(-50).map(e=>{
      const d = new Date(e.ts);
      return { mala_n:e.n, mode:e.mode, dur_sec:e.sec, at:d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}), date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') };
    });

    const sessionLog = (S.activityLog||[]).filter(e=>e.t==='session').slice(-20).map(e=>{
      const s = new Date(e.ts), en = new Date(e.end);
      return { mode:e.mode, start:s.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}), end:en.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}), dur_min:Math.round(e.secs/60), date:s.getFullYear()+'-'+String(s.getMonth()+1).padStart(2,'0')+'-'+String(s.getDate()).padStart(2,'0') };
    });

    return {
      today, user: fbUser?.email||'Guest',
      jap: { today_radha:(S.history||{})[today]||0, today_rv:(S.historyRV||{})[today]||0, today_combined:((S.history||{})[today]||0)+((S.historyRV||{})[today]||0), today_malas:Math.floor((((S.history||{})[today]||0)+((S.historyRV||{})[today]||0))/ms), today_time_sec:((S.timerHistory||{})[today]||0)+((S.timerHistoryRV||{})[today]||0), lifetime_radha:totalRadha, lifetime_rv:totalRV, lifetime_combined:totalJap, lifetime_malas:Math.floor(totalJap/ms), lifetime_time_hrs:(allTimerSec/3600).toFixed(1), mala_size:ms, daily_target:S.dt||0, rv_daily_target:S.dtRV||0, lifetime_target:S.lt||0, streak:streak, best_day:bestEntry?{date:bestEntry[0],count:bestEntry[1]}:null, avg_per_active_day:avgPerDay, total_active_days:activeDays.length, mode:S.japMode||'radha' },
      names28: { today:(S.h28||{})[today]||0, lifetime:Object.values(S.h28||{}).reduce((a,b)=>a+b,0), today_sec:(S.timer28History||{})[today]||0 },
      brahmacharya: { start:S.brahmacharya_start_date||null, maintained:bcMaint, broken:bcBroken, success_rate:bcDays.length?Math.round(bcMaint/bcDays.length*100)+'%':'N/A', recent_marks:bcLog },
      last_7_days: last7,
      mala_timing_log: malaLog,
      session_log: sessionLog,
      sankalpas: (S.sankalpas||[]).map(sk=>({wish:sk.wish,target:sk.target,done_cycles:sk.current||0,pct:sk.target?Math.round(((sk.current||0)/sk.target)*100):0,completed:sk.done||false})),
      raw_activity_last100: recentLog,
      app: { firebase:'guru-kripahi-kevalam-108', firestore_path:fbUser?'users/'+fbUser.uid+'/data/main':'N/A', storage:'IndexedDB v3 + Firestore realtime', pwa:true, platform:'Vercel', cloud_sync:fbUser?'active':'offline', mala_bell:S.cfg?.sound?'on':'off', vibration:S.cfg?.vib?'on':'off' }
    };
  },

  async send(userMsg) {
    if (this.isLoading) return;
    this.isLoading = true;
    this.addMsg('user', userMsg);
    this.showTyping(true);
    this.setBtn(false);

    const ctx = this.buildContext();
    const systemPrompt = `You are Claude AI, a sadhana data assistant embedded in the Stats section of "Radha Naam Jap" — a spiritual PWA for devotees of Radha Rani.

You have the user's COMPLETE live data including a timestamped activityLog of every action.

ACTIVITY LOG EVENTS (in activityLog array):
- {t:'mala', ts:unix_ms, mode:'radha'|'rv', n:mala_number, sec:duration_seconds} — every mala completion
- {t:'session', ts:start_ms, end:end_ms, mode, secs:duration} — every jap sitting start/end
- {t:'brahma', ts:unix_ms, status:'m'|'b', date:'YYYY-MM-DD'} — brahmacharya marked with exact time
- {t:'28cycle', ts:unix_ms, n:cycle_num, sec:cycle_duration} — 28 names cycle complete
- {t:'stotram', ts:unix_ms, id, count} — stotram recited

FIREBASE SCHEMA (users/{uid}/data/main):
history/historyRV: {"YYYY-MM-DD": count} | timerHistory/timerHistoryRV: {"YYYY-MM-DD": seconds}
h28/timer28History: {"YYYY-MM-DD": count/seconds} | brahma: {"YYYY-MM-DD": "m"|{status:"b",count:N}}
activityLog: [...timestamped events, max 500] | malaLog/malaLogRV: [seconds per mala today]
ms, dt, lt, dtRV, nameJapDeduct, japMode, brahmacharya_start_date, sankalpas, occasions, customSt
Storage: IndexedDB (RadhaJapDB v3) primary → Firestore realtime → localStorage fallback
Platform: Vercel PWA via GitHub. Firebase Auth: Google + Zoho. Single-device session enforcement.

Be concise and data-driven. Use the exact numbers from the data. Mobile-friendly formatting. Natural emojis.

LIVE DATA:
${JSON.stringify(ctx, null, 2)}`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...this.history, { role:'user', content:userMsg }], systemPrompt })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const reply = data.reply || 'Jai Radhe 🙏 No response received.';
      this.history.push({ role:'user', content:userMsg });
      this.history.push({ role:'assistant', content:reply });
      if (this.history.length > 20) this.history = this.history.slice(-20);
      this.showTyping(false);
      this.addMsg('ai', reply);
    } catch(err) {
      this.showTyping(false);
      this.addMsg('ai', err.message.includes('500')
        ? '🙏 Please add GEMINI_API_KEY in Vercel → Project Settings → Environment Variables, then redeploy.'
        : '🙏 Jai Radhe! Connection error. Please check internet and try again.');
    }
    this.isLoading = false;
    this.setBtn(true);
  },

  addMsg(role, text) {
    const feed = document.getElementById('rjai-feed');
    if (!feed) return;
    const wrap = document.createElement('div');
    wrap.className = 'rjai-msg rjai-' + role;
    const html = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g,'<code>$1</code>')
      .replace(/\n/g,'<br>');
    wrap.innerHTML = role === 'ai'
      ? '<div class="rjai-av">AI</div><div class="rjai-bub">'+html+'</div>'
      : '<div class="rjai-bub">'+html+'</div>';
    feed.appendChild(wrap);
    requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });
  },

  showTyping(show) {
    const t = document.getElementById('rjai-typing');
    if (t) t.style.display = show ? 'flex' : 'none';
    if (show) setTimeout(() => { const f = document.getElementById('rjai-feed'); if(f) f.scrollTop = f.scrollHeight; }, 50);
  },

  setBtn(on) { const b = document.getElementById('rjai-send'); if(b) b.disabled = !on; },

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    const p = document.getElementById('rjai-panel');
    if (p) { p.style.display = 'flex'; requestAnimationFrame(() => p.classList.add('rjai-open')); }
    if (this.history.length === 0) {
      setTimeout(() => {
        const ctx = this.buildContext();
        const tod = ctx.jap.today_combined, streak = ctx.jap.streak;
        this.addMsg('ai', tod > 0
          ? `Jai Radhe 🙏 Today: **${tod.toLocaleString('en-IN')} jap** (${ctx.jap.today_malas} malas) · Streak: **${streak} days** 🔥\n\nI have your full timestamped activity log. What would you like to know?`
          : `Jai Radhe 🙏 I'm your Claude AI assistant. I know your complete sadhana data — every mala, session, and Brahmacharya mark with exact timestamps.\n\nAsk me anything!`);
      }, 350);
    }
  },

  close() {
    this.isOpen = false;
    const p = document.getElementById('rjai-panel');
    if (!p) return;
    p.classList.remove('rjai-open');
    setTimeout(() => { p.style.display = 'none'; }, 330);
  },

  handleKey(e) { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); RJ_AI.submit(); } },

  submit() {
    const inp = document.getElementById('rjai-inp');
    if (!inp) return;
    const msg = inp.value.trim();
    if (!msg || this.isLoading) return;
    inp.value = ''; inp.style.height = 'auto';
    this.send(msg);
  },

  QUICK: [
    { l:'📊 Today',        q:'Give me a detailed analysis of today — jap counts, mala durations, what time I practiced.' },
    { l:'🔥 Streak',       q:'Analyze my streak and consistency. Gaps? Best periods?' },
    { l:'⏰ My timings',   q:'From the activity log, what time of day do I usually practice? How long are my sessions?' },
    { l:'🛡️ Brahmacharya', q:'Analyze brahmacharya data. What exact time were breaks marked? Day-of-week patterns?' },
    { l:'📈 7-Day report', q:'Data science style report of last 7 days with patterns and trends.' },
    { l:'🎯 Targets',      q:'How am I doing vs targets? When will I hit my lifetime goal at current pace?' },
    { l:'🌸 28 Names',     q:'My 28 Names cycles — counts, time spent, patterns from the log.' },
    { l:'💾 App & Firebase', q:'Explain the activityLog structure and how Firebase sync works in this app.' },
  ],

  mount() {
    const css = document.createElement('style');
    css.textContent = `
#rjai-toggle{display:flex;align-items:center;gap:9px;width:100%;margin:0 0 14px;padding:11px 16px;background:rgba(109,184,255,0.06);border:1px solid rgba(109,184,255,0.22);border-radius:14px;cursor:pointer;color:var(--a2);font-family:'Inter',sans-serif;font-size:13px;font-weight:500;-webkit-tap-highlight-color:transparent;transition:background 0.15s;}
#rjai-toggle:active{background:rgba(109,184,255,0.13);}
.rjai-tgl-icon{width:30px;height:30px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#3a5a8a,#6DB8FF);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;letter-spacing:-0.3px;}
.rjai-tgl-txt{flex:1;text-align:left;}
.rjai-tgl-lbl{font-size:13px;font-weight:600;color:var(--a2);}
.rjai-tgl-sub{font-size:10px;color:rgba(255,255,255,0.35);margin-top:1px;letter-spacing:0.5px;}
.rjai-tgl-arr{font-size:11px;color:rgba(255,255,255,0.3);flex-shrink:0;}
#rjai-panel{display:none;position:fixed;inset:0;z-index:9900;flex-direction:column;background:#060D1F;transform:translateY(100%);transition:transform 0.32s cubic-bezier(0.32,0.72,0,1);font-family:'Inter',sans-serif;padding-bottom:env(safe-area-inset-bottom,0px);}
#rjai-panel.rjai-open{transform:translateY(0);}
.rjai-hdr{display:flex;align-items:center;gap:10px;padding:14px 16px 11px;border-bottom:1px solid rgba(109,184,255,0.15);background:rgba(0,0,0,0.5);flex-shrink:0;padding-top:max(14px,calc(env(safe-area-inset-top,0px) + 14px));}
.rjai-hdr-ic{width:34px;height:34px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,#3a5a8a,#6DB8FF);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;}
.rjai-hdr-info{flex:1;}
.rjai-hdr-name{font-size:14px;font-weight:700;color:var(--a2);}
.rjai-hdr-desc{font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:0.8px;text-transform:uppercase;margin-top:1px;}
.rjai-hdr-cls{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);border-radius:9px;padding:7px 13px;font-size:13px;cursor:pointer;flex-shrink:0;font-family:'Inter',sans-serif;}
.rjai-hdr-cls:active{background:rgba(255,255,255,0.14);}
.rjai-quick{display:flex;gap:7px;padding:9px 14px 8px;overflow-x:auto;flex-shrink:0;border-bottom:1px solid rgba(109,184,255,0.08);scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.rjai-quick::-webkit-scrollbar{display:none;}
.rjai-qb{flex-shrink:0;white-space:nowrap;padding:6px 13px;border-radius:20px;background:rgba(109,184,255,0.07);border:1px solid rgba(109,184,255,0.2);color:rgba(109,184,255,0.85);font-size:11px;cursor:pointer;font-family:'Inter',sans-serif;-webkit-tap-highlight-color:transparent;}
.rjai-qb:active{background:rgba(109,184,255,0.18);}
#rjai-feed{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:13px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(109,184,255,0.15) transparent;}
.rjai-msg{display:flex;gap:8px;align-items:flex-end;}
.rjai-ai{flex-direction:row;}
.rjai-user{flex-direction:row-reverse;}
.rjai-av{width:27px;height:27px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#3a5a8a,#6DB8FF);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700;}
.rjai-bub{max-width:84%;padding:10px 13px;border-radius:16px;font-size:13.5px;line-height:1.58;word-break:break-word;}
.rjai-ai .rjai-bub{background:rgba(255,255,255,0.055);border:1px solid rgba(109,184,255,0.18);color:rgba(255,255,255,0.92);border-bottom-left-radius:4px;}
.rjai-user .rjai-bub{background:rgba(109,184,255,0.14);border:1px solid rgba(109,184,255,0.3);color:#dff0ff;border-bottom-right-radius:4px;}
.rjai-bub strong{color:#6DB8FF;font-weight:600;}
.rjai-bub code{background:rgba(0,0,0,0.4);padding:1px 5px;border-radius:4px;font-size:11.5px;font-family:monospace;color:#7df0c2;}
#rjai-typing{display:none;align-items:flex-end;gap:8px;padding:2px 14px 4px;flex-shrink:0;}
.rjai-tbub{background:rgba(255,255,255,0.055);border:1px solid rgba(109,184,255,0.18);border-radius:16px;border-bottom-left-radius:4px;padding:10px 15px;display:flex;gap:5px;align-items:center;}
.rjai-dot{width:6px;height:6px;border-radius:50%;background:rgba(109,184,255,0.55);animation:rjai-b 1.3s infinite ease-in-out;}
.rjai-dot:nth-child(2){animation-delay:0.18s;}
.rjai-dot:nth-child(3){animation-delay:0.36s;}
@keyframes rjai-b{0%,60%,100%{transform:translateY(0);opacity:0.45;}30%{transform:translateY(-5px);opacity:1;}}
.rjai-inp-row{display:flex;gap:8px;padding:9px 14px 12px;border-top:1px solid rgba(109,184,255,0.1);background:rgba(0,0,0,0.35);flex-shrink:0;align-items:flex-end;}
#rjai-inp{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(109,184,255,0.22);border-radius:20px;padding:10px 14px;color:#fff;font-size:14px;font-family:'Inter',sans-serif;outline:none;resize:none;min-height:40px;max-height:96px;line-height:1.45;-webkit-appearance:none;}
#rjai-inp::placeholder{color:rgba(255,255,255,0.28);}
#rjai-inp:focus{border-color:rgba(109,184,255,0.45);}
#rjai-send{width:42px;height:42px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#3a5a8a,#6DB8FF);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;transition:transform 0.12s,opacity 0.2s;-webkit-tap-highlight-color:transparent;}
#rjai-send:active{transform:scale(0.88);}
#rjai-send:disabled{opacity:0.35;cursor:default;}
    `;
    document.head.appendChild(css);

    // Toggle button at top of Stats section
    const statsView = document.getElementById('vs');
    if (statsView) {
      const statsTitle = statsView.querySelector('.vt');
      const btn = document.createElement('button');
      btn.id = 'rjai-toggle';
      btn.innerHTML = '<div class="rjai-tgl-icon">AI</div><div class="rjai-tgl-txt"><div class="rjai-tgl-lbl">Claude AI — Sadhana Assistant</div><div class="rjai-tgl-sub">Tap to analyse your data with AI</div></div><span class="rjai-tgl-arr">▶</span>';
      btn.onclick = () => RJ_AI.open();
      if (statsTitle) statsTitle.after(btn); else statsView.prepend(btn);
    }

    // Full-screen panel
    const panel = document.createElement('div');
    panel.id = 'rjai-panel';
    panel.innerHTML = `<div class="rjai-hdr"><div class="rjai-hdr-ic">AI</div><div class="rjai-hdr-info"><div class="rjai-hdr-name">Claude AI</div><div class="rjai-hdr-desc">Sadhana Data Assistant</div></div><button class="rjai-hdr-cls" onclick="RJ_AI.close()">✕ Close</button></div><div class="rjai-quick" id="rjai-quick"></div><div id="rjai-feed"></div><div id="rjai-typing"><div class="rjai-av" style="flex-shrink:0">AI</div><div class="rjai-tbub"><div class="rjai-dot"></div><div class="rjai-dot"></div><div class="rjai-dot"></div></div></div><div class="rjai-inp-row"><textarea id="rjai-inp" placeholder="Ask anything about your sadhana…" rows="1" onkeydown="RJ_AI.handleKey(event)" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,96)+'px'"></textarea><button id="rjai-send" onclick="RJ_AI.submit()">➤</button></div>`;
    document.body.appendChild(panel);

    // Quick prompts
    const qc = document.getElementById('rjai-quick');
    this.QUICK.forEach(q => {
      const b = document.createElement('button');
      b.className = 'rjai-qb'; b.textContent = q.l;
      b.onclick = () => { if(!RJ_AI.isOpen) RJ_AI.open(); setTimeout(()=>RJ_AI.send(q.q), RJ_AI.history.length===0?700:100); };
      qc.appendChild(b);
    });
  }
};

(function waitMount() {
  if (typeof App !== 'undefined' && App.S && document.getElementById('vs')) { RJ_AI.mount(); }
  else setTimeout(waitMount, 400);
})();
