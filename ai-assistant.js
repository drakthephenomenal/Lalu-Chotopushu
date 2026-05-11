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


// ═══════════════════════════════════════════════════════════════
// LOCAL INTELLIGENCE ENGINE — precise, data-direct, no API needed
// Returns string answer or null (→ falls to Claude for edit/spiritual)
// ═══════════════════════════════════════════════════════════════

// ── Brahmacharya helpers (mirrors app.js logic exactly) ─────────
function getBcStart() { return App.S.brahmacharya_start_date || '2026-01-01'; }

function calcBcStreaks() {
  var S = App.S;
  var startD = new Date(getBcStart()); startD.setHours(0,0,0,0);
  var todayD = new Date(); todayD.setHours(0,0,0,0);
  var todayK = todayD.toISOString().split('T')[0];
  var totalDays = Math.max(0, Math.round((todayD - startD) / 86400000) + 1);
  var broken = Object.values(S.brahma||{}).filter(function(e){ return e && e.status === 'b'; }).length;
  var maintained = totalDays - broken;
  var successPct = totalDays > 0 ? Math.round(maintained / totalDays * 100) : 0;

  // Current streak — if today is broken, streak = 0
  var todayBroken = S.brahma[todayK] && S.brahma[todayK].status === 'b';
  var cs = 0;
  if (!todayBroken) {
    var d = new Date(); d.setHours(0,0,0,0);
    while (cs < 9999) {
      var k = d.toISOString().split('T')[0];
      if (k < getBcStart()) break;
      var en = S.brahma[k];
      if (!en || en.status !== 'b') { cs++; d.setDate(d.getDate()-1); } else break;
    }
  }

  // Best streak ever
  var allDays = [], cur = new Date(getBcStart()); cur.setHours(0,0,0,0);
  while (cur <= todayD) { allDays.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1); }
  var bs = 0, run = 0;
  allDays.forEach(function(k) {
    var en = S.brahma[k];
    if (!en || en.status !== 'b') { run++; if(run > bs) bs = run; } else run = 0;
  });

  // All streaks with start/end dates
  var streaks = [], runStart = null, runEnd = null, runLen = 0;
  allDays.forEach(function(k) {
    var en = S.brahma[k];
    if (!en || en.status !== 'b') {
      if (!runStart) runStart = k;
      runEnd = k; runLen++;
    } else {
      if (runLen > 0) streaks.push({ start: runStart, end: runEnd, len: runLen });
      runStart = null; runEnd = null; runLen = 0;
    }
  });
  if (runLen > 0) streaks.push({ start: runStart, end: runEnd, len: runLen });

  // Break events with exact timestamp from activityLog
  var breakLog = (S.activityLog||[]).filter(function(e){ return e.t === 'brahma' && e.status === 'b'; });

  return {
    current: cs,
    best: bs,
    total: totalDays,
    maintained: maintained,
    broken: broken,
    pct: successPct,
    streaks: streaks,
    allDays: allDays,
    todayBroken: todayBroken,
    breakLog: breakLog
  };
}

// ── Lunar tithi graph ─────────────────────────────────────────────
function renderLunarGraph() {
  var S = App.S;
  var TITHI = [
    'Prati-\npada','Dwitiya','Tritiya','Chaturthi','Panchami',
    'Shashthi','Saptami','Ashtami','Navami','Dashami',
    'Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima /\nAmavasya'
  ];
  var TITHI_SHORT = [
    'P1','D2','T3','C4','P5','S6','S7','A8','N9','D10','E11','D12','T13','C14','P/A'
  ];

  // Build last 30 days
  var today = new Date(); today.setHours(0,0,0,0);
  var todayK = today.toISOString().split('T')[0];
  var days = [];
  for (var i = 29; i >= 0; i--) {
    var d = new Date(today); d.setDate(d.getDate() - i);
    var k = d.toISOString().split('T')[0];
    var en = S.brahma[k];
    var isBcActive = k >= getBcStart() && k <= todayK;
    days.push({
      date: k,
      day: d.getDate(),
      month: d.getMonth(),
      broken: isBcActive && en && en.status === 'b',
      maintained: isBcActive && (!en || en.status !== 'b'),
      active: isBcActive,
      isToday: k === todayK
    });
  }

  // Build 15-bucket tithi groups (2 days per tithi ≈ 30 day lunar month)
  var buckets = [];
  for (var t = 0; t < 15; t++) {
    var d1 = days[t * 2] || null;
    var d2 = days[t * 2 + 1] || null;
    var anyBroken = (d1 && d1.broken) || (d2 && d2.broken);
    var anyMaint  = (d1 && d1.maintained) || (d2 && d2.maintained);
    var anyToday  = (d1 && d1.isToday) || (d2 && d2.isToday);
    var labels = [d1 ? d1.day : '', d2 ? d2.day : ''].filter(Boolean).join('/');
    buckets.push({ tithi: t, label: labels, broken: anyBroken, maintained: anyMaint, today: anyToday, d1: d1, d2: d2 });
  }

  var html = '<div style="font-family:Inter,sans-serif;padding:2px 0;overflow-x:auto;">';
  html += '<div style="font-size:12px;font-weight:700;color:#FFD700;margin-bottom:10px;letter-spacing:0.5px;">🌙 Brahmacharya — Lunar Month</div>';

  // Bar chart with tithi labels
  html += '<div style="display:flex;gap:3px;align-items:flex-end;height:80px;margin-bottom:4px;">';
  buckets.forEach(function(b) {
    var bg, border;
    if (!b.maintained && !b.broken) {
      bg = 'rgba(255,255,255,0.06)'; border = '1px solid rgba(255,255,255,0.1)';
    } else if (b.broken && b.maintained) {
      bg = 'linear-gradient(to top,rgba(231,76,60,0.5),rgba(46,204,113,0.3))'; border = '1px solid rgba(255,165,0,0.5)';
    } else if (b.broken) {
      bg = 'rgba(231,76,60,0.4)'; border = '1px solid rgba(231,76,60,0.7)';
    } else {
      bg = 'rgba(46,204,113,0.3)'; border = '1px solid rgba(46,204,113,0.55)';
    }
    if (b.today) border = '2px solid #FFD700';
    var symbol = b.broken ? '✗' : (b.maintained ? '✓' : '');
    var symColor = b.broken ? '#e74c3c' : '#2ecc71';
    html += '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;">';
    html += '<div style="color:'+symColor+';font-size:8px;font-weight:700;">'+symbol+'</div>';
    html += '<div style="width:100%;height:52px;background:'+bg+';border:'+border+';border-radius:5px 5px 3px 3px;display:flex;align-items:center;justify-content:center;">';
    html += '<span style="font-size:8px;color:rgba(255,255,255,'+(b.today?'1':'0.45')+');font-weight:'+(b.today?'700':'400')+';">'+b.label+'</span>';
    html += '</div></div>';
  });
  html += '</div>';

  // Tithi labels on X-axis
  html += '<div style="display:flex;gap:3px;margin-bottom:8px;">';
  TITHI_SHORT.forEach(function(t, i) {
    var isSpecial = i === 7 || i === 10 || i === 14; // Ashtami, Ekadashi, Purnima
    html += '<div style="flex:1;min-width:0;text-align:center;font-size:7px;color:'+(isSpecial?'#FFD700':'rgba(255,255,255,0.35)')+';font-weight:'+(isSpecial?'700':'400')+';overflow:hidden;">'+t+'</div>';
  });
  html += '</div>';

  // Full tithi names row (scrollable hint)
  html += '<div style="font-size:8px;color:rgba(255,255,255,0.25);margin-bottom:8px;line-height:1.5;">';
  html += 'E11=Ekadashi 🌟 · A8=Ashtami · P/A=Purnima/Amavasya';
  html += '</div>';

  // Legend + stats
  var bcS = calcBcStreaks();
  html += '<div style="display:flex;gap:10px;font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:6px;">'
    + '<span><span style="color:#2ecc71;">✓</span> Maintained</span>'
    + '<span><span style="color:#e74c3c;">✗</span> Broken</span>'
    + '<span style="color:#FFD700;">■</span> Today'
    + '</div>';
  html += '<div style="font-size:11px;line-height:1.8;color:rgba(255,255,255,0.82);">'
    + '⚡ Current: <strong style="color:' + (bcS.todayBroken?'#e74c3c':'#2ecc71') + ';">'
    + (bcS.todayBroken ? '0 days (broken today)' : bcS.current+' days') + '</strong>'
    + ' &nbsp;🏆 Best: <strong style="color:#FFD700;">'+bcS.best+' days</strong><br>'
    + '✅ <strong>'+bcS.maintained+'</strong> maintained &nbsp;'
    + '❌ <strong style="color:#e74c3c;">'+bcS.broken+'</strong> broken &nbsp;'
    + '📊 <strong style="color:#2ecc71;">'+bcS.pct+'%</strong> success'
    + '</div>';
  html += '</div>';
  return { html: html, stats: bcS };
}

function offlineAnswer(msg, ctx) {
  var q = msg.toLowerCase().trim();
  var S = App.S;
  var j = ctx.jap;
  var fc = ctx.forecast;
  var pat = ctx.patterns;
  var ms = j.ms || 108;

  function bold(v) { return '**' + v + '**'; }
  function num(n) { return (n||0).toLocaleString('en-IN'); }
  function fmtSec(sec) {
    if (!sec) return '—';
    var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    return h > 0 ? h+'h '+m+'m' : m+'m '+s+'s';
  }

  // ── BRAHMACHARYA (lunar graph + precise stats) ──────────────
  if (/brahma|brahmach|celibacy|\bbc\b|lunar|streak.*break|break.*streak/.test(q)) {
    var g = renderLunarGraph();
    var st = g.stats;

    // Last break with exact time from activityLog
    var lastBreakStr = '—';
    if (st.breakLog && st.breakLog.length > 0) {
      var lb = st.breakLog[st.breakLog.length - 1];
      var lbDate = new Date(lb.ts);
      lastBreakStr = lb.date + ' at ' + lbDate.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', hour12:true});
    }

    // Recent streaks (last 3)
    var recentStreakLines = st.streaks.slice(-3).reverse().map(function(s, i) {
      var label = i === 0 && !st.todayBroken ? '⚡ Current' : ('  #'+(i+1));
      return label + ': ' + bold(s.len + ' days') + ' (' + s.start + ' → ' + (s.end||'today') + ')';
    });

    var currentLabel = st.todayBroken
      ? '⚡ Current streak: ' + bold('0') + ' (broken today ❌)'
      : '⚡ Current streak: ' + bold(st.current + ' days');

    var textPart = '🛡️ **Brahmacharya**\n'
      + '📅 Started: ' + bold(getBcStart()) + '\n'
      + currentLabel + '\n'
      + '🏆 Best streak: ' + bold(st.best + ' days') + '\n'
      + '⏰ Last break: ' + bold(lastBreakStr) + '\n'
      + '✅ Maintained: ' + bold(st.maintained + ' / ' + st.total + ' days') + '\n'
      + '❌ Broken: ' + bold(st.broken + ' times') + '\n'
      + '📊 Success rate: ' + bold(st.pct + '%') + '\n\n'
      + (recentStreakLines.length > 0 ? '**Recent streaks:**\n' + recentStreakLines.join('\n') : '');
    return { text: textPart, html: g.html };
  }

  // ── TODAY ───────────────────────────────────────────────────
  if (/\b(today|aaj|abhi)\b/.test(q) && !/add|set|log|edit|mark|undo/.test(q)) {
    var todR = j.today_r, todRV = j.today_rv, tot = j.today_total;
    var malas = Math.floor(tot / ms);
    var timeSec = j.today_sec;
    var avgMalaSec = malas > 0 && timeSec > 0 ? Math.round(timeSec / malas) : 0;
    var lines = [
      '📊 **Today — ' + ctx.today + '**',
      '🌸 Radha Naam: ' + bold(num(todR)) + ' (' + Math.floor(todR/ms) + ' malas)',
      todRV > 0 ? '💙 RV Naam: ' + bold(num(todRV)) + ' (' + Math.floor(todRV/ms) + ' malas)' : null,
      '🔢 Total: ' + bold(num(tot)) + ' jap · ' + bold(malas) + ' malas',
      timeSec > 0 ? '⏱ Time: ' + bold(fmtSec(timeSec)) + (avgMalaSec > 0 ? ' · ' + bold(fmtSec(avgMalaSec)) + '/mala avg' : '') : null,
      j.dt > 0 ? '🎯 Target: ' + bold(num(j.dt)) + (tot >= j.dt ? ' ✅ Done!' : ' · ' + bold(num(j.dt - tot)) + ' remaining') : null,
      '🔥 Streak: ' + bold(j.streak + ' days'),
    ].filter(Boolean);
    return lines.join('\n');
  }

  // ── JAP STREAK ──────────────────────────────────────────────
  if (/streak|longest|best period|continuous|consistent/.test(q) && !/brahma|bc/.test(q)) {
    var hist = S.history||{}, histRV = S.historyRV||{};
    var allK = Array.from(new Set(Object.keys(hist).concat(Object.keys(histRV)))).sort();
    // Longest jap streak
    var maxS = 0, curS2 = 0, prevK = null;
    allK.forEach(function(k) {
      if ((hist[k]||0)+(histRV[k]||0) > 0) {
        if (prevK && (new Date(k)-new Date(prevK))/86400000 === 1) curS2++; else curS2 = 1;
        if (curS2 > maxS) maxS = curS2;
        prevK = k;
      } else { prevK = null; curS2 = 0; }
    });
    var last30 = [], d30 = new Date();
    for (var i=0;i<30;i++) { var dd=new Date(d30);dd.setDate(dd.getDate()-i);last30.push(dd.toISOString().split('T')[0]); }
    var active30 = last30.filter(function(k){return (hist[k]||0)+(histRV[k]||0)>0;}).length;
    return [
      '🔥 **Jap Streak**',
      '⚡ Current: ' + bold(j.streak + ' days'),
      '🏆 Best ever: ' + bold(maxS + ' days'),
      '📅 Last 30 days: ' + bold(active30 + '/30') + ' active (' + bold(Math.round(active30/30*100)+'%') + ')',
      j.best ? '🌟 Best day: ' + bold(num(j.best.count)) + ' on ' + j.best.date : null,
      fc ? '📊 30-day avg: ' + bold(num(fc.avg30)) + ' jap/day' : null,
    ].filter(Boolean).join('\n');
  }

  // ── MALA STATS ──────────────────────────────────────────────
  if (/mala|bead|session stat|duration|how long.*mala|mala.*time/.test(q)) {
    var malaLog = (S.activityLog||[]).filter(function(e){ return e.t==='mala'; });
    if (!malaLog.length) return 'Jai Radhe 🙏 No mala sessions logged yet. Use the timer during jap to record sessions!';
    var recent = malaLog.slice(-20);
    var totalSec2 = recent.reduce(function(a,e){ return a+(e.sec||0); }, 0);
    var totalMalas2 = recent.reduce(function(a,e){ return a+(e.n||0); }, 0);
    var avgSec = totalMalas2 > 0 ? Math.round(totalSec2/totalMalas2) : 0;
    var fastest = recent.reduce(function(a,e){ return (e.sec&&e.n&&(e.sec/e.n)<(a.sec/a.n||9999)) ? e : a; }, recent[0]);
    var lines = [
      '📿 **Mala Session Stats** (last ' + recent.length + ' sessions)',
      '⏱ Avg per mala: ' + bold(fmtSec(avgSec)),
      fastest ? '⚡ Fastest mala: ' + bold(fmtSec(Math.round((fastest.sec||0)/(fastest.n||1)))) : null,
      '📊 Total sessions: ' + bold(malaLog.length),
    ];
    // Last 5 sessions
    lines.push('\n**Last 5 sessions:**');
    malaLog.slice(-5).reverse().forEach(function(e) {
      var d = new Date(e.ts);
      var dateStr = d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
      var timeStr2 = d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
      var perMala = e.n && e.sec ? fmtSec(Math.round(e.sec/e.n)) : '—';
      lines.push('• '+dateStr+' '+timeStr2+' · '+bold(e.n||0)+' malas · '+bold(fmtSec(e.sec||0))+' total · '+perMala+'/mala');
    });
    return lines.filter(Boolean).join('\n');
  }

  // ── THIS WEEK ────────────────────────────────────────────────
  if (/\b(week|7.day|this week|last 7)\b/.test(q)) {
    var l7 = ctx.last7 || [];
    var total7=0, days7=0, malas7=0;
    var rows = l7.map(function(d) {
      var t = d.r+d.rv; total7+=t; if(t>0)days7++; malas7+=Math.floor(t/ms);
      var bar = t>0 ? '▓'.repeat(Math.min(8,Math.max(1,Math.ceil(t/(j.dt||108)*4)))) : '░';
      return d.date.slice(5)+' '+bar+' '+bold(num(t))+(d.sec>0?' ('+fmtSec(d.sec)+')':'');
    });
    return ['📈 **This Week**'].concat(rows).concat([
      '',
      '📊 Total: ' + bold(num(total7)) + ' · ' + bold(malas7) + ' malas',
      '📅 Active: ' + bold(days7+'/7 days'),
      '📈 Daily avg: ' + bold(num(Math.round(total7/7))),
      fc ? '📊 vs 30-day avg: ' + bold(num(fc.avg30)) + '/day' : null,
    ].filter(Boolean)).join('\n');
  }

  // ── THIS MONTH ───────────────────────────────────────────────
  if (/\b(month|this month|monthly|mahina)\b/.test(q)) {
    var hist2 = S.history||{}, histRV2 = S.historyRV||{};
    var now = new Date(), ym = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    var monthKeys = Object.keys(hist2).concat(Object.keys(histRV2)).filter(function(k){ return k.startsWith(ym); });
    monthKeys = Array.from(new Set(monthKeys)).sort();
    var mTotal=0, mActive=0, mMalas=0;
    monthKeys.forEach(function(k) { var v=(hist2[k]||0)+(histRV2[k]||0); mTotal+=v; if(v>0)mActive++; mMalas+=Math.floor(v/ms); });
    var daysInMonth = new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    var dayOfMonth = now.getDate();
    return [
      '📅 **This Month (' + ym + ')**',
      '🔢 Total: ' + bold(num(mTotal)) + ' jap · ' + bold(mMalas) + ' malas',
      '📅 Active: ' + bold(mActive+'/'+dayOfMonth+' days'),
      '📊 Daily avg: ' + bold(num(Math.round(mTotal/Math.max(1,dayOfMonth)))),
      '📈 On track for: ' + bold(num(Math.round(mTotal/dayOfMonth*daysInMonth))) + ' this month',
    ].join('\n');
  }

  // ── THIS YEAR ────────────────────────────────────────────────
  if (/\b(year|this year|yearly|annual|sal)\b/.test(q)) {
    var hist3 = S.history||{}, histRV3 = S.historyRV||{};
    var yr = new Date().getFullYear()+'';
    var yKeys = Array.from(new Set(Object.keys(hist3).concat(Object.keys(histRV3)))).filter(function(k){return k.startsWith(yr);});
    var yTotal=0, yActive=0;
    yKeys.forEach(function(k){ var v=(hist3[k]||0)+(histRV3[k]||0); yTotal+=v; if(v>0)yActive++; });
    var dayOfYear = Math.floor((new Date()-new Date(yr+'-01-01'))/86400000)+1;
    return [
      '📆 **This Year (' + yr + ')**',
      '🔢 Total: ' + bold(num(yTotal)) + ' jap · ' + bold(Math.floor(yTotal/ms)) + ' malas',
      '📅 Active: ' + bold(yActive+'/'+dayOfYear+' days'),
      '📊 Daily avg: ' + bold(num(Math.round(yTotal/Math.max(1,dayOfYear)))),
      '📈 Projected year total: ' + bold(num(Math.round(yTotal/dayOfYear*365))),
    ].join('\n');
  }

  // ── PEAK PERIOD ──────────────────────────────────────────────
  if (/peak|best time|best day|prime|most jap|highest/.test(q)) {
    var hist4 = S.history||{}, histRV4 = S.historyRV||{};
    // Best week
    var weekTotals = {};
    Object.keys(hist4).concat(Object.keys(histRV4)).forEach(function(k) {
      var d = new Date(k), wk = d.getFullYear()+'-W'+String(Math.ceil((d.getDate()-d.getDay()+10)/7)).padStart(2,'0');
      weekTotals[wk] = (weekTotals[wk]||0) + ((hist4[k]||0)+(histRV4[k]||0));
    });
    var bestWeek = Object.entries(weekTotals).sort(function(a,b){return b[1]-a[1];})[0];
    // Best month
    var monthTotals = {};
    Object.keys(hist4).concat(Object.keys(histRV4)).forEach(function(k) {
      var mo = k.slice(0,7);
      monthTotals[mo] = (monthTotals[mo]||0) + ((hist4[k]||0)+(histRV4[k]||0));
    });
    var bestMonth = Object.entries(monthTotals).sort(function(a,b){return b[1]-a[1];})[0];
    return [
      '🌟 **Peak Periods**',
      j.best ? '📅 Best day: ' + bold(num(j.best.count)) + ' jap on ' + j.best.date : null,
      bestWeek ? '📆 Best week: ' + bold(num(bestWeek[1])) + ' (' + bestWeek[0] + ')' : null,
      bestMonth ? '🗓 Best month: ' + bold(num(bestMonth[1])) + ' (' + bestMonth[0] + ')' : null,
      pat && pat.peakHourLabel ? '⏰ Peak hour: ' + bold(pat.peakHourLabel) : null,
      pat && pat.peakDow ? '📆 Peak day of week: ' + bold(pat.peakDow) : null,
    ].filter(Boolean).join('\n');
  }

  // ── LIFETIME / ALL TIME ──────────────────────────────────────
  if (/lifetime|total|overall|all time|ever|life/.test(q) && !/target|goal|forecast/.test(q)) {
    var hrs = parseFloat(j.life_hrs);
    return [
      '📿 **Lifetime Stats**',
      '🌸 Radha Naam: ' + bold(num(j.life_r)),
      j.life_rv > 0 ? '💙 Radha Vallabh: ' + bold(num(j.life_rv)) : null,
      '🔢 Total: ' + bold(num(j.life_total)) + ' (' + bold(Math.floor(j.life_total/ms)) + ' malas)',
      '⏱ Total time: ' + bold(hrs.toFixed(1) + ' hours'),
      '📅 Active days: ' + bold(j.active_days),
      '📊 Daily average: ' + bold(num(j.avg)) + ' jap/day',
      '🔥 Current streak: ' + bold(j.streak + ' days'),
      j.best ? '🌟 Best day: ' + bold(num(j.best.count)) + ' on ' + j.best.date : null,
    ].filter(Boolean).join('\n');
  }

  // ── FORECAST ─────────────────────────────────────────────────
  if (/forecast|goal|when.*reach|lifetime.*target|how long|days left/.test(q)) {
    if (!fc) return 'Jai Radhe 🙏 Set a lifetime target in Settings first, then I can forecast!';
    return [
      '🎯 **Goal Forecast**',
      '📿 Done: ' + bold(num(j.life_total)) + ' / ' + bold(num(j.lt)),
      fc.remaining !== null ? '⏳ Remaining: ' + bold(num(fc.remaining)) : null,
      '📊 30-day avg: ' + bold(num(fc.avg30)) + '/day',
      '📅 Consistency: ' + bold(fc.consistency),
      fc.goalDate ? '🎉 Goal date: ' + bold(fc.goalDate) + ' (' + bold(fc.daysToGoal + ' days away') + ')' : '⚠️ Set a target to forecast.',
    ].filter(Boolean).join('\n');
  }

  // ── STOTRAMS ─────────────────────────────────────────────────
  if (/stotram|stotra|path|paath|hit chaurasi|chaurasi/.test(q)) {
    var st2 = ctx.stotrams || {};
    var stK = Object.keys(st2);
    if (!stK.length) return 'Jai Radhe 🙏 No stotrams logged yet!';
    var lines2 = ['📖 **Stotrams**'];
    stK.forEach(function(id) { lines2.push('• ' + bold(id) + ': Today ' + bold(st2[id].today) + ' · Total ' + bold(num(st2[id].total))); });
    return lines2.join('\n');
  }

  // ── 28 NAMES ─────────────────────────────────────────────────
  if (/28 name|28naam|ashtottara/.test(q)) {
    var n28 = ctx.n28||{};
    return '🌸 **28 Names**\n📅 Today: ' + bold(n28.today||0) + ' cycles\n🏆 All time: ' + bold(num(n28.life||0)) + ' cycles';
  }

  // ── PATTERNS ─────────────────────────────────────────────────
  if (/pattern|timing|peak hour|best time|day of week|when do i practice/.test(q)) {
    if (!pat || !pat.peakHour) return 'Jai Radhe 🙏 No session data yet. Use the timer during jap to detect patterns!';
    return [
      '⏰ **Practice Patterns**',
      '🕐 Peak hour: ' + bold(pat.peakHourLabel),
      '📆 Best day: ' + bold(pat.peakDow),
      pat.avgGapHours ? '⏱ Avg gap between sessions: ' + bold(pat.avgGapHours + ' hours') : null,
      '📊 Distribution: ' + pat.dowDistribution,
    ].filter(Boolean).join('\n');
  }

  // ── UNDO ─────────────────────────────────────────────────────
  if (/^undo$|recent action|undo history/.test(q)) { return JA.undoHistory(); }

  // ── GREET ────────────────────────────────────────────────────
  if (/^(hi|hello|hey|jai radhe|radhe|namaste|pranam)/.test(q)) {
    var tod2 = j.today_total;
    return 'Jai Radhe 🙏\n\n'
      + (tod2 > 0 ? 'Today: ' + bold(num(tod2)) + ' jap · ' + Math.floor(tod2/ms) + ' malas · Streak: ' + bold(j.streak + ' days 🔥') : 'No jap yet today. Start your sadhana 🌸')
      + '\n\nAsk: today · week · month · year · streak · brahmacharya · mala stats · peak · forecast · stotrams';
  }

  // ── HELP ─────────────────────────────────────────────────────
  if (/\b(help|what can|commands|capabilities)\b/.test(q)) {
    return '🙏 **Ask me:**\n'
      + '📊 today · week · month · year\n'
      + '🔥 streak · peak period · patterns\n'
      + '🛡️ brahmacharya (lunar graph!)\n'
      + '📿 mala stats · session duration\n'
      + '🎯 forecast · lifetime total\n'
      + '📖 stotrams · 28 names\n'
      + '✏️ "add 108 jap" · "mark brahma broken" · undo';
  }

  // ── No offline match → Claude API ────────────────────────────
  return null;
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

    // ── Try offline first ──────────────────────────────────────
    var offlineReply = offlineAnswer(msg, ctx);
    if (offlineReply !== null) {
      var self = this;
      setTimeout(function() {
        var replyText = typeof offlineReply === 'object' ? offlineReply.text : offlineReply;
        var replyHtml = typeof offlineReply === 'object' ? offlineReply.html : null;
        self.history.push({role:'user',content:msg});
        self.history.push({role:'assistant',content:replyText});
        if(self.history.length>20) self.history=self.history.slice(-20);
        self.showTyping(false);
        self.addMsg('ai', replyText, replyHtml);
        self.isLoading=false; self.setBtn(true);
      }, 250);
      return;
    }

    // ── Fall back to Claude API for complex/edit/spiritual queries ──
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

  addMsg: function(role, text, extraHtml){
    var feed=document.getElementById('rjai-feed');if(!feed)return;
    var wrap=document.createElement('div');wrap.className='rjai-msg rjai-'+role;
    var html=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g,'<code>$1</code>')
      .replace(/\n/g,'<br>');
    if (extraHtml) html += '<div style="margin-top:10px;">'+extraHtml+'</div>';
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
    {l:'📊 Today',        q:'today'},
    {l:'🛡️ Brahmacharya', q:'brahmacharya lunar graph'},
    {l:'🔥 Streak',       q:'streak'},
    {l:'📿 Mala Stats',   q:'mala session stats duration'},
    {l:'📈 This Week',    q:'this week'},
    {l:'📅 This Month',   q:'this month'},
    {l:'📆 This Year',    q:'this year'},
    {l:'🌟 Peak Period',  q:'peak period best day week month'},
    {l:'🎯 Forecast',     q:'forecast goal'},
    {l:'📖 Stotrams',     q:'stotrams'},
    {l:'↩️ Undo',         q:'undo history'},
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
