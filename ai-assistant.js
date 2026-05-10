// ═══════════════════════════════════════════════════════════════
//  JARVIS — Radha Naam Jap AI Assistant  v2.0
//  Powered by Claude AI · Voice + Chat · Full Analytics + Edit
//  Advanced: Mood tracking · Ritual detection · Smart scheduling
//  Prophecy (jap forecast) · Spiritual insights · Mantra suggestions
// ═══════════════════════════════════════════════════════════════

(function() {
'use strict';

function waitReady(cb) {
  if (typeof App !== 'undefined' && App.S) { cb(); }
  else { setTimeout(function() { waitReady(cb); }, 300); }
}

// ── Undo stack ──────────────────────────────────────────────────
var undoStack = [];
function pushUndo(desc, restoreFn) {
  undoStack.push({ desc: desc, restore: restoreFn });
  if (undoStack.length > 20) undoStack.shift();
}

// ── Data actions Jarvis can execute ────────────────────────────
var JA = {
  addJap: function(count, date, mode) {
    var tk = date || App.S.tk;
    var m = mode || App.S.japMode || 'radha';
    var hist = m === 'rv' ? App.S.historyRV : App.S.history;
    var prev = hist[tk] || 0;
    hist[tk] = prev + parseInt(count);
    App.save(); if(typeof App.ua==='function')App.ua(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    if(typeof logActivity==='function') logActivity({ t:'jarvis_edit', ts:Date.now(), action:'addJap', date:tk, mode:m, added:count });
    pushUndo('Added '+count+' '+m+' jap to '+tk, function(){ hist[tk]=prev; App.save(); if(typeof App.ua==='function')App.ua(); if(typeof fbDebouncedPush==='function')fbDebouncedPush(); });
    return 'Added **'+count+'** '+m+' jap to '+tk+'. New total: **'+hist[tk]+'**';
  },
  setJap: function(count, date, mode) {
    var tk = date || App.S.tk;
    var m = mode || App.S.japMode || 'radha';
    var hist = m === 'rv' ? App.S.historyRV : App.S.history;
    var prev = hist[tk] || 0;
    hist[tk] = parseInt(count);
    App.save(); if(typeof App.ua==='function')App.ua(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    pushUndo('Set '+m+' jap '+tk+' to '+count, function(){ hist[tk]=prev; App.save(); if(typeof App.ua==='function')App.ua(); if(typeof fbDebouncedPush==='function')fbDebouncedPush(); });
    return 'Set **'+m+'** jap for '+tk+' to **'+count+'**';
  },
  markBrahma: function(date, status) {
    var prev = App.S.brahma[date];
    if (status === 'b') { App.S.brahma[date] = { status:'b', count:1 }; }
    else { delete App.S.brahma[date]; }
    App.save(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    if(typeof logActivity==='function') logActivity({ t:'brahma', ts:Date.now(), status:status, date:date });
    pushUndo('Brahma '+date+' = '+status, function(){
      if(prev===undefined) delete App.S.brahma[date]; else App.S.brahma[date]=prev;
      App.save(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    });
    return 'Marked **'+date+'** Brahmacharya as **'+(status==='b'?'Broken':'Maintained')+'**';
  },
  addStotram: function(id, count) {
    count = parseInt(count)||1;
    if(!App.S.stotrams[id]) App.S.stotrams[id]={};
    var tk = App.S.tk;
    var prev = App.S.stotrams[id][tk]||0;
    App.S.stotrams[id][tk] = prev + count;
    App.save(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    if(typeof logActivity==='function') logActivity({ t:'stotram', ts:Date.now(), id:id, count:App.S.stotrams[id][tk] });
    pushUndo('Add stotram '+id, function(){ App.S.stotrams[id][tk]=prev; App.save(); if(typeof fbDebouncedPush==='function')fbDebouncedPush(); });
    return 'Added **'+count+'** recitation(s) of **'+id+'**. Today total: **'+App.S.stotrams[id][tk]+'**';
  },
  setDailyTarget: function(n, mode) {
    n = parseInt(n);
    var prev = mode==='rv' ? App.S.dtRV : App.S.dt;
    if(mode==='rv') App.S.dtRV=n; else App.S.dt=n;
    App.save(); if(typeof App.ua==='function')App.ua(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    pushUndo('Daily target', function(){ if(mode==='rv') App.S.dtRV=prev; else App.S.dt=prev; App.save(); if(typeof App.ua==='function')App.ua(); if(typeof fbDebouncedPush==='function')fbDebouncedPush(); });
    return 'Daily target set to **'+n+'**'+(mode==='rv'?' (RV)':'');
  },
  setLifetimeTarget: function(n) {
    n = parseInt(n);
    var prev = App.S.lt;
    App.S.lt = n;
    App.save(); if(typeof App.ua==='function')App.ua(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    pushUndo('Lifetime target', function(){ App.S.lt=prev; App.save(); if(typeof App.ua==='function')App.ua(); if(typeof fbDebouncedPush==='function')fbDebouncedPush(); });
    return 'Lifetime target set to **'+n.toLocaleString('en-IN')+'**';
  },
  addMood: function(score, note) {
    // Store mood log in App.S.moodLog = [{ts, score, note}]
    if(!App.S.moodLog) App.S.moodLog = [];
    var entry = { ts: Date.now(), score: parseInt(score), note: note||'' };
    App.S.moodLog.push(entry);
    if(App.S.moodLog.length > 200) App.S.moodLog = App.S.moodLog.slice(-200);
    App.save(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    var emojis = ['😔','😕','😐','🙂','😊','🌸','✨','🌟','💫','🙏','🌺'];
    var e = emojis[Math.min(score, 10)];
    return 'Mood logged: '+e+' ('+score+'/10)'+(note?' — '+note:'');
  },
  addSankalpa: function(wish, target) {
    if(!App.S.sankalpas) App.S.sankalpas = [];
    var sk = { wish: wish, target: parseInt(target)||0, current: 0, created: App.S.tk };
    App.S.sankalpas.push(sk);
    App.save(); if(typeof fbDebouncedPush==='function')fbDebouncedPush();
    return 'Sankalpa added: **'+wish+'** (target: '+target+')';
  },
  undo: function() {
    if(undoStack.length===0) return 'Nothing to undo.';
    var last = undoStack.pop();
    last.restore();
    return '↩️ Undone: '+last.desc;
  },
  undoHistory: function() {
    if(undoStack.length===0) return 'No recent actions to undo.';
    return 'Recent actions:\n'+undoStack.slice().reverse().map(function(u,i){ return (i+1)+'. '+u.desc; }).join('\n');
  }
};

// ── Advanced Analytics helpers ──────────────────────────────────
function detectPracticePatterns() {
  var S = App.S;
  var log = S.activityLog || [];
  var malaLog = log.filter(function(e){ return e.t === 'mala'; });

  // Hour distribution
  var hourBuckets = new Array(24).fill(0);
  malaLog.forEach(function(e) {
    var h = new Date(e.ts).getHours();
    hourBuckets[h] += e.n || 0;
  });
  var peakHour = hourBuckets.indexOf(Math.max.apply(null, hourBuckets));

  // Day-of-week distribution
  var dowBuckets = new Array(7).fill(0);
  var dowNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  malaLog.forEach(function(e) {
    var d = new Date(e.ts).getDay();
    dowBuckets[d] += e.n || 0;
  });
  var peakDow = dowBuckets.indexOf(Math.max.apply(null, dowBuckets));

  // Session gap analysis (last 30 sessions)
  var recent = malaLog.slice(-30).map(function(e){ return e.ts; }).sort(function(a,b){return a-b;});
  var gaps = [];
  for(var i=1; i<recent.length; i++) gaps.push((recent[i]-recent[i-1])/3600000);
  var avgGap = gaps.length ? (gaps.reduce(function(a,b){return a+b;},0)/gaps.length).toFixed(1) : null;

  return {
    peakHour: peakHour,
    peakHourLabel: peakHour < 12 ? peakHour+'am' : (peakHour===12?'12pm':(peakHour-12)+'pm'),
    peakDow: dowNames[peakDow],
    dowDistribution: dowNames.map(function(d,i){ return d+':'+dowBuckets[i]; }).join(', '),
    avgGapHours: avgGap
  };
}

function forecastJap() {
  var S = App.S;
  var hist = S.history || {};
  var histRV = S.historyRV || {};
  var keys = Object.keys(hist).concat(Object.keys(histRV));
  keys = [...new Set(keys)].sort();
  var recent30 = keys.slice(-30);
  var vals = recent30.map(function(k){ return (hist[k]||0)+(histRV[k]||0); });
  var nonZero = vals.filter(function(v){ return v > 0; });
  if(!nonZero.length) return null;
  var avg = nonZero.reduce(function(a,b){return a+b;},0)/nonZero.length;
  var tR = Object.values(hist).reduce(function(a,b){return a+b;},0);
  var tRV = Object.values(histRV).reduce(function(a,b){return a+b;},0);
  var total = tR + tRV;
  var lt = S.lt || 0;
  var remaining = lt ? lt - total : null;
  var daysToGoal = remaining && avg > 0 ? Math.ceil(remaining / avg) : null;
  var goalDate = daysToGoal ? new Date(Date.now() + daysToGoal * 86400000).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : null;
  return {
    avg30: Math.round(avg),
    consistency: Math.round((nonZero.length/recent30.length)*100)+'%',
    daysToGoal: daysToGoal,
    goalDate: goalDate,
    remaining: remaining
  };
}

function getMoodInsights() {
  var log = (App.S.moodLog || []).slice(-30);
  if(!log.length) return null;
  var avg = (log.reduce(function(a,e){return a+e.score;},0)/log.length).toFixed(1);
  var best = log.reduce(function(a,b){ return b.score > a.score ? b : a; });
  var worst = log.reduce(function(a,b){ return b.score < a.score ? b : a; });
  return { avg: avg, entries: log.length, best: best, worst: worst, recent: log.slice(-5) };
}

// ── Build context ───────────────────────────────────────────────
function buildCtx() {
  var S = App.S, today = S.tk, ms = S.ms||108;
  var tR = Math.max(0,Object.values(S.history||{}).reduce(function(a,b){return a+b;},0)-(S.nameJapDeduct||0));
  var tRV = Math.max(0,Object.values(S.historyRV||{}).reduce(function(a,b){return a+b;},0)-(S.nameJapDeductRV||0));
  var streak=0; var cd=new Date();
  for(var i=0;i<365;i++){
    var k=cd.getFullYear()+'-'+String(cd.getMonth()+1).padStart(2,'0')+'-'+String(cd.getDate()).padStart(2,'0');
    if(((S.history||{})[k]||0)+((S.historyRV||{})[k]||0)>0){streak++;cd.setDate(cd.getDate()-1);}else break;
  }
  var comb=typeof App.getCombinedHistory==='function'?App.getCombinedHistory():{};
  var best=Object.entries(comb).sort(function(a,b){return b[1]-a[1];})[0];
  var actDays=Object.values(comb).filter(function(v){return v>0;});
  var avg=actDays.length?Math.round(actDays.reduce(function(a,b){return a+b;},0)/actDays.length):0;
  var allSec=Object.values(S.timerHistory||{}).reduce(function(a,b){return a+b;},0)+Object.values(S.timerHistoryRV||{}).reduce(function(a,b){return a+b;},0);
  var l7=[];
  for(var j=0;j<7;j++){var d=new Date();d.setDate(d.getDate()-j);var dk=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');l7.push({date:dk,r:(S.history||{})[dk]||0,rv:(S.historyRV||{})[dk]||0,sec:((S.timerHistory||{})[dk]||0)+((S.timerHistoryRV||{})[dk]||0),n28:(S.h28||{})[dk]||0});}
  var bcE=Object.entries(S.brahma||{});
  var bcM=bcE.filter(function(e){return e[1]==='m'||(e[1]&&e[1].status==='m');}).length;
  var bcB=bcE.filter(function(e){return e[1]==='b'||(e[1]&&e[1].status==='b');}).length;
  var stSum={};Object.keys(S.stotrams||{}).forEach(function(id){var tot=Object.values(S.stotrams[id]).reduce(function(a,b){return a+b;},0);stSum[id]={today:S.stotrams[id][today]||0,total:tot};});

  // Advanced context
  var patterns = detectPracticePatterns();
  var forecast = forecastJap();
  var moodInsights = getMoodInsights();

  return {
    today:today, user:(typeof fbUser!=='undefined'&&fbUser)?fbUser.email:'Guest',
    jap:{today_r:(S.history||{})[today]||0,today_rv:(S.historyRV||{})[today]||0,today_total:((S.history||{})[today]||0)+((S.historyRV||{})[today]||0),today_malas:Math.floor((((S.history||{})[today]||0)+((S.historyRV||{})[today]||0))/ms),today_sec:((S.timerHistory||{})[today]||0)+((S.timerHistoryRV||{})[today]||0),life_r:tR,life_rv:tRV,life_total:tR+tRV,life_malas:Math.floor((tR+tRV)/ms),life_hrs:(allSec/3600).toFixed(1),ms:ms,dt:S.dt||0,dtRV:S.dtRV||0,lt:S.lt||0,streak:streak,best:best?{date:best[0],count:best[1]}:null,avg:avg,active_days:actDays.length,mode:S.japMode||'radha'},
    n28:{today:(S.h28||{})[today]||0,life:Object.values(S.h28||{}).reduce(function(a,b){return a+b;},0)},
    brahma:{start:S.brahmacharya_start_date||null,maintained:bcM,broken:bcB,rate:bcE.length?Math.round(bcM/bcE.length*100)+'%':'N/A'},
    stotrams:stSum,
    sankalpas:(S.sankalpas||[]).map(function(sk){return{wish:sk.wish,target:sk.target,done:sk.current||0,pct:sk.target?Math.round(((sk.current||0)/sk.target)*100):0};}),
    last7:l7,
    mala_log:(S.activityLog||[]).filter(function(e){return e.t==='mala';}).slice(-20).map(function(e){var d=new Date(e.ts);return{n:e.n,mode:e.mode,sec:e.sec,at:d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}),date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};}),
    brahma_log:(S.activityLog||[]).filter(function(e){return e.t==='brahma';}).slice(-15).map(function(e){var d=new Date(e.ts);return{date:e.date,status:e.status,at:d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}),dow:d.toLocaleDateString('en-IN',{weekday:'short'})};}),
    session_log:(S.activityLog||[]).filter(function(e){return e.t==='session';}).slice(-10).map(function(e){var s=new Date(e.ts),en=new Date(e.end);return{mode:e.mode,start:s.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}),end:en.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}),min:Math.round((e.secs||0)/60)};}),
    undo_available:undoStack.map(function(u){return u.desc;}),
    // ── Advanced fields ──
    patterns: patterns,
    forecast: forecast,
    mood: moodInsights
  };
}

// ── Build system prompt ─────────────────────────────────────────
function buildSystemPrompt(ctx) {
  return 'You are Jarvis, the AI assistant for Radha Naam Jap — a spiritual sadhana tracker for a devotee of Radha Rani.\n\n'
    +'PERSONALITY: Greet with "Jai Radhe 🙏" only on the very first message of a session. Be concise, data-driven, warm, spiritually uplifting. Mix data analysis with bhakti encouragement.\n\n'
    +'CAPABILITIES — you can both ANALYSE and EDIT data:\n'
    +'1. Deep analytics: streaks, timing patterns, brahmacharya trends, stotram progress, forecast to goal\n'
    +'2. Edit data via action blocks (see below)\n'
    +'3. Mood logging and correlation with sadhana\n'
    +'4. Ritual detection: identify patterns like "always does more jap on Fridays" or "Brahmacharya always breaks after X"\n'
    +'5. Forecast: predict when lifetime goal will be reached based on 30-day average\n'
    +'6. Spiritual insights: quote scriptures, suggest related mantras, give encouragement aligned with current progress\n'
    +'7. Smart scheduling: suggest optimal jap times based on the user\'s own historical peak hours\n\n'
    +'EDITING — when the user asks to add/set/edit data, respond with:\n'
    +'1. A brief confirmation sentence\n'
    +'2. An action block in this exact format:\n'
    +'```action\n'
    +'{"fn":"addJap","args":[108,"2025-01-15","radha"]}\n'
    +'```\n'
    +'Available action functions:\n'
    +'- addJap(count, date?, mode?) — add jap count. mode: "radha" or "rv"\n'
    +'- setJap(count, date?, mode?) — set exact jap count\n'
    +'- markBrahma(date, status) — status: "b"=broken, "m"=maintained\n'
    +'- addStotram(id, count?) — log stotram recitation\n'
    +'- setDailyTarget(n, mode?) — set daily target\n'
    +'- setLifetimeTarget(n) — set lifetime target\n'
    +'- addMood(score_1_to_10, note?) — log mood entry\n'
    +'- addSankalpa(wish, target) — add new vow/sankalpa\n'
    +'- undo() — undo last action\n'
    +'- undoHistory() — show recent actions\n\n'
    +'ADVANCED CONTEXT:\n'
    +'- patterns.peakHour: user\'s statistically peak jap hour of day\n'
    +'- patterns.peakDow: user\'s peak day of week\n'
    +'- patterns.avgGapHours: average hours between sessions\n'
    +'- forecast.avg30: 30-day rolling average jap/day\n'
    +'- forecast.goalDate: estimated date to reach lifetime target\n'
    +'- mood: recent mood log (if user has logged moods)\n\n'
    +'FORMAT: Use **bold** for numbers and key insights. Use emoji sparingly but meaningfully (🔥 streak, 🌸 devotion, ⏰ timing, 📈 trends, 🎯 targets). Keep replies under 200 words unless the user asks for a detailed report.\n\n'
    +'CURRENT LIVE DATA:\n'+JSON.stringify(ctx);
}

// ── Jarvis object ───────────────────────────────────────────────
var Jarvis = {
  history: [],
  isOpen: false,
  isLoading: false,
  recognition: null,
  isListening: false,
  _firstMsg: true,

  send: function(msg) {
    if(this.isLoading) return;
    this.isLoading=true;
    this.addMsg('user',msg);
    this.showTyping(true);
    this.setBtn(false);
    var ctx = buildCtx();
    var sp = buildSystemPrompt(ctx);
    var messages = this.history.concat([{role:'user',content:msg}]);
    fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:messages,systemPrompt:sp})})
    .then(function(res){return res.json().then(function(d){if(!res.ok)throw new Error(d.error||d.detail||'HTTP '+res.status);return d;});})
    .then(function(data){
      var reply = data.reply||'Jai Radhe 🙏 No response.';
      // Execute action if present
      var am = reply.match(/```action\s*([\s\S]*?)```/);
      var ar = '';
      if(am){
        try{
          var act=JSON.parse(am[1].trim());
          if(JA[act.fn]){ ar='\n\n✅ '+JA[act.fn].apply(null,act.args||[]); reply=reply.replace(/```action[\s\S]*?```/,'').trim(); }
        }catch(e){ ar='\n\n⚠️ Action error: '+e.message; }
      }
      Jarvis.history.push({role:'user',content:msg});
      Jarvis.history.push({role:'assistant',content:reply});
      if(Jarvis.history.length>20) Jarvis.history=Jarvis.history.slice(-20);
      Jarvis.showTyping(false);
      Jarvis.addMsg('ai',reply+ar);
    })
    .catch(function(err){
      Jarvis.showTyping(false);
      Jarvis.addMsg('ai','🙏 Error: '+err.message);
    })
    .finally(function(){Jarvis.isLoading=false;Jarvis.setBtn(true);});
  },

  startVoice: function() {
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){this.addMsg('ai','🙏 Voice not supported on this browser.');return;}
    if(this.isListening){this.stopVoice();return;}
    this.recognition=new SR();
    this.recognition.lang='en-IN';
    this.recognition.continuous=false;
    this.recognition.interimResults=false;
    var self=this;
    this.recognition.onstart=function(){self.isListening=true;var b=document.getElementById('rjai-voice');if(b){b.textContent='🔴';b.style.background='linear-gradient(135deg,#c0392b,#e74c3c)';}};
    this.recognition.onresult=function(e){var t=e.results[0][0].transcript;var inp=document.getElementById('rjai-inp');if(inp)inp.value=t;self.stopVoice();self.submit();};
    this.recognition.onerror=function(){self.stopVoice();};
    this.recognition.onend=function(){self.stopVoice();};
    this.recognition.start();
  },

  stopVoice: function(){
    this.isListening=false;
    if(this.recognition){try{this.recognition.stop();}catch(e){}}
    var b=document.getElementById('rjai-voice');if(b){b.textContent='🎤';b.style.background='linear-gradient(135deg,#1a6b3a,#2ecc71)';}
  },

  addMsg: function(role,text){
    var feed=document.getElementById('rjai-feed');if(!feed)return;
    var wrap=document.createElement('div');wrap.className='rjai-msg rjai-'+role;
    var html=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g,'<code>$1</code>')
      .replace(/\n/g,'<br>');
    var icon='<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    wrap.innerHTML=role==='ai'?'<div class="rjai-av">'+icon+'</div><div class="rjai-bub">'+html+'</div>':'<div class="rjai-bub">'+html+'</div>';
    feed.appendChild(wrap);
    requestAnimationFrame(function(){feed.scrollTop=feed.scrollHeight;});
  },

  showTyping:function(show){var t=document.getElementById('rjai-typing');if(t)t.style.display=show?'flex':'none';if(show)setTimeout(function(){var f=document.getElementById('rjai-feed');if(f)f.scrollTop=f.scrollHeight;},50);},
  setBtn:function(on){var b=document.getElementById('rjai-send');if(b)b.disabled=!on;},

  open:function(){
    if(this.isOpen)return;this.isOpen=true;
    var p=document.getElementById('rjai-panel');
    if(p){p.style.display='flex';requestAnimationFrame(function(){p.classList.add('rjai-open');});}
    if(this.history.length===0){
      var self=this;
      setTimeout(function(){
        var ctx=buildCtx();var tod=ctx.jap.today_total,str=ctx.jap.streak;
        var fc=ctx.forecast;
        var pat=ctx.patterns;
        var greeting = tod>0
          ?'Jai Radhe 🙏 Today: **'+tod.toLocaleString('en-IN')+' jap** ('+ctx.jap.today_malas+' malas) · Streak: **'+str+' days** 🔥'
          :'Jai Radhe 🙏 I am Jarvis — your sadhana AI assistant.';
        var extra = '';
        if(fc && fc.goalDate) extra += '\n🎯 At your current pace, lifetime goal by **'+fc.goalDate+'**';
        if(pat && pat.peakHourLabel) extra += '\n⏰ Your peak practice time: **'+pat.peakHourLabel+'**';
        extra += '\n\nI can analyse, edit data, track mood, forecast your goal, detect patterns — voice 🎤 or type!';
        self.addMsg('ai', greeting+extra);
      },300);
    }
  },

  close:function(){
    this.isOpen=false;this.stopVoice();
    var p=document.getElementById('rjai-panel');if(!p)return;
    p.classList.remove('rjai-open');setTimeout(function(){p.style.display='none';},330);
  },

  handleKey:function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();Jarvis.submit();}},

  submit:function(){
    var inp=document.getElementById('rjai-inp');if(!inp)return;
    var msg=inp.value.trim();if(!msg||this.isLoading)return;
    inp.value='';inp.style.height='auto';this.send(msg);
  },

  QUICK:[
    {l:'📊 Today',        q:'Detailed analysis of today — jap, malas, session timing, how am I doing vs target?'},
    {l:'🔥 Streak',       q:'My streak, consistency %, gaps and best periods.'},
    {l:'⏰ Patterns',     q:'What time of day do I practice most? Day-of-week patterns? Average gap between sessions?'},
    {l:'🛡️ Brahma',      q:'Brahmacharya analysis — exact timing of breaks, day-of-week patterns, correlation with jap count.'},
    {l:'📈 7-Day',        q:'Data science weekly report with trends, improvements, and suggestions.'},
    {l:'🎯 Forecast',     q:'When will I reach my lifetime goal? Show the math based on my 30-day average.'},
    {l:'🌸 Spiritual',    q:'Give me a spiritual insight or quote relevant to my current sadhana progress. Encourage me.'},
    {l:'😊 Log mood',     q:'I want to log my current mood. Help me do that.'},
    {l:'🌺 28 Names',     q:'28 Names practice stats, patterns and suggestions.'},
    {l:'↩️ Undo',         q:'Show my recent actions and undo the last one.'},
  ],

  mount:function(){
    var self=this;
    var css=document.createElement('style');
    css.textContent='#rjai-toggle{display:flex;align-items:center;gap:10px;width:100%;margin:0 0 16px;padding:12px 16px;background:rgba(26,214,117,0.07);border:1px solid rgba(26,214,117,0.25);border-radius:14px;cursor:pointer;font-family:"Inter",sans-serif;-webkit-tap-highlight-color:transparent;}'
    +'#rjai-toggle:active{background:rgba(26,214,117,0.15);}'
    +'.rjai-tgl-ic{width:32px;height:32px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,#1a3a6b,#4B6CB7);display:flex;align-items:center;justify-content:center;}'
    +'.rjai-tgl-txt{flex:1;text-align:left;}'
    +'.rjai-tgl-lbl{font-size:13px;font-weight:700;color:#7eb3ff;letter-spacing:0.3px;}'
    +'.rjai-tgl-sub{font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px;letter-spacing:0.5px;}'
    +'.rjai-tgl-arr{font-size:12px;color:rgba(126,179,255,0.4);}'
    +'#rjai-panel{display:none;position:fixed;inset:0;z-index:9999;flex-direction:column;background:#050A14;transform:translateY(100%);transition:transform 0.32s cubic-bezier(0.32,0.72,0,1);font-family:"Inter",sans-serif;padding-bottom:env(safe-area-inset-bottom,0px);}'
    +'#rjai-panel.rjai-open{transform:translateY(0);}'
    +'.rjai-hdr{display:flex;align-items:center;gap:10px;padding:14px 16px 11px;border-bottom:1px solid rgba(126,179,255,0.15);background:rgba(0,0,0,0.5);flex-shrink:0;padding-top:max(14px,calc(env(safe-area-inset-top,0px) + 14px));}'
    +'.rjai-hdr-ic{width:36px;height:36px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,#1a3a6b,#4B6CB7);display:flex;align-items:center;justify-content:center;}'
    +'.rjai-hdr-info{flex:1;}'
    +'.rjai-hdr-name{font-size:15px;font-weight:700;color:#7eb3ff;}'
    +'.rjai-hdr-desc{font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.8px;margin-top:1px;}'
    +'.rjai-cls{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);border-radius:9px;padding:7px 13px;font-size:13px;cursor:pointer;flex-shrink:0;font-family:"Inter",sans-serif;}'
    +'.rjai-cls:active{background:rgba(255,255,255,0.14);}'
    +'.rjai-quick{display:flex;gap:7px;padding:9px 14px 8px;overflow-x:auto;flex-shrink:0;border-bottom:1px solid rgba(126,179,255,0.08);scrollbar-width:none;-webkit-overflow-scrolling:touch;}'
    +'.rjai-quick::-webkit-scrollbar{display:none;}'
    +'.rjai-qb{flex-shrink:0;white-space:nowrap;padding:6px 13px;border-radius:20px;background:rgba(126,179,255,0.07);border:1px solid rgba(126,179,255,0.2);color:rgba(126,179,255,0.85);font-size:11px;cursor:pointer;font-family:"Inter",sans-serif;-webkit-tap-highlight-color:transparent;}'
    +'.rjai-qb:active{background:rgba(126,179,255,0.18);}'
    +'#rjai-feed{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:13px;-webkit-overflow-scrolling:touch;}'
    +'.rjai-msg{display:flex;gap:8px;align-items:flex-end;}'
    +'.rjai-ai{flex-direction:row;}.rjai-user{flex-direction:row-reverse;}'
    +'.rjai-av{width:28px;height:28px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#1a3a6b,#4B6CB7);display:flex;align-items:center;justify-content:center;}'
    +'.rjai-bub{max-width:84%;padding:10px 13px;border-radius:16px;font-size:13.5px;line-height:1.58;word-break:break-word;}'
    +'.rjai-ai .rjai-bub{background:rgba(255,255,255,0.05);border:1px solid rgba(126,179,255,0.18);color:rgba(255,255,255,0.92);border-bottom-left-radius:4px;}'
    +'.rjai-user .rjai-bub{background:rgba(126,179,255,0.1);border:1px solid rgba(126,179,255,0.28);color:#d4e8ff;border-bottom-right-radius:4px;}'
    +'.rjai-bub strong{color:#7eb3ff;font-weight:600;}'
    +'.rjai-bub code{background:rgba(0,0,0,0.4);padding:1px 5px;border-radius:4px;font-size:11.5px;font-family:monospace;color:#a0c4ff;}'
    +'#rjai-typing{display:none;align-items:flex-end;gap:8px;padding:2px 14px 4px;flex-shrink:0;}'
    +'.rjai-tbub{background:rgba(255,255,255,0.05);border:1px solid rgba(126,179,255,0.18);border-radius:16px;border-bottom-left-radius:4px;padding:10px 15px;display:flex;gap:5px;align-items:center;}'
    +'.rjai-dot{width:6px;height:6px;border-radius:50%;background:rgba(126,179,255,0.6);animation:rjai-b 1.3s infinite ease-in-out;}'
    +'.rjai-dot:nth-child(2){animation-delay:0.18s;}.rjai-dot:nth-child(3){animation-delay:0.36s;}'
    +'@keyframes rjai-b{0%,60%,100%{transform:translateY(0);opacity:0.4;}30%{transform:translateY(-5px);opacity:1;}}'
    +'.rjai-inp-row{display:flex;gap:8px;padding:9px 14px 12px;border-top:1px solid rgba(126,179,255,0.1);background:rgba(0,0,0,0.35);flex-shrink:0;align-items:flex-end;}'
    +'#rjai-inp{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(126,179,255,0.22);border-radius:20px;padding:10px 14px;color:#fff;font-size:14px;font-family:"Inter",sans-serif;outline:none;resize:none;min-height:40px;max-height:96px;line-height:1.45;-webkit-appearance:none;}'
    +'#rjai-inp::placeholder{color:rgba(255,255,255,0.28);}#rjai-inp:focus{border-color:rgba(126,179,255,0.5);}'
    +'#rjai-send{width:42px;height:42px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#1a3a6b,#4B6CB7);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;-webkit-tap-highlight-color:transparent;}'
    +'#rjai-send:active{transform:scale(0.88);}#rjai-send:disabled{opacity:0.35;}'
    +'#rjai-voice{width:42px;height:42px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#1a3a6b,#2980b9);border:none;cursor:pointer;font-size:18px;-webkit-tap-highlight-color:transparent;}'
    +'#rjai-voice:active{transform:scale(0.88);}';
    document.head.appendChild(css);

    var icon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var icSm='<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var vs=document.getElementById('vs');
    if(vs){
      var btn=document.createElement('button');btn.id='rjai-toggle';
      btn.innerHTML='<div class="rjai-tgl-ic">'+icon+'</div><div class="rjai-tgl-txt"><div class="rjai-tgl-lbl">Jarvis — AI Assistant</div><div class="rjai-tgl-sub">Claude AI · Voice + Chat · Analytics + Edit + Forecast</div></div><span class="rjai-tgl-arr">▶</span>';
      btn.onclick=function(){Jarvis.open();};
      vs.insertBefore(btn,vs.firstChild);
    }

    var panel=document.createElement('div');panel.id='rjai-panel';
    panel.innerHTML='<div class="rjai-hdr"><div class="rjai-hdr-ic">'+icon+'</div><div class="rjai-hdr-info"><div class="rjai-hdr-name">Jarvis</div><div class="rjai-hdr-desc">Sadhana AI · Claude Intelligence</div></div><button class="rjai-cls" onclick="Jarvis.close()">✕ Close</button></div>'
      +'<div class="rjai-quick" id="rjai-quick"></div>'
      +'<div id="rjai-feed"></div>'
      +'<div id="rjai-typing"><div class="rjai-av">'+icSm+'</div><div class="rjai-tbub"><div class="rjai-dot"></div><div class="rjai-dot"></div><div class="rjai-dot"></div></div></div>'
      +'<div class="rjai-inp-row"><textarea id="rjai-inp" placeholder="Ask Jarvis… e.g. add 108 jap today · log mood 8 · when do I hit my goal? (Enter)" rows="1" onkeydown="Jarvis.handleKey(event)" oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,96)+\'px\'"></textarea><button id="rjai-voice" onclick="Jarvis.startVoice()" title="Voice input">🎤</button><button id="rjai-send" onclick="Jarvis.submit()">➤</button></div>';
    document.body.appendChild(panel);

    var qc=document.getElementById('rjai-quick');
    this.QUICK.forEach(function(q){
      var b=document.createElement('button');b.className='rjai-qb';b.textContent=q.l;
      b.onclick=function(){if(!Jarvis.isOpen)Jarvis.open();setTimeout(function(){Jarvis.send(q.q);},Jarvis.history.length===0?600:100);};
      qc.appendChild(b);
    });
  }
};

window.Jarvis = Jarvis;

// ── Boot ────────────────────────────────────────────────────────
waitReady(function() {
  function tryMount() {
    if(document.getElementById('rjai-toggle')) return;
    var vs = document.getElementById('vs');
    if(vs) { Jarvis.mount(); return; }
    setTimeout(tryMount, 400);
  }
  setTimeout(tryMount, 600);
  document.addEventListener('click', function() {
    setTimeout(function() {
      if(!document.getElementById('rjai-toggle') && document.getElementById('vs')) {
        Jarvis.mount();
      }
    }, 200);
  }, true);
});

})();
