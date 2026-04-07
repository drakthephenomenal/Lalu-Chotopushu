// ═══════════════════════════════════════
// Radha Naam Jap — app.js
// ═══════════════════════════════════════

// ═══════════════════════════════════════════════════════
// APP — Single unified state object
// ═══════════════════════════════════════════════════════
const App = {
  // ── State ──
  S: {
    tk: '', ms: 108, dt: 0, lt: 0,
    cfg: { vib: true, sound: true },
    history: {}, h28: {}, stotrams: {}, brahma: {},
    customSt: [], timerHistory: {}, timer28History: {}, sankalpas: [], occasions: {},
    syncBaseline: {}, syncBaseline28: {}, syncBaselineTimer: {}, syncBaselineTimer28: {},
    migrationV2Done: false,
    japMode: 'radha',
    historyRV: {}, timerHistoryRV: {}, dtRV: 0, ltRV: 0, nameJapDeductRV: 0,
    malaLogRV: [],
    syncBaselineRV: {}, syncBaselineTimerRV: {}
  },
  lmcRV: 0,
  lmc: 0, lm28: 0,
  timerRunning: false, timerSeconds: 0, timerInterval: null,
  timerSavedSeconds: 0, autoStopTimeout: null,
  malaWallStart: 0,  // Date.now() at start of current mala (persisted in localStorage)
  fbDebouncePush: null,

  // ── IndexedDB ──
  db: null,

  async initDB() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('RadhaJapDB', 3);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
        if (!db.objectStoreNames.contains('history')) db.createObjectStore('history');
        if (!db.objectStoreNames.contains('h28')) db.createObjectStore('h28');
        if (!db.objectStoreNames.contains('timerHistory')) db.createObjectStore('timerHistory');
        if (!db.objectStoreNames.contains('timer28History')) db.createObjectStore('timer28History');
        if (!db.objectStoreNames.contains('malaLog')) db.createObjectStore('malaLog');
      };
      req.onsuccess = e => { this.db = e.target.result; res(); };
      req.onerror = () => rej(req.error);
    });
  },

  async dbGet(store, key) {
    if (!this.db) return null;
    return new Promise(res => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
  },

  async dbPut(store, key, value) {
    if (!this.db) return;
    return new Promise(res => {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = res;
    });
  },

  async dbGetAll(store) {
    if (!this.db) return {};
    return new Promise(res => {
      const tx = this.db.transaction(store, 'readonly');
      const os = tx.objectStore(store);
      const result = {};
      const req = os.openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) { result[cursor.key] = cursor.value; cursor.continue(); }
        else res(result);
      };
      req.onerror = () => res({});
    });
  },

  async dbClearStore(store) {
    if (!this.db) return;
    return new Promise(res => {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = res;
      tx.onerror = res;
    });
  },

  async save() {
    // Save full state snapshot to IDB so all dates and edits persist locally
    await this.dbPut('state', 'main', {
      ms: this.S.ms, dt: this.S.dt, lt: this.S.lt, nameJapDeduct: this.S.nameJapDeduct||0, malaLog: this.S.malaLog||[], malaLogDate: this.S.tk,
      cfg: this.S.cfg, stotrams: this.S.stotrams, brahma: this.S.brahma,
      customSt: this.S.customSt, sankalpas: this.S.sankalpas, occasions: this.S.occasions,
      history: this.S.history, h28: this.S.h28, timerHistory: this.S.timerHistory, timer28History: this.S.timer28History,
      syncBaseline: this.S.syncBaseline, syncBaseline28: this.S.syncBaseline28,
      syncBaselineTimer: this.S.syncBaselineTimer, syncBaselineTimer28: this.S.syncBaselineTimer28, migrationV2Done: this.S.migrationV2Done,
      japMode: this.S.japMode, historyRV: this.S.historyRV, timerHistoryRV: this.S.timerHistoryRV,
      dtRV: this.S.dtRV, ltRV: this.S.ltRV, nameJapDeductRV: this.S.nameJapDeductRV, malaLogRV: this.S.malaLogRV,
      syncBaselineRV: this.S.syncBaselineRV, syncBaselineTimerRV: this.S.syncBaselineTimerRV,
      brahmacharya_start_date: this.S.brahmacharya_start_date
    });
    // Keep per-day stores updated for compatibility with existing offline data
    const tk = this.S.tk;
    if (this.S.history[tk] !== undefined) await this.dbPut('history', tk, this.S.history[tk]);
    if (this.S.h28[tk] !== undefined) await this.dbPut('h28', tk, this.S.h28[tk]);
    if (this.S.timerHistory[tk] !== undefined) await this.dbPut('timerHistory', tk, this.S.timerHistory[tk]);
    if (this.S.timer28History[tk] !== undefined) await this.dbPut('timer28History', tk, this.S.timer28History[tk]);
    if (this.S.malaLog) await this.dbPut('malaLog', 'today', { date: tk, log: this.S.malaLog });
    try { localStorage.setItem('rjap5', JSON.stringify(this.S)); } catch(e) {}
    if (fbUser && !fbForcedSignout && !this._suspendCloudSync) fbDebouncedPush();
  },

  async load() {
    await this.initDB();
    this.S.tk = this.getTk();

    // Try IndexedDB first
    const main = await this.dbGet('state', 'main');
    if (main) {
      Object.assign(this.S, main);
    } else {
      // Fallback: migrate from localStorage
      try {
        const ls = localStorage.getItem('rjap5');
        if (ls) { const d = JSON.parse(ls); Object.assign(this.S, d); }
      } catch(e) {}
    }

    // Load all count stores from IDB
    this.S.history = await this.dbGetAll('history');
    this.S.h28 = await this.dbGetAll('h28');
    this.S.timerHistory = await this.dbGetAll('timerHistory');
    this.S.timer28History = await this.dbGetAll('timer28History');

    // Merge full snapshots saved in main state so past/future edits also persist locally
    if (main?.history) this.S.history = { ...main.history, ...this.S.history };
    if (main?.h28) this.S.h28 = { ...main.h28, ...this.S.h28 };
    if (main?.timerHistory) this.S.timerHistory = { ...main.timerHistory, ...this.S.timerHistory };
    if (main?.timer28History) this.S.timer28History = { ...main.timer28History, ...this.S.timer28History };

    // Merge localStorage history as fallback for old data
    try {
      const ls = localStorage.getItem('rjap5');
      if (ls) {
        const d = JSON.parse(ls);
        if (d.history) { for (const k in d.history) if (!this.S.history[k]) this.S.history[k] = d.history[k]; }
        if (d.h28) { for (const k in d.h28) if (!this.S.h28[k]) this.S.h28[k] = d.h28[k]; }
        if (d.timerHistory) { for (const k in d.timerHistory) if (!this.S.timerHistory[k]) this.S.timerHistory[k] = d.timerHistory[k]; }
        if (d.timer28History) { for (const k in d.timer28History) if (!this.S.timer28History[k]) this.S.timer28History[k] = d.timer28History[k]; }
      }
    } catch(e) {}

    if (!this.S.history[this.S.tk]) this.S.history[this.S.tk] = 0;
    if (!this.S.h28[this.S.tk]) this.S.h28[this.S.tk] = 0;
    if (!this.S.stotrams) this.S.stotrams = {};
    if (!this.S.brahma) this.S.brahma = {};
    if (!this.S.customSt) this.S.customSt = [];
    if (!this.S.timerHistory) this.S.timerHistory = {};
    if (!this.S.timer28History) this.S.timer28History = {};
    if (!this.S.sankalpas) this.S.sankalpas = [];
    if (!this.S.occasions) this.S.occasions = {};
    if (!this.S.historyRV) this.S.historyRV = {};
    if (!this.S.timerHistoryRV) this.S.timerHistoryRV = {};
    if (!this.S.japMode) this.S.japMode = 'radha';
    if (!this.S.dtRV) this.S.dtRV = 0;
    if (!this.S.ltRV) this.S.ltRV = 0;
    if (!this.S.nameJapDeductRV) this.S.nameJapDeductRV = 0;
    if (!this.S.malaLogRV) this.S.malaLogRV = [];
    // Load malaLogRV — only keep if from today AND today has RV jap
    const todayRVJap = this.S.historyRV[this.S.tk] || 0;
    if (todayRVJap <= 0) {
      this.S.malaLogRV = [];
    }
    if (!this.S.syncBaselineRV) this.S.syncBaselineRV = {};
    if (!this.S.syncBaselineTimerRV) this.S.syncBaselineTimerRV = {};
    if (!this.S.historyRV[this.S.tk]) this.S.historyRV[this.S.tk] = 0;
    if (!this.S.timerHistoryRV[this.S.tk]) this.S.timerHistoryRV[this.S.tk] = 0;
    // Load malaLog — only use if it's from today AND today has actual jap count
    const malaLogRec = await this.dbGet('malaLog', 'today');
    const todayJap = this.S.history[this.S.tk] || 0;
    if (malaLogRec && malaLogRec.date === this.S.tk && todayJap > 0) {
      this.S.malaLog = malaLogRec.log || [];
    } else {
      // New day or no jap done today — discard any previous log entirely
      this.S.malaLog = [];
      await this.dbPut('malaLog', 'today', { date: this.S.tk, log: [] });
      // Force push empty log to Firebase so stale cloud data is overwritten
      setTimeout(() => { if (fbUser && !fbForcedSignout) fbDebouncedPush(); }, 3000);
    }
    STLIST.forEach(x => { if (!this.S.stotrams[x.id]) this.S.stotrams[x.id] = {}; });
  },

  getTk() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  },

  gTod() {
    if (this.S.japMode === 'rv') return this.S.historyRV[this.S.tk] || 0;
    return this.S.history[this.S.tk] || 0;
  },
  // Combined today: radha + RV
  gTodCombined() {
    return (this.S.history[this.S.tk] || 0) + (this.S.historyRV[this.S.tk] || 0);
  },
  gTot() {
    // COMBINED lifetime total from BOTH jap types
    const radhaTotal = Math.max(0, Object.values(this.S.history).reduce((a,b) => a+b, 0) - (this.S.nameJapDeduct || 0));
    const rvTotal = Math.max(0, Object.values(this.S.historyRV).reduce((a,b) => a+b, 0) - (this.S.nameJapDeductRV || 0));
    return radhaTotal + rvTotal;
  },
  // Mode-specific total (for daily bar only)
  gTotMode() {
    if (this.S.japMode === 'rv') return Math.max(0, Object.values(this.S.historyRV).reduce((a,b) => a+b, 0) - (this.S.nameJapDeductRV || 0));
    return Math.max(0, Object.values(this.S.history).reduce((a,b) => a+b, 0) - (this.S.nameJapDeduct || 0));
  },
  getCurHistory() { return this.S.japMode === 'rv' ? this.S.historyRV : this.S.history; },
  getCurTimerHistory() { return this.S.japMode === 'rv' ? this.S.timerHistoryRV : this.S.timerHistory; },
  // Combined history: merge radha + RV counts per day
  getCombinedHistory() {
    const combined = {};
    const h1 = this.S.history || {};
    const h2 = this.S.historyRV || {};
    const allKeys = new Set([...Object.keys(h1), ...Object.keys(h2)]);
    allKeys.forEach(k => { combined[k] = (h1[k]||0) + (h2[k]||0); });
    return combined;
  },
  // Combined timer history: merge radha + RV timer per day
  getCombinedTimerHistory() {
    const combined = {};
    const t1 = this.S.timerHistory || {};
    const t2 = this.S.timerHistoryRV || {};
    const allKeys = new Set([...Object.keys(t1), ...Object.keys(t2)]);
    allKeys.forEach(k => { combined[k] = (t1[k]||0) + (t2[k]||0); });
    return combined;
  },
  getCurDt() { return this.S.japMode === 'rv' ? this.S.dtRV : this.S.dt; },
  getCurLt() { return this.S.lt; },

  // ── Haptic Heartbeat ──
  // 10ms on every tap; triple long pulse (200-80-200-80-300ms) synced with mala complete
  vib(pat) {
    if (!this.S.cfg.vib) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pat); return; } catch(e) {}
    }
    // Visual fallback
    const z = document.getElementById('tz');
    if (z) { z.style.boxShadow = '0 0 22px rgba(109,184,255,0.65)'; setTimeout(() => z.style.boxShadow = '', 80); }
  },

  // ── Timer ──
  fmtTime(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sc = s%60;
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0');
  },

  startTimer() {
    if (this.timerRunning) return;
    this.timerRunning = true;
    document.getElementById('timerDisplay').classList.add('running');
    document.getElementById('timerBtn').textContent = '⏸ Pause';
    document.getElementById('timerBtn').className = 'tbtn pause';
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      document.getElementById('timerDisplay').textContent = this.fmtTime(this.timerSeconds);
      this.updateTimerToday();
    }, 1000);
  },

  pauseTimer() {
    if (!this.timerRunning) return;
    clearInterval(this.timerInterval); this.timerInterval = null;
    this.timerRunning = false;
    document.getElementById('timerDisplay').classList.remove('running');
    document.getElementById('timerBtn').textContent = '▶ Resume';
    document.getElementById('timerBtn').className = 'tbtn start';
    const _th = this.getCurTimerHistory();
    _th[this.S.tk] = (_th[this.S.tk] || 0) + (this.timerSeconds - this.timerSavedSeconds);
    this.timerSavedSeconds = this.timerSeconds;
    this.save(); this.updateTimerToday();
  },

  tapTimer() {
    this.startTimer();
    clearTimeout(this.autoStopTimeout);
    this.autoStopTimeout = setTimeout(() => this.pauseTimer(), 6000);
  },

  toggleTimer() {
    clearTimeout(this.autoStopTimeout);
    if (this.timerRunning) this.pauseTimer(); else this.startTimer();
  },

  resetTimer() {
    clearTimeout(this.autoStopTimeout);
    clearInterval(this.timerInterval); this.timerInterval = null;
    this.timerRunning = false; this.timerSeconds = 0; this.timerSavedSeconds = 0;
    document.getElementById('timerDisplay').textContent = '00:00:00';
    document.getElementById('timerDisplay').classList.remove('running');
    document.getElementById('timerBtn').textContent = '▶ Start';
    document.getElementById('timerBtn').className = 'tbtn start';
    this.updateTimerToday();
  },

  updateTimerToday() {
    const radhaTimeSec = (this.S.timerHistory[this.S.tk] || 0);
    const rvTimeSec = (this.S.timerHistoryRV[this.S.tk] || 0);
    const liveSec = this.timerRunning ? (this.timerSeconds - this.timerSavedSeconds) : 0;
    const combinedSec = radhaTimeSec + rvTimeSec + liveSec;
    document.getElementById('timerToday').textContent = "Today's Jap Time: " + this.fmtTime(combinedSec);
  },

  // ── Main UI Update ──
  ua() {
    const tod = this.gTod(), ms = this.S.ms || 108;
    const tot = this.gTot(); // COMBINED lifetime total
    const curDt = this.getCurDt(), curLt = this.getCurLt(); // shared lifetime target
    const md = Math.floor(tod / ms);
    const beadPos = (tod % ms) || ms;
    document.getElementById('jms').textContent = beadPos;
    const inM = tod % ms, show = Math.min(ms, 12);
    const de = document.getElementById('mdots'); de.innerHTML = '';
    for (let i = 0; i < show; i++) {
      const d = document.createElement('div');
      d.className = 'mdt' + (i < Math.floor(inM * show / ms) ? ' on' : '');
      de.appendChild(d);
    }
    document.getElementById('mtot').textContent = md + ' mala' + (md !== 1 ? 's' : '');
    const dP = curDt > 0 ? Math.min(100, Math.round(tod/curDt*100)) : 0;
    const lP = curLt > 0 ? Math.min(100, Math.round(tot/curLt*100)) : 0;
    // Daily bar (blue) — mode-specific
    document.getElementById('dPct').textContent = dP + '%';
    document.getElementById('dbarFill').style.width = dP + '%';
    document.getElementById('dbarDone').textContent = fmtIN(tod);
    document.getElementById('dbarTarget').textContent = '/ ' + (curDt ? fmtIN(curDt) : '—');
    document.getElementById('dDet').textContent = md + ' malas done';
    // Lifetime bar (gold) — COMBINED total, shared target
    document.getElementById('lPct').textContent = lP + '%';
    document.getElementById('lbarFill').style.width = lP + '%';
    document.getElementById('lbarDone').textContent = fmtIN(tot);
    document.getElementById('lbarTarget').textContent = '/ ' + (curLt ? fmtIN(curLt) : '—');
    document.getElementById('lDet').textContent = Math.floor(tot/ms) + ' malas done';
    this.updateTimerToday();
    uStats();
  },

  // ── Set wall-clock start for new mala if needed ──
  ensureMalaWallStart() {
    const ms = this.S.ms || 108;
    const countInMala = this.gTod() % ms;
    if (countInMala === 1 || this.malaWallStart === 0) {
      this.malaWallStart = Date.now();
      localStorage.setItem('rjap_malaWallStart', String(this.malaWallStart));
    }
  },

  // ── Mala Complete — Bell sound + TRIPLE vibration + log duration + animate timer ──
  malaOk() {
    const f = document.getElementById('mf');
    f.classList.add('show'); setTimeout(() => f.classList.remove('show'), 2800);
    // Bell sound
    if (this.S.cfg.sound) playSynthBell();
    // Triple long vibration synced with bell
    this.vib([200, 80, 200, 80, 300]);
    // Record mala duration
    const now = Date.now();
    const malaDuration = Math.round((now - this.malaWallStart) / 1000);
    this.malaWallStart = now;
    localStorage.setItem('rjap_malaWallStart', String(now));
    const isRVm = this.S.japMode === 'rv';
    if (isRVm) {
      if (!this.S.malaLogRV) this.S.malaLogRV = [];
      this.S.malaLogRV.push(malaDuration);
    } else {
      if (!this.S.malaLog) this.S.malaLog = [];
      this.S.malaLog.push(malaDuration);
    }
    this.save();
    // Animate mala duration on timer display
    this.flashMalaDuration(malaDuration);
  },

  flashMalaDuration(sec) {
    const disp = document.getElementById('timerDisplay');
    if (!disp) return;
    const m = Math.floor(sec / 60), s = sec % 60;
    const durStr = (m > 0 ? m + 'm ' : '') + s + 's';
    // Spawn floating label anchored to the timer display position
    const rect = disp.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'mala-time-float';
    el.textContent = '📿 ' + durStr;
    el.style.fontSize = '22px';
    el.style.left = (rect.left + rect.width / 2 - 40) + 'px';
    el.style.top  = (rect.top - 4) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2100);
  },

  // ── Main tap ──
  ht(e) {
    e.preventDefault();
    const ms = this.S.ms || 108;
    const isRV = this.S.japMode === 'rv';
    if (isRV) {
      this.S.historyRV[this.S.tk] = (this.S.historyRV[this.S.tk] || 0) + 1;
    } else {
      this.S.history[this.S.tk] = (this.S.history[this.S.tk] || 0) + 1;
    }
    this.ensureMalaWallStart();
    this.save(); fbDebouncedPush();
    // Haptic heartbeat — 10ms bead feeling
    this.vib([10]);
    this.tapTimer();
    if (isRV) {
      spawnRV(e, document.getElementById('tz'));
    } else {
      spawn(e, document.getElementById('tz'));
    }
    const nm = Math.floor(this.gTod() / ms);
    const lmcKey = isRV ? 'lmcRV' : 'lmc';
    if (nm > this[lmcKey]) { this[lmcKey] = nm; this.malaOk(); App.silentMonkBackup(); }
    this.ua();
  },

  undo1() {
    const isRV = this.S.japMode === 'rv';
    const hist = isRV ? this.S.historyRV : this.S.history;
    if ((hist[this.S.tk] || 0) > 0) {
      hist[this.S.tk]--;
      const lmcKey = isRV ? 'lmcRV' : 'lmc';
      this[lmcKey] = Math.floor(this.gTod() / (this.S.ms || 108));
      this.save(); fbDebouncedPush(); this.ua(); this.vib([10]);
    }
  },

  // ── 28 Names timers ──
  _n28CycleStart: null,
  _n28TotalStart: null,
  _n28TimerInterval: null,
  _n28SavedSecs: 0,      // seconds already flushed into timer28History this session
  _n28Paused: false,
  _n28PausedCycleSec: 0, // cycle seconds frozen at moment of pause
  _n28PausedTotalSec: 0, // total seconds frozen at moment of pause
  _n28AutoPauseTimeout: null,
  _n28CompletionAnimating: false,
  _n28CompletionTimer: null,

  // ── Update pause button appearance ──
  _upd28PauseBtn() {
    const btn = document.getElementById('n28PauseBtn');
    if (!btn) return;
    const hasStarted = !!this._n28TotalStart || this._n28Paused;
    btn.style.display = hasStarted ? '' : 'none';
    if (this._n28Paused) {
      btn.textContent = '▶ Resume';
      btn.style.background = 'rgba(39,174,96,0.15)';
      btn.style.borderColor = 'rgba(46,204,113,0.4)';
      btn.style.color = 'var(--green)';
    } else {
      btn.textContent = '⏸ Pause';
      btn.style.background = 'rgba(109,184,255,0.12)';
      btn.style.borderColor = 'rgba(109,184,255,0.35)';
      btn.style.color = 'var(--a2)';
    }
  },

  // ── Pause the 28 Names timers ──
  pause28() {
    if (this._n28Paused || !this._n28TotalStart) return;
    // Freeze current values
    this._n28PausedCycleSec = this._n28CycleStart
      ? Math.floor((Date.now() - this._n28CycleStart) / 1000) : 0;
    const sessionSec = Math.floor((Date.now() - this._n28TotalStart) / 1000);
    const savedSec = this.S.timer28History[this.S.tk] || 0;
    this._n28PausedTotalSec = savedSec + (sessionSec - (this._n28SavedSecs || 0));
    // Flush elapsed time to history
    this.flush28TimeToHistory();
    // Stop interval
    clearInterval(this._n28TimerInterval);
    this._n28TimerInterval = null;
    clearTimeout(this._n28AutoPauseTimeout);
    this._n28AutoPauseTimeout = null;
    // Clear session timestamps so flush doesn't double-count on resume
    this._n28TotalStart = null;
    this._n28CycleStart = null;
    this._n28SavedSecs = 0;
    this._n28Paused = true;
    this._upd28PauseBtn();
    // Show frozen values
    const fmt = s => Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60);
    const ce = document.getElementById('n28CycleTimer');
    const te = document.getElementById('n28TotalTimer');
    if (ce) ce.textContent = fmt(this._n28PausedCycleSec);
    if (te) te.textContent = fmt(this._n28PausedTotalSec);
  },

  // ── Resume the 28 Names timers ──
  resume28() {
    if (!this._n28Paused) return;
    this._n28Paused = false;
    // Re-anchor timestamps accounting for already-elapsed time
    // We offset TotalStart so the running total picks up from where it paused
    // (timer28History already has savedSec baked in from flush)
    this._n28TotalStart = Date.now();
    this._n28SavedSecs = 0;
    // Re-anchor cycle start so cycle timer picks up from frozen value
    this._n28CycleStart = Date.now() - (this._n28PausedCycleSec * 1000);
    this._upd28PauseBtn();
    this.start28Timers();
    // Re-arm 6s auto-pause
    this._arm28AutoPause();
  },

  // ── Toggle pause/resume ──
  toggle28Pause() {
    if (this._n28Paused) this.resume28();
    else this.pause28();
  },

  // ── Arm 6-second auto-pause ──
  _arm28AutoPause() {
    clearTimeout(this._n28AutoPauseTimeout);
    this._n28AutoPauseTimeout = setTimeout(() => {
      if (!this._n28Paused) this.pause28();
    }, 6000);
  },

  start28Timers() {
    if (this._n28Paused) return; // don't start if paused
    if (!this._n28TotalStart) {
      this._n28TotalStart = Date.now();
      this._n28SavedSecs = 0;
    }
    if (!this._n28CycleStart) this._n28CycleStart = Date.now();
    if (this._n28TimerInterval) return; // already running
    this._n28TimerInterval = setInterval(() => {
      if (this._n28Paused) return;
      const fmt = s => Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60);
      const cycSec = this._n28CycleStart
        ? Math.floor((Date.now() - this._n28CycleStart) / 1000) : 0;
      const sessionSec = this._n28TotalStart
        ? Math.floor((Date.now() - this._n28TotalStart) / 1000) : 0;
      const todaySavedSec = this.S.timer28History[this.S.tk] || 0;
      const totSec = todaySavedSec + sessionSec - (this._n28SavedSecs || 0);
      const ce = document.getElementById('n28CycleTimer');
      const te = document.getElementById('n28TotalTimer');
      if (ce) ce.textContent = fmt(cycSec);
      if (te) te.textContent = fmt(totSec);
    }, 1000);
    this._upd28PauseBtn();
  },

  flush28TimeToHistory() {
    if (!this._n28TotalStart) return;
    const elapsed = Math.floor((Date.now() - this._n28TotalStart) / 1000);
    const newSecs = elapsed - this._n28SavedSecs;
    if (newSecs > 0) {
      this.S.timer28History[this.S.tk] = (this.S.timer28History[this.S.tk] || 0) + newSecs;
      this._n28SavedSecs = elapsed;
      this.save(); fbDebouncedPush();
    }
  },

  resetCycleTimer28() {
    this.flush28TimeToHistory();
    // Reset cycle anchor — if paused, reset frozen cycle sec too
    if (this._n28Paused) {
      this._n28PausedCycleSec = 0;
      const ce = document.getElementById('n28CycleTimer');
      if (ce) ce.textContent = '0:00';
    } else {
      this._n28CycleStart = Date.now();
      const ce = document.getElementById('n28CycleTimer');
      if (ce) ce.textContent = '0:00';
    }
  },

  stopAll28Timers() {
    clearTimeout(this._n28AutoPauseTimeout);
    this._n28AutoPauseTimeout = null;
    clearTimeout(this._n28CompletionTimer);
    this._n28CompletionTimer = null;
    this._n28CompletionAnimating = false;
    this.flush28TimeToHistory();
    clearInterval(this._n28TimerInterval);
    this._n28TimerInterval = null;
    this._n28CycleStart = null;
    this._n28TotalStart = null;
    this._n28SavedSecs = 0;
    this._n28Paused = false;
    this._n28PausedCycleSec = 0;
    this._n28PausedTotalSec = 0;
    const ce = document.getElementById('n28CycleTimer');
    const te = document.getElementById('n28TotalTimer');
    if (ce) ce.textContent = '0:00';
    // Show today's total accumulated 28 time
    const fmt = s => Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60);
    const todaySec = this.S.timer28History[this.S.tk] || 0;
    if (te) te.textContent = fmt(todaySec);
    const mf28 = document.getElementById('mf28');
    if (mf28) mf28.classList.remove('show');
    this._upd28PauseBtn();
  },

  // ── 28 Names tap ──
  h28(e) {
    e.preventDefault();
    if (this._n28CompletionAnimating) return;
    // If paused, resume on tap
    if (this._n28Paused) {
      this.resume28();
    }
    if (!this.S.h28[this.S.tk]) this.S.h28[this.S.tk] = 0;
    const posBefore = get28Pos();
    this.S.h28[this.S.tk]++;
    this.save(); fbDebouncedPush();
    this.vib([10]);
    this.start28Timers();
    // Re-arm 6s auto-pause on every tap
    this._arm28AutoPause();
    spawnName28(e, NAMES28[posBefore].name);
    if (this.S.h28[this.S.tk] % 28 === 0) cycleDone28();
    u28();
  },

  undo28() {
    if ((this.S.h28[this.S.tk] || 0) > 0) {
      // Freeze wish progress before changing h28 so bar reflects the undo
      (this.S.sankalpas||[]).filter(s => !s.done && s.startCycles !== null).forEach(s => {
        s._savedProgress = (s._savedProgress || 0) + Math.max(0, getTotalCycles28() - s.startCycles);
        s.startCycles = getTotalCycles28();
      });
      this.S.h28[this.S.tk]--;
      // Rebase wishes to new lower total
      (this.S.sankalpas||[]).filter(s => !s.done && s.startCycles !== null).forEach(s => {
        s.startCycles = getTotalCycles28();
      });
      this.save(); u28(); this.vib([10]);
    }
  },

  // ── Silent Monk Auto Backup: triggered on every mala complete ──
  silentMonkBackup() {
    if (!fbUser) return;
    // Delta push to Firebase (near-instant cross-device sync)
    clearTimeout(this.fbDebouncePush);
    fbPushDelta();
    // JSON snapshot to Google Drive
    gdDriveSilentBackup();
  }
};

// ═══════════════════════════════════════════════════════
// HELPERS & GLOBALS
// ═══════════════════════════════════════════════════════
// Bell sound — synthesized 3-tone chime
function playSynthBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[523,0],[659,0.3],[784,0.6]].forEach(([fr,t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = fr; o.type = 'sine';
      g.gain.setValueAtTime(0.3, ctx.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+2);
      o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+2);
    });
  } catch(e) {}
}

// Test Bell Sound button
function testSound() { playSynthBell(); }

// Floating राधा spawn
let acf = false;
function spawn(e, zone) {
  const r = zone.getBoundingClientRect();
  let x, y;
  if (e.touches && e.touches[0]) { x = e.touches[0].clientX - r.left; y = e.touches[0].clientY - r.top; }
  else { x = e.clientX - r.left; y = e.clientY - r.top; }
  const el = document.createElement('div');
  el.className = 'fn'; el.textContent = 'राधा';
  const fs = 110 + Math.random()*60;
  el.style.left = (x - fs*0.6) + 'px'; el.style.top = (y - fs*0.4) + 'px';
  el.style.fontSize = fs + 'px';
  acf = !acf;
  el.style.color = acf ? '#FFD700' : '#6DB8FF';
  el.style.textShadow = acf ? '0 0 30px rgba(255,215,0,0.9)' : '0 0 30px rgba(109,184,255,0.9)';
  zone.appendChild(el); setTimeout(() => el.remove(), 2400);
}

function spawnRV(e, zone) {
  const r = zone.getBoundingClientRect();
  let x, y;
  if (e.touches && e.touches[0]) { x = e.touches[0].clientX - r.left; y = e.touches[0].clientY - r.top; }
  else { x = e.clientX - r.left; y = e.clientY - r.top; }
  const el = document.createElement('div');
  el.className = 'fn-rv';
  const fs = 55 + Math.random()*25;
  el.innerHTML = '<span style="font-size:'+fs+'px">राधावल्लभ</span><span style="font-size:'+(fs*0.85)+'px">श्री हरिवंश</span>';
  el.style.left = (x - fs*1.2) + 'px'; el.style.top = (y - fs*0.5) + 'px';
  acf = !acf;
  el.style.color = acf ? '#FFD700' : '#6DB8FF';
  el.style.textShadow = acf ? '0 0 30px rgba(255,215,0,0.9)' : '0 0 30px rgba(109,184,255,0.9)';
  zone.appendChild(el); setTimeout(() => el.remove(), 2400);
}

// Prevent double-tap zoom
let lt2 = 0;
document.addEventListener('touchend', e => { const n = Date.now(); if (n - lt2 < 300) e.preventDefault(); lt2 = n; }, { passive: false });

// Stats timer tick
setInterval(() => { if (App.timerRunning) App.updateTimerToday(); }, 1000);
// 28 Names stats panel live tick — refreshes time while timer is running
setInterval(() => { if (App._n28TimerInterval) refresh28StatsIfOpen(); }, 2000);

// ── Midnight date-rollover check ──
// Fixes mala log not resetting when app stays open past midnight
setInterval(() => {
  const newTk = App.getTk();
  if (newTk !== App.S.tk) {
    App.S.tk = newTk;
    App.S.malaLog = [];
    App.S.malaLogRV = [];
    if (!App.S.history[App.S.tk]) App.S.history[App.S.tk] = 0;
    if (!App.S.h28[App.S.tk]) App.S.h28[App.S.tk] = 0;
    if (!App.S.timerHistory[App.S.tk]) App.S.timerHistory[App.S.tk] = 0;
    if (!App.S.timer28History[App.S.tk]) App.S.timer28History[App.S.tk] = 0;
    if (!App.S.historyRV) App.S.historyRV = {};
    if (!App.S.historyRV[App.S.tk]) App.S.historyRV[App.S.tk] = 0;
    if (!App.S.timerHistoryRV) App.S.timerHistoryRV = {};
    if (!App.S.timerHistoryRV[App.S.tk]) App.S.timerHistoryRV[App.S.tk] = 0;
    App.lmc = 0;
    App.lmcRV = 0;
    App.save();
    fbDebouncedPush();
    App.ua();
    uStats();
  }
}, 60000);

// ── Toast ──
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:rgba(74,144,226,0.2);border:1px solid rgba(109,184,255,0.4);backdrop-filter:blur(10px);color:var(--a2);padding:9px 18px;border-radius:18px;font-size:13px;z-index:500;transition:opacity 0.3s;pointer-events:none;white-space:nowrap;font-family:Inter,sans-serif';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 2000);
}

// ── RV Target Save ──
function svtRV(type) {
  const ms = App.S.ms || 108;
  if (type === 'd') {
    const v = parseInt(document.getElementById('dtRVIn').value) || 0;
    App.S.dtRV = v;
  }
  App.save(); fbDebouncedPush(); App.ua(); toast('RV Daily Target saved! 🎯');
}

// ── Init RV mode UI on page load ──
function initJapModeUI() {
  if (App.S.japMode === 'rv') switchJapMode('rv');
  // Populate RV target inputs
  const dtRVIn = document.getElementById('dtRVIn');
  if (dtRVIn && App.S.dtRV) dtRVIn.value = App.S.dtRV;
  const ms = App.S.ms || 108;
  const dtRVM = document.getElementById('dtRVMala');
  if (dtRVM) dtRVM.textContent = Math.floor((App.S.dtRV||0)/ms);
}

// ── Naam Selector Toggle ──
function toggleNaamSel() {
  const dd = document.getElementById('naamSelDd');
  const btn = document.getElementById('naamSelBtn');
  dd.classList.toggle('show');
  btn.classList.toggle('open');
  // Close on outside click
  if (dd.classList.contains('show')) {
    setTimeout(() => {
      document.addEventListener('click', closeNaamSelOutside);
    }, 10);
  }
}
function closeNaamSelOutside(e) {
  const dd = document.getElementById('naamSelDd');
  const btn = document.getElementById('naamSelBtn');
  if (!dd.contains(e.target) && !btn.contains(e.target)) {
    dd.classList.remove('show');
    btn.classList.remove('open');
    document.removeEventListener('click', closeNaamSelOutside);
  }
}
function switchJapMode(mode) {
  App.S.japMode = mode;
  const dd = document.getElementById('naamSelDd');
  const btn = document.getElementById('naamSelBtn');
  dd.classList.remove('show');
  btn.classList.remove('open');
  document.removeEventListener('click', closeNaamSelOutside);
  // Update UI
  const optR = document.getElementById('naamOptRadha');
  const optRV = document.getElementById('naamOptRV');
  const titleEl = document.getElementById('rnTitle');
  if (mode === 'rv') {
    optR.classList.remove('active'); optR.querySelector('.ns-check').textContent = '';
    optRV.classList.add('active'); optRV.querySelector('.ns-check').textContent = '✓';
    titleEl.innerHTML = '<span style="font-size:clamp(18px,5vw,28px);line-height:1.1">राधावल्लभ</span><br><span style="font-size:clamp(16px,4.5vw,24px);line-height:1.1">श्री हरिवंश</span>';
    titleEl.style.textAlign = 'center';
  } else {
    optRV.classList.remove('active'); optRV.querySelector('.ns-check').textContent = '';
    optR.classList.add('active'); optR.querySelector('.ns-check').textContent = '✓';
    titleEl.textContent = 'राधा';
    titleEl.style.textAlign = '';
  }
  // Reset mala counter for the mode
  const ms = App.S.ms || 108;
  if (mode === 'rv') {
    App.lmcRV = Math.floor((App.S.historyRV[App.S.tk]||0) / ms);
  } else {
    App.lmc = Math.floor((App.S.history[App.S.tk]||0) / ms);
  }
  App.save(); App.ua(); uStats(); renderMalaLog();
  toast(mode === 'rv' ? 'राधावल्लभ श्री हरिवंश 🙏' : 'राधा 🙏');
}


function escHtml(t) { return (t+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Indian number abbreviation: 3Cr 36L 2K 100
function fmtIN(n) {
  n = Math.floor(n || 0);
  if (n === 0) return '0';
  const CR = 1e7, L = 1e5, K = 1e3;
  let parts = [];
  const cr = Math.floor(n / CR); n %= CR;
  const la = Math.floor(n / L);  n %= L;
  const k  = Math.floor(n / K);  n %= K;
  if (cr) parts.push(cr + 'Cr');
  if (la) parts.push(la + 'L');
  if (k)  parts.push(k  + 'K');
  if (n)  parts.push(n + '');
  return parts.join(' ');
}

// setSyncPill
function setSyncPill(state, text) {
  const p = document.getElementById('syncPill');
  const tx = document.getElementById('syncPillText');
  if (!p || !tx) return;
  p.className = 'sync-pill' + (state === 'syncing' ? ' syncing' : state === 'error' ? ' error' : '');
  tx.textContent = text;
}

// ── View Switcher ──
function sv(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'vs') uStats();
  if (id === 'vb') { initBrahmaStartInput(); renderCal(); }
  if (id === 'vst') renderSt();
  if (id === 'v28') { u28(); render28Dots(get28Pos()); }
  else { App.flush28TimeToHistory(); }
  if (id === 'vms') { renderMilestonesTab(); }
  if (id === 'vset') {
    if (App.S.dt) document.getElementById('dtIn').value = App.S.dt;
    if (App.S.lt) document.getElementById('ltIn').value = App.S.lt;
    document.getElementById('msIn').value = App.S.ms || 108;
    initReminderUI();
  }
}

// ── Settings ──
document.addEventListener('DOMContentLoaded', () => {
  const dti = document.getElementById('dtIn');
  const lti = document.getElementById('ltIn');
  if (dti) dti.addEventListener('input', function() { document.getElementById('dtMala').textContent = Math.ceil((parseInt(this.value)||0)/(App.S.ms||108)); });
  if (lti) lti.addEventListener('input', function() { document.getElementById('ltMala').textContent = Math.ceil((parseInt(this.value)||0)/(App.S.ms||108)).toLocaleString(); });

  // Live preview for new jap entry fields — trigger uStats on any change
  ['manualJapIn','prevJapIn','addJapOtherIn','addJapOtherDate','deductTodayIn','deductOtherIn','deductOtherDate',
   'jtAddTodayMin','jtAddTodaySec','jtAddOtherMin','jtAddOtherSec','jtAddOtherDate',
   'jtDedTodayMin','jtDedTodaySec','jtDedOtherMin','jtDedOtherSec','jtDedOtherDate',
   'nameJapDeductIn','nameJapRestoreIn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', uStats);
    if (el) el.addEventListener('change', uStats);
  });
});

function svt(tp) {
  if (tp === 'd') App.S.dt = parseInt(document.getElementById('dtIn').value) || 0;
  else App.S.lt = parseInt(document.getElementById('ltIn').value) || 0;
  App.save(); fbDebouncedPush(); App.ua(); toast('Target saved! 🎯');
}
function svm() {
  App.S.ms = parseInt(document.getElementById('msIn').value) || 108;
  App.save(); App.ua(); fbDebouncedPush(); gdDriveSilentBackup(); toast('Mala size saved! 📿');
}
function tgs(k) {
  App.S.cfg[k] = !App.S.cfg[k];
  const m = { vib: 'tgVib', sound: 'tgSnd' };
  App.S.cfg[k] ? document.getElementById(m[k]).classList.add('on') : document.getElementById(m[k]).classList.remove('on');
  App.save(); fbDebouncedPush();
}

// ── Collapsible Section Toggle ──
function toggleCs(bodyId, chevId) {
  const body = document.getElementById(bodyId);
  const chev = document.getElementById(chevId);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ── Manual Jap Entry ──
function addManualJap() {
  const n = parseInt(document.getElementById('manualJapIn').value) || 0;
  if (n <= 0) { toast('Please enter a number > 0'); return; }
  const isRV = App.S.japMode === 'rv';
  if (isRV) { App.S.historyRV[App.S.tk] = (App.S.historyRV[App.S.tk] || 0) + n; }
  else { App.S.history[App.S.tk] = (App.S.history[App.S.tk] || 0) + n; }
  // Handle time input — add to today's timer and create mala log entries
  const minEl = document.getElementById('manualJapMin');
  const secEl = document.getElementById('manualJapSec');
  const timeSecs = (parseInt(minEl?.value) || 0) * 60 + Math.min(59, Math.max(0, parseInt(secEl?.value) || 0));
  if (timeSecs > 0) {
    const th = App.getCurTimerHistory();
    th[App.S.tk] = (th[App.S.tk] || 0) + timeSecs;
    // Create mala log entries with averaged time
    const ms = App.S.ms || 108;
    const malasAdded = Math.floor(n / ms);
    if (malasAdded > 0) {
      const avgPerMala = Math.round(timeSecs / malasAdded);
      const log = isRV ? (App.S.malaLogRV || (App.S.malaLogRV = [])) : (App.S.malaLog || (App.S.malaLog = []));
      for (let i = 0; i < malasAdded; i++) log.push(avgPerMala);
    }
  }
  App.ensureMalaWallStart();
  const nm = Math.floor(App.gTod() / (App.S.ms || 108));
  const lmcKey = isRV ? 'lmcRV' : 'lmc';
  if (nm > App[lmcKey]) { App[lmcKey] = nm; App.malaOk(); }
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('manualJapIn').value = '';
  if (minEl) minEl.value = '';
  if (secEl) secEl.value = '';
  document.getElementById('manualMalaPreview').textContent = '0';
  document.getElementById('manualTodayPreview').textContent = App.gTod();
  toast('Added ' + n + ' jap' + (timeSecs > 0 ? ' + ' + Math.floor(timeSecs/60) + 'm ' + (timeSecs%60) + 's' : '') + ' to today! Total: ' + App.gTod() + ' 🙏');
}

function addPrevJap() {
  const n = parseInt(document.getElementById('prevJapIn').value) || 0;
  if (n <= 0) { toast('Please enter a number > 0'); return; }
  const prevKey = 'prev_' + Date.now();
  const isRV = App.S.japMode === 'rv';
  if (isRV) { App.S.historyRV[prevKey] = n; }
  else { App.S.history[prevKey] = n; }
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('prevJapIn').value = '';
  toast('Added ' + n.toLocaleString() + ' jap to lifetime! 🙏 Jai Radhe!');
}

// ── Deduct Name Jap from Lifetime ──
function addNameJapDeduct() {
  const n = parseInt(document.getElementById('nameJapDeductIn').value) || 0;
  if (n <= 0) { toast('Please enter a number > 0'); return; }
  if (App.S.japMode === 'rv') { App.S.nameJapDeductRV = (App.S.nameJapDeductRV || 0) + n; }
  else { App.S.nameJapDeduct = (App.S.nameJapDeduct || 0) + n; }
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('nameJapDeductIn').value = '';
  document.getElementById('nameJapDeductPreview').textContent = '—';
  uStats();
  toast('Deducted ' + n.toLocaleString() + ' name jap from lifetime total 🙏');
}

function removeNameJapDeduct() {
  const n = parseInt(document.getElementById('nameJapRestoreIn').value) || 0;
  if (n <= 0) { toast('Please enter a number > 0'); return; }
  const isRV = App.S.japMode === 'rv';
  const cur = isRV ? (App.S.nameJapDeductRV || 0) : (App.S.nameJapDeduct || 0);
  if (n > cur) { toast('Cannot restore more than currently deducted (' + cur.toLocaleString() + ')'); return; }
  if (isRV) { App.S.nameJapDeductRV = cur - n; }
  else { App.S.nameJapDeduct = cur - n; }
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('nameJapRestoreIn').value = '';
  document.getElementById('nameJapRestorePreview').textContent = '—';
  uStats();
  toast('Restored ' + n.toLocaleString() + ' jap to lifetime total 🙏');
}

function deductTodayJap() {
  const n = parseInt(document.getElementById('deductTodayIn').value) || 0;
  if (n <= 0) { toast('Please enter a number > 0'); return; }
  const isRV = App.S.japMode === 'rv';
  const hist = isRV ? App.S.historyRV : App.S.history;
  const cur = hist[App.S.tk] || 0;
  if (n > cur) { toast('Cannot deduct more than today\'s count (' + cur + ')'); return; }
  hist[App.S.tk] = cur - n;
  const lmcKey = isRV ? 'lmcRV' : 'lmc';
  App[lmcKey] = Math.floor(App.gTod() / (App.S.ms || 108));
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('deductTodayIn').value = '';
  toast('Deducted ' + n + '. New total: ' + App.gTod() + ' 🙏');
}

function deductOtherJap() {
  const date = (document.getElementById('deductOtherDate').value || '').trim();
  const n = parseInt(document.getElementById('deductOtherIn').value) || 0;
  if (!date) { toast('Please select a date'); return; }
  if (n <= 0) { toast('Please enter a number > 0'); return; }
  const isRV = App.S.japMode === 'rv';
  const hist = isRV ? App.S.historyRV : App.S.history;
  const cur = hist[date] || 0;
  if (n > cur) { toast('Cannot deduct more than that day\'s count (' + cur + ')'); return; }
  hist[date] = cur - n;
  App.save(); App.ua(); fbDebouncedPush(); renderCal();
  document.getElementById('deductOtherIn').value = '';
  toast('Deducted ' + n + ' from ' + date + ' 🙏');
}

function addOtherDayJap() {
  const date = (document.getElementById('addJapOtherDate').value || '').trim();
  const n = parseInt(document.getElementById('addJapOtherIn').value) || 0;
  if (!date) { toast('Please select a date'); return; }
  if (n <= 0) { toast('Please enter a number > 0'); return; }
  const isRV = App.S.japMode === 'rv';
  const hist = isRV ? App.S.historyRV : App.S.history;
  hist[date] = (hist[date] || 0) + n;
  App.save(); App.ua(); fbDebouncedPush(); renderCal();
  document.getElementById('addJapOtherIn').value = '';
  document.getElementById('addJapOtherPreview').textContent = '—';
  toast('Added ' + n + ' jap to ' + date + ' 🙏');
}

// ── Jap Time Manual Entry ──
function _jtSecs(minId, secId) {
  const m = parseInt(document.getElementById(minId).value) || 0;
  const s = parseInt(document.getElementById(secId).value) || 0;
  return m * 60 + Math.min(59, Math.max(0, s));
}

function addJapTimeToday() {
  const secs = _jtSecs('jtAddTodayMin', 'jtAddTodaySec');
  if (secs <= 0) { toast('Please enter at least 1 minute'); return; }
  const th = App.getCurTimerHistory();
  th[App.S.tk] = (th[App.S.tk] || 0) + secs;
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('jtAddTodayMin').value = '';
  document.getElementById('jtAddTodaySec').value = '';
  document.getElementById('jtAddTodayPreview').textContent = '—';
  const m = Math.floor(secs/60), s = secs%60;
  toast('Added ' + m + 'm ' + s + 's to today\'s jap time 🙏');
}

function addJapTimeOther() {
  const date = (document.getElementById('jtAddOtherDate').value || '').trim();
  const secs = _jtSecs('jtAddOtherMin', 'jtAddOtherSec');
  if (!date) { toast('Please select a date'); return; }
  if (secs <= 0) { toast('Please enter at least 1 minute'); return; }
  const th2 = App.getCurTimerHistory();
  th2[date] = (th2[date] || 0) + secs;
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('jtAddOtherMin').value = '';
  document.getElementById('jtAddOtherSec').value = '';
  document.getElementById('jtAddOtherDate').value = '';
  document.getElementById('jtAddOtherPreview').textContent = '—';
  const m = Math.floor(secs/60), s = secs%60;
  toast('Added ' + m + 'm ' + s + 's to ' + date + ' 🙏');
}

function deductJapTimeToday() {
  const secs = _jtSecs('jtDedTodayMin', 'jtDedTodaySec');
  if (secs <= 0) { toast('Please enter at least 1 minute'); return; }
  const th3 = App.getCurTimerHistory();
  const cur = th3[App.S.tk] || 0;
  if (secs > cur) { toast('Cannot deduct more than today\'s time'); return; }
  th3[App.S.tk] = cur - secs;
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('jtDedTodayMin').value = '';
  document.getElementById('jtDedTodaySec').value = '';
  document.getElementById('jtDedTodayPreview').textContent = '—';
  const m = Math.floor(secs/60), s = secs%60;
  toast('Deducted ' + m + 'm ' + s + 's from today\'s jap time 🙏');
}

function deductJapTimeOther() {
  const date = (document.getElementById('jtDedOtherDate').value || '').trim();
  const secs = _jtSecs('jtDedOtherMin', 'jtDedOtherSec');
  if (!date) { toast('Please select a date'); return; }
  if (secs <= 0) { toast('Please enter at least 1 minute'); return; }
  const th4 = App.getCurTimerHistory();
  const cur = th4[date] || 0;
  if (secs > cur) { toast('Cannot deduct more than that day\'s time (' + Math.floor(cur/60) + 'm)'); return; }
  th4[date] = cur - secs;
  App.save(); App.ua(); fbDebouncedPush();
  document.getElementById('jtDedOtherMin').value = '';
  document.getElementById('jtDedOtherSec').value = '';
  document.getElementById('jtDedOtherDate').value = '';
  document.getElementById('jtDedOtherPreview').textContent = '—';
  const m = Math.floor(secs/60), s = secs%60;
  toast('Deducted ' + m + 'm ' + s + 's from ' + date + ' 🙏');
}

// ── Stats ──
function uStats() {
  const ms = App.S.ms || 108, tot = App.gTot(), now = new Date();
  const tod = App.gTodCombined(); // COMBINED today for stats
  const curHist = App.getCombinedHistory(); // COMBINED radha + RV
  const curTimerHist = App.getCombinedTimerHistory(); // COMBINED timer
  const wk = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate()-i); wk.push(d.toISOString().split('T')[0]); }
  const ws = wk.reduce((s,k) => s + (curHist[k]||0), 0);
  const mp = now.toISOString().slice(0,7);
  let ms2 = 0, best = 0, streak = 0;
  Object.entries(curHist).forEach(([k,v]) => { if (k.startsWith(mp)) ms2 += v; if (!k.startsWith('prev_') && v > best) best = v; });
  const d2 = new Date();
  while (streak < 999) { const k = d2.toISOString().split('T')[0]; if ((curHist[k]||0) > 0) { streak++; d2.setDate(d2.getDate()-1); } else break; }
  document.getElementById('sTod').textContent = tod;
  document.getElementById('sTodM').textContent = Math.floor(tod/ms) + ' malas';
  document.getElementById('sWk').textContent = ws;
  document.getElementById('sWkM').textContent = Math.floor(ws/ms) + ' malas';
  document.getElementById('sMo').textContent = ms2;
  document.getElementById('sMoM').textContent = Math.floor(ms2/ms) + ' malas';
  document.getElementById('sTot').textContent = tot;
  document.getElementById('sTotM').textContent = Math.floor(tot/ms) + ' malas';
  // Lifetime Jap Time (all jap time + all 28 names time)
  const ltTimeSec = Object.values(App.getCombinedTimerHistory()).reduce((a,b)=>a+b,0) + Object.values(App.S.timer28History||{}).reduce((a,b)=>a+b,0);
  const ltH = Math.floor(ltTimeSec/3600), ltM = Math.floor((ltTimeSec%3600)/60), ltS = ltTimeSec%60;
  document.getElementById('sLtTime').textContent = ltH > 0 ? ltH+'h '+ltM+'m '+String(ltS).padStart(2,'0')+'s' : ltM+'m '+String(ltS).padStart(2,'0')+'s';
  document.getElementById('sStr').textContent = streak;
  document.getElementById('sBest').textContent = best;
  const bars = document.getElementById('cbrs'); bars.innerHTML = '';
  const mx = Math.max(...wk.map(k => curHist[k]||0), 1);
  const dn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  wk.forEach(k => {
    const v = curHist[k]||0, h = Math.max(2, Math.round(v/mx*50));
    const c = document.createElement('div'); c.className = 'cbc';
    c.innerHTML = '<div class="cbb" style="height:'+h+'px"></div><div class="cbl">'+dn[new Date(k+'T12:00:00').getDay()]+'</div>';
    bars.appendChild(c);
  });
  const timeTod = (curTimerHist[App.S.tk]||0) + (App.timerRunning ? (App.timerSeconds - App.timerSavedSeconds) : 0);
  const timeWk = wk.reduce((s,k) => s + (curTimerHist[k]||0), 0) + (App.timerRunning ? (App.timerSeconds - App.timerSavedSeconds) : 0);
  const timeMo = Object.entries(curTimerHist).filter(([k]) => k.startsWith(mp)).reduce((s,[,v]) => s+v, 0) + (App.timerRunning ? (App.timerSeconds - App.timerSavedSeconds) : 0);
  function fmtShort(s) { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return (h>0?h+'h ':'')+m+'m'; }
  document.getElementById('tTod').textContent = fmtShort(timeTod);
  document.getElementById('tWk').textContent = fmtShort(timeWk);
  document.getElementById('tMo').textContent = fmtShort(timeMo);
  // 28 Names time — separate from main jap time
  const _28running = !!(App._n28TimerInterval && App._n28TotalStart);
  const _28liveExtra = _28running ? Math.max(0, Math.floor((Date.now() - App._n28TotalStart) / 1000) - (App._n28SavedSecs || 0)) : 0;
  const t28Tod = (App.S.timer28History[App.S.tk]||0) + Math.max(0, _28liveExtra);
  const t28Wk  = wk.reduce((s,k) => s + (App.S.timer28History[k]||0), 0) + (_28running && wk.includes(App.S.tk) ? Math.max(0,_28liveExtra) : 0);
  const t28Mo  = Object.entries(App.S.timer28History).filter(([k]) => k.startsWith(mp)).reduce((s,[,v]) => s+v, 0) + ((_28running && App.S.tk.startsWith(mp)) ? Math.max(0,_28liveExtra) : 0);
  const e28Tod = document.getElementById('t28Tod'), e28Wk = document.getElementById('t28Wk'), e28Mo = document.getElementById('t28Mo');
  if (e28Tod) e28Tod.textContent = fmt28Short(t28Tod);
  if (e28Wk)  e28Wk.textContent  = fmt28Short(t28Wk);
  if (e28Mo)  e28Mo.textContent  = fmt28Short(t28Mo);

  // Live previews for jap entry
  const mji = document.getElementById('manualJapIn');
  const pji = document.getElementById('prevJapIn');
  const aoi = document.getElementById('addJapOtherIn');
  const aod = document.getElementById('addJapOtherDate');
  const dti2 = document.getElementById('deductTodayIn');
  const doi = document.getElementById('deductOtherIn');
  const dod = document.getElementById('deductOtherDate');
  if (mji) { const n = parseInt(mji.value)||0; document.getElementById('manualMalaPreview').textContent = n>0?Math.floor(n/ms):'0'; document.getElementById('manualTodayPreview').textContent = n>0?(tod+n):'—'; }
  if (pji) { const n = parseInt(pji.value)||0; document.getElementById('prevMalaPreview').textContent = n>0?Math.floor(n/ms):'0'; document.getElementById('prevLifetimePreview').textContent = n>0?(tot+n).toLocaleString():'—'; }
  if (aoi && aod) { const n = parseInt(aoi.value)||0; const d = aod.value; const curH = App.S.japMode==='rv' ? App.S.historyRV : App.S.history; const cur = d ? (curH[d]||0) : 0; document.getElementById('addJapOtherPreview').textContent = n>0 && d ? (cur+n) : '—'; }
  if (dti2) { const n = parseInt(dti2.value)||0; document.getElementById('deductTodayPreview').textContent = n>0 ? Math.max(0, tod-n) : '—'; }
  if (doi && dod) { const n = parseInt(doi.value)||0; const d = dod.value; const curH2 = App.S.japMode==='rv' ? App.S.historyRV : App.S.history; const cur = d ? (curH2[d]||0) : 0; document.getElementById('deductOtherPreview').textContent = n>0 && d ? Math.max(0,cur-n) : '—'; }
  // Name Jap Deduct live previews
  const curDeduct = App.S.nameJapDeduct || 0;
  const rawTot = Object.values(App.S.history).reduce((a,b)=>a+b,0);
  const njdi = document.getElementById('nameJapDeductIn');
  const njri = document.getElementById('nameJapRestoreIn');
  const njdCur = document.getElementById('nameJapDeductCur');
  const njdMalas = document.getElementById('nameJapDeductMalas');
  if (njdCur) njdCur.textContent = curDeduct.toLocaleString();
  if (njdMalas) njdMalas.textContent = Math.floor(curDeduct/(ms)).toLocaleString();
  if (njdi) { const n=parseInt(njdi.value)||0; document.getElementById('nameJapDeductPreview').textContent = n>0 ? Math.max(0,rawTot-curDeduct-n).toLocaleString() : '—'; }
  if (njri) { const n=parseInt(njri.value)||0; document.getElementById('nameJapRestorePreview').textContent = n>0 ? Math.min(rawTot, Math.max(0,rawTot-curDeduct+n)).toLocaleString() : '—'; }
  // Jap time previews
  function _fmtSec(s) { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60; return (h>0?h+'h ':'')+m+'m '+sc+'s'; }
  const curTimeTod = App.S.timerHistory[App.S.tk]||0;
  const jtAtm = document.getElementById('jtAddTodayMin'), jtAts = document.getElementById('jtAddTodaySec');
  if (jtAtm) { const s = (parseInt(jtAtm.value)||0)*60+(jtAts?parseInt(jtAts.value)||0:0); document.getElementById('jtAddTodayPreview').textContent = s>0?_fmtSec(curTimeTod+s):'—'; }
  const jtDtm = document.getElementById('jtDedTodayMin'), jtDts = document.getElementById('jtDedTodaySec');
  if (jtDtm) { const s = (parseInt(jtDtm.value)||0)*60+(jtDts?parseInt(jtDts.value)||0:0); document.getElementById('jtDedTodayPreview').textContent = s>0?_fmtSec(Math.max(0,curTimeTod-s)):'—'; }
  const jtAom = document.getElementById('jtAddOtherMin'), jtAos = document.getElementById('jtAddOtherSec'), jtAod = document.getElementById('jtAddOtherDate');
  if (jtAom && jtAod && jtAod.value) { const curO = App.S.timerHistory[jtAod.value]||0; const s = (parseInt(jtAom.value)||0)*60+(jtAos?parseInt(jtAos.value)||0:0); document.getElementById('jtAddOtherPreview').textContent = s>0?_fmtSec(curO+s):'—'; }
  const jtDom = document.getElementById('jtDedOtherMin'), jtDos = document.getElementById('jtDedOtherSec'), jtDod = document.getElementById('jtDedOtherDate');
  if (jtDom && jtDod && jtDod.value) { const curO2 = App.S.timerHistory[jtDod.value]||0; const s = (parseInt(jtDom.value)||0)*60+(jtDos?parseInt(jtDos.value)||0:0); document.getElementById('jtDedOtherPreview').textContent = s>0?_fmtSec(Math.max(0,curO2-s)):'—'; }
  renderMalaLog();
}

function renderMalaLog() {
  const listEl = document.getElementById('malaLogList');
  const countEl = document.getElementById('malaLogCount');
  const avgEl = document.getElementById('malaLogAvg');
  const typeEl = document.getElementById('malaLogType');
  
  // FIX: Always clear the container first to prevent ghost data
  if (listEl) listEl.innerHTML = '';
  if (avgEl) { avgEl.style.display = 'none'; avgEl.textContent = ''; }
  if (countEl) countEl.textContent = '';
  
  const isRV = App.S.japMode === 'rv';
  
  // FIX: Reset type label fresh each time — no global carryover
  if (typeEl) typeEl.textContent = isRV ? '(\u0930\u093e\u0927\u093e\u0935\u0932\u094d\u0932\u092d)' : '(\u0930\u093e\u0927\u093e)';
  
  // FIX: Strict filtering — get the correct log for current mode only
  const rawLog = isRV ? (App.S.malaLogRV || []) : (App.S.malaLog || []);
  // Filter out entries with 0 or invalid values
  const log = rawLog.filter(sec => typeof sec === 'number' && sec > 0 && isFinite(sec));
  
  if (countEl) countEl.textContent = log.length > 0 ? '(' + log.length + ')' : '';
  
  if (log.length === 0) {
    listEl.innerHTML = '<div style="font-size:11px;color:var(--td);text-align:center;padding:6px 0">No malas completed yet today</div>';
    if (avgEl) avgEl.style.display = 'none';
    return;
  }
  
  // Average per mala
  if (avgEl && log.length > 0) {
    const totalSec = log.reduce((a,b) => a+b, 0);
    const avgSec = Math.round(totalSec / log.length);
    const am = Math.floor(avgSec / 60), as2 = avgSec % 60;
    avgEl.textContent = 'Average per mala: ' + (am > 0 ? am + 'm ' : '') + as2 + 's';
    avgEl.style.display = 'block';
    avgEl.style.cssText = 'font-size:11px;color:var(--green);margin-bottom:6px;text-align:center;padding:5px 10px;background:rgba(46,204,113,0.08);border-radius:8px;border:1px solid rgba(46,204,113,0.18);display:block';
  }
  
  log.forEach((sec, i) => {
    const m = Math.floor(sec / 60), s = sec % 60;
    const durStr = m > 0 ? m + 'm ' + s + 's' : s + 's';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(46,204,113,0.07);border:1px solid rgba(46,204,113,0.15);border-radius:9px;';
    row.innerHTML =
      '<span style="font-size:11px;color:var(--td)">Mala ' + (i+1) + '</span>' +
      '<span style="display:flex;align-items:center;gap:8px">' +
        '<span style="font-family:\'EB Garamond\',serif;font-size:16px;color:var(--green);letter-spacing:0.5px">' + durStr + '</span>' +
        '<span onclick="editMalaEntry('+i+')" style="cursor:pointer;font-size:13px;opacity:0.6" title="Edit">✏️</span>' +
        '<span onclick="deleteMalaEntry('+i+')" style="cursor:pointer;font-size:13px;opacity:0.6" title="Delete">🗑️</span>' +
      '</span>';
    listEl.appendChild(row);
  });
}

function editMalaEntry(idx) {
  const isRV = App.S.japMode === 'rv';
  const log = isRV ? App.S.malaLogRV : App.S.malaLog;
  if (!log || idx >= log.length) return;
  const cur = log[idx];
  const curM = Math.floor(cur / 60), curS = cur % 60;
  const input = prompt('Edit Mala ' + (idx+1) + ' time (format: M:SS)', curM + ':' + String(curS).padStart(2,'0'));
  if (input === null) return;
  const parts = input.split(':');
  const newSecs = (parseInt(parts[0])||0) * 60 + (parseInt(parts[1])||0);
  if (newSecs <= 0) { toast('Invalid time'); return; }
  const oldSecs = log[idx];
  log[idx] = newSecs;
  // Update today's timer history with the difference
  const th = App.getCurTimerHistory();
  th[App.S.tk] = Math.max(0, (th[App.S.tk]||0) + (newSecs - oldSecs));
  App.save(); App.ua(); fbDebouncedPush(); renderMalaLog();
  toast('Mala ' + (idx+1) + ' updated ✏️');
}

function deleteMalaEntry(idx) {
  const isRV = App.S.japMode === 'rv';
  const log = isRV ? App.S.malaLogRV : App.S.malaLog;
  if (!log || idx >= log.length) return;
  if (!confirm('Delete Mala ' + (idx+1) + ' entry?')) return;
  const removed = log.splice(idx, 1)[0];
  // Subtract removed time from today's timer
  const th = App.getCurTimerHistory();
  th[App.S.tk] = Math.max(0, (th[App.S.tk]||0) - removed);
  App.save(); App.ua(); fbDebouncedPush(); renderMalaLog();
  toast('Mala entry deleted 🗑️');
}

// ── Reset ──
let pr = null;
function cr2(tp) {
  pr = tp;
  const t = document.getElementById('moT'), d = document.getElementById('moD');
  if (tp === 'today') { t.textContent = 'Reset Today?'; d.textContent = "Clear today's " + App.gTod() + " jap count."; }
  else if (tp === '28today') { t.textContent = 'Reset 28 Names Today?'; d.textContent = "Clear today's " + (App.S.h28[App.S.tk]||0) + " count."; }
  else if (tp === '28all') { t.textContent = '⚠️ Reset All 28 Names Data?'; d.textContent = 'All 28 Names counts and time will be permanently deleted.'; }
  else if (tp === 'range') {
    const f = document.getElementById('rfrom').value, to = document.getElementById('rto').value;
    if (!f || !to) { toast('Please select both dates'); return; }
    t.textContent = 'Reset Date Range?'; d.textContent = 'Data from ' + f + ' to ' + to + ' will be deleted.';
  } else { t.textContent = '⚠️ Reset All Data?'; d.textContent = 'All history and records will be permanently deleted.'; }
  document.getElementById('mo').classList.add('show');
  document.getElementById('moCf').onclick = doReset;
}
function doReset() {
  if (pr === 'today') { App.S.history[App.S.tk] = 0; App.lmc = 0; App.S.malaLog = []; App.malaWallStart = Date.now(); localStorage.setItem('rjap_malaWallStart', String(App.malaWallStart)); }
  else if (pr === '28today') {
    // Freeze active wishes before zeroing today's count so progress bars drop correctly
    (App.S.sankalpas||[]).filter(s => !s.done && s.startCycles !== null).forEach(s => {
      s._savedProgress = (s._savedProgress || 0) + Math.max(0, getTotalCycles28() - s.startCycles);
      s.startCycles = getTotalCycles28();
    });
    App.S.h28[App.S.tk] = 0; App.S.timer28History[App.S.tk] = 0; App.lm28 = 0; App.stopAll28Timers();
    // Rebase wishes to new (lower) total after zeroing today
    (App.S.sankalpas||[]).filter(s => !s.done && s.startCycles !== null).forEach(s => {
      s.startCycles = getTotalCycles28();
    });
    // Write 0 into IDB per-day store and localStorage so it can't come back
    App.dbPut('h28', App.S.tk, 0);
    App.dbPut('timer28History', App.S.tk, 0);
    try {
      const ls = localStorage.getItem('rjap5');
      if (ls) {
        const d = JSON.parse(ls);
        if (d.h28) d.h28[App.S.tk] = 0;
        if (d.timer28History) d.timer28History[App.S.tk] = 0;
        localStorage.setItem('rjap5', JSON.stringify(d));
      }
    } catch(e) {}
    App.save();
    u28(); render28StatsPanel(); renderSankalpas();
  }
  else if (pr === '28all') {
    // 1. Clear in-memory
    App.S.h28 = {}; App.S.timer28History = {};
    App.S.h28[App.S.tk] = 0; App.S.timer28History[App.S.tk] = 0;
    App.S.sankalpas = []; App.S.syncBaseline28 = {};
    App.lm28 = 0; App.stopAll28Timers();
    // 2. Wipe the IDB per-day stores entirely so old keys can't merge back
    App.dbClearStore('h28').then(() => App.dbPut('h28', App.S.tk, 0));
    App.dbClearStore('timer28History').then(() => App.dbPut('timer28History', App.S.tk, 0));
    // 3. Also clear localStorage so it can't resurrect either
    try {
      const ls = localStorage.getItem('rjap5');
      if (ls) {
        const d = JSON.parse(ls);
        d.h28 = {}; d.timer28History = {}; d.sankalpas = []; d.syncBaseline28 = {};
        localStorage.setItem('rjap5', JSON.stringify(d));
      }
    } catch(e) {}
    // 4. Save main state with empty h28 so main IDB key is also clean
    App.save();
    fbDebouncedPush(); gdDriveSilentBackup();
    u28(); render28StatsPanel(); renderSankalpas();
    toast('All 28 Names data reset 🙏'); return;
  }
  else if (pr === 'range') {
    const f = document.getElementById('rfrom').value, to = document.getElementById('rto').value;
    Object.keys(App.S.history).forEach(k => { if (k >= f && k <= to) { App.S.history[k] = 0; if (App.S.timerHistory[k]) App.S.timerHistory[k] = 0; if (App.S.timer28History[k]) App.S.timer28History[k] = 0; } });
  } else {
    App.S.history = {}; App.S.h28 = {}; App.S.dt = 0; App.S.lt = 0; App.S.nameJapDeduct = 0;
    App.S.stotrams = {}; App.S.brahma = {}; App.S.timerHistory = {}; App.S.timer28History = {}; App.S.malaLog = [];
    App.lmc = 0; App.lm28 = 0;
    STLIST.forEach(x => { App.S.stotrams[x.id] = {}; });
    App.resetTimer();
  }
  App.save(); App.ua(); fbDebouncedPush(); gdDriveSilentBackup(); renderCal(); cm(); toast('Reset complete 🙏');
}
function cm() { document.getElementById('mo').classList.remove('show'); }

// ── Backup / Restore ──
function exportAllData() {
  const backup = {
    _version: 3, _exported: new Date().toISOString(),
    history: App.S.history||{}, h28: App.S.h28||{},
    timerHistory: App.S.timerHistory||{}, timer28History: App.S.timer28History||{},
    stotrams: App.S.stotrams||{}, brahma: App.S.brahma||{}, customSt: App.S.customSt||[],
    sankalpas: App.S.sankalpas||[], occasions: App.S.occasions||{},
    ms: App.S.ms||108, dt: App.S.dt||0, lt: App.S.lt||0, nameJapDeduct: App.S.nameJapDeduct||0, cfg: App.S.cfg||{},
    malaLog: App.S.malaLog||[], malaLogDate: App.S.tk,
    brahmacharya_start_date: App.S.brahmacharya_start_date||'',
    japMode: App.S.japMode||'radha', historyRV: App.S.historyRV||{}, timerHistoryRV: App.S.timerHistoryRV||{},
    dtRV: App.S.dtRV||0, ltRV: App.S.ltRV||0, nameJapDeductRV: App.S.nameJapDeductRV||0, malaLogRV: App.S.malaLogRV||[]
  };
  const blob = new Blob([JSON.stringify(backup,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = 'radha-naam-jap-backup-' + App.getTk() + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  toast('Backup downloaded! 🙏 Jai Radhe!');
}

function importAllData(input) {
  const file = input.files[0]; if (!file) return;
  const st = document.getElementById('restoreStatus');
  if (st) st.textContent = 'Reading file…';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.history) App.S.history = {...App.S.history, ...data.history};
      if (data.h28) App.S.h28 = {...App.S.h28, ...data.h28};
      if (data.timerHistory) App.S.timerHistory = {...App.S.timerHistory, ...data.timerHistory};
      if (data.timer28History) App.S.timer28History = {...App.S.timer28History, ...data.timer28History};
      if (data.stotrams) App.S.stotrams = {...App.S.stotrams, ...data.stotrams};
      if (data.brahma) App.S.brahma = {...App.S.brahma, ...data.brahma};
      if (data.customSt) App.S.customSt = data.customSt;
      if (data.sankalpas) App.S.sankalpas = data.sankalpas;
      if (data.occasions) App.S.occasions = {...App.S.occasions, ...data.occasions};
      if (data.ms) App.S.ms = data.ms;
      if (data.dt !== undefined) App.S.dt = data.dt;
      if (data.lt !== undefined) App.S.lt = data.lt;
      if (data.nameJapDeduct !== undefined) App.S.nameJapDeduct = data.nameJapDeduct;
      if (data.cfg) App.S.cfg = {...App.S.cfg, ...data.cfg};
      if (data.historyRV) App.S.historyRV = {...App.S.historyRV, ...data.historyRV};
      if (data.timerHistoryRV) App.S.timerHistoryRV = {...App.S.timerHistoryRV, ...data.timerHistoryRV};
      if (data.japMode) App.S.japMode = data.japMode;
      if (data.dtRV !== undefined) App.S.dtRV = data.dtRV;
      if (data.ltRV !== undefined) App.S.ltRV = data.ltRV;
      if (data.nameJapDeductRV !== undefined) App.S.nameJapDeductRV = data.nameJapDeductRV;
      if (data.malaLogRV) App.S.malaLogRV = data.malaLogRV;
      App.S.syncBaseline = JSON.parse(JSON.stringify(App.S.history));
      App.S.syncBaseline28 = JSON.parse(JSON.stringify(App.S.h28));
      App.S.syncBaselineTimer = JSON.parse(JSON.stringify(App.S.timerHistory));
      App.S.syncBaselineTimer28 = JSON.parse(JSON.stringify(App.S.timer28History));
      App.save();
      switchJapMode(App.S.japMode || 'radha');
      renderSt(); u28(); renderBcal(); renderCal(); uStats(); renderSankalpas(); renderMalaLog();
      App.lmc = Math.floor((App.S.history[App.S.tk]||0) / (App.S.ms||108));
      App.lm28 = Math.floor((App.S.h28[App.S.tk]||0) / (App.S.ms||108));
      if (st) { st.textContent = '✅ Data restored successfully! 🙏 Jai Radhe!'; st.style.color = 'var(--green)'; }
      toast('All data restored! 🙏 Jai Radhe!');
      input.value = '';
    } catch(err) {
      if (st) { st.textContent = '❌ Could not read file: ' + err.message; st.style.color = 'var(--red)'; }
    }
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════
// DIVINE CELEBRATION — Morpankh & Golden Particles
// ═══════════════════════════════════════════════
function spawnDivineCelebration() {
  const tz = document.getElementById('tz');
  if (!tz) return;
  const rect = tz.getBoundingClientRect();
  const feathers = ['🪶','✨','🦚','💫','⭐'];
  
  // Spawn 25 particles
  for (let i = 0; i < 25; i++) {
    const el = document.createElement('div');
    const isFeather = i < 10;
    el.className = 'divine-particle ' + (isFeather ? 'feather' : 'golden');
    const angle = (Math.PI * 2 * i) / 25;
    const dist = 60 + Math.random() * 100;
    el.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    el.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.animationDelay = (Math.random() * 0.5) + 's';
    if (isFeather) el.textContent = feathers[i % feathers.length];
    tz.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  
  // Sacred vibration pattern for milestone
  if (navigator.vibrate) {
    try { navigator.vibrate([100, 50, 100, 50, 200, 100, 300]); } catch(e) {}
  }
}

// ═══════════════════════════════════════════════
// VELOCITY TRACKER
// ═══════════════════════════════════════════════
function renderVelocityTracker() { /* removed */ }
// ═══════════════════════════════════════════════
// RENDER MILESTONES TAB
// ═══════════════════════════════════════════════
function renderMilestonesTab() {
  const el = document.getElementById('msContent');
  if (!el) return;
  const hist = App.S.history || {};
  const histRV = App.S.historyRV || {};
  const rawTot = Object.values(hist).reduce((a,b)=>a+b,0) + Object.values(histRV).reduce((a,b)=>a+b,0);
  const deduct = App.S.nameJapDeduct || 0;
  const total = Math.max(0, rawTot - deduct);
  const lang = window._msLang || 'hi';

  // Calculate 7-day average
  const today = new Date();
  let sum7 = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0,10);
    sum7 += (hist[k]||0) + (histRV[k]||0);
  }
  const avg7 = sum7 / 7;

  // Sadhana start date
  const startInput = document.getElementById('msSadhanaStart');
  const saved = localStorage.getItem('rjap_sadhana_start');
  if (saved && startInput) startInput.value = saved;
  const sinceEl = document.getElementById('msSadhanaSince');
  if (sinceEl && saved) {
    const diff = Date.now() - new Date(saved).getTime();
    const days = Math.floor(diff/86400000);
    const yrs = Math.floor(days/365), rem = days%365, mos = Math.floor(rem/30);
    let s = '🙏 ';
    if (yrs>0) s += yrs + ' year'+(yrs>1?'s':'')+' ';
    if (mos>0) s += mos + ' month'+(mos>1?'s':'')+' ';
    s += (rem%30) + ' days of Sadhana';
    sinceEl.textContent = s;
  }

  // Build lakh milestones (1L to 130L)
  const lakhMs = [];
  const keyLakhs = [1,2,3,5,10,20,50];
  for (let l=1; l<=130; l++) {
    const count = l*100000;
    const isKey = keyLakhs.includes(l);
    const isMillion = l >= 10;
    let tier = 'bronze';
    if (l >= 10) tier = 'gold';
    else if (l >= 1 && l < 10) tier = (l<=1?'bronze': l<=5?'silver':'silver');
    if (l <= 1) tier = 'bronze';
    else if (l <= 5) tier = 'silver';
    else tier = 'gold';
    lakhMs.push({count, label: l+' Lakh', tier, isKey, isMillion: l>=10});
  }

  // Predict date
  function predictDate(remaining) {
    if (avg7 <= 0) return null;
    const daysNeeded = Math.ceil(remaining / avg7);
    const d = new Date(); d.setDate(d.getDate() + daysNeeded);
    return d.toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'});
  }

  let out = '';

  // ─── LAKH MILESTONES ───
  out += '<div class="ms-phase-title">📿 Lakh Milestones</div>';
  out += '<div class="ms-phase-sub">10K → 1 CRORE JOURNEY</div>';

  // Key lakhs as full cards
  const keyLakhData = lakhMs.filter(m => m.isKey || m.isMillion);
  keyLakhData.forEach(m => {
    if (m.count >= CRORE) return; // skip crore+, handled below
    const pct = Math.min(100, (total/m.count)*100);
    const achieved = total >= m.count;
    const remaining = Math.max(0, m.count - total);
    const pred = !achieved ? predictDate(remaining) : null;
    const tierClass = m.tier;
    const millionClass = m.isMillion ? ' million' : '';
    out += '<div class="ms-card tier-'+tierClass+(achieved?' achieved':' locked')+millionClass+'" onclick="openMsDetail(\'lakh\','+m.count+','+pct.toFixed(1)+','+achieved+')">';
    out += '<div class="ms-card-header">';
    out += '<span class="ms-icon">'+(achieved?'👑':'📿')+'</span>';
    out += '<div><div class="ms-label">'+m.label+'</div></div>';
    out += '<span class="ms-count-label">'+formatMsCount(m.count)+'</span>';
    out += '</div>';
    if (achieved) {
      out += '<div class="ms-badge achieved">✓ ACHIEVED</div>';
    } else if (pred) {
      out += '<div class="ms-badge prediction">⏳ Estimated: '+pred+'</div>';
    } else if (!achieved) {
      out += '<div class="ms-badge locked">🙏 Keep chanting to see prediction</div>';
    }
    out += '<div class="ms-pct">'+pct.toFixed(1)+'% — '+formatMsCount(total)+' / '+formatMsCount(m.count)+'</div>';
    out += '<div class="ms-progress-wrap"><div class="ms-progress-fill '+tierClass+'" style="width:'+pct+'%"></div></div>';
    out += '</div>';
  });

  // Grid for remaining lakhs
  const otherLakhs = lakhMs.filter(m => !m.isKey && !m.isMillion && m.count < CRORE);
  if (otherLakhs.length) {
    out += '<div class="ms-lakh-grid">';
    otherLakhs.forEach(m => {
      const pct = Math.min(100, (total/m.count)*100);
      const achieved = total >= m.count;
      out += '<div class="ms-lakh-card'+(achieved?' achieved':'')+'" onclick="openMsDetail(\'lakh\','+m.count+','+pct.toFixed(1)+','+achieved+')">';
      out += '<div class="ms-lakh-label">'+(achieved?'✓ ':'')+m.label+'</div>';
      out += '<div class="ms-lakh-pct">'+pct.toFixed(1)+'%</div>';
      out += '<div class="ms-progress-wrap"><div class="ms-progress-fill '+(achieved?'gold':'bronze')+'" style="width:'+pct+'%"></div></div>';
      out += '</div>';
    });
    out += '</div>';
  }

  out += '<div class="ms-section-sep"></div>';

  // ─── SPIRITUAL CRORE MILESTONES ───
  PHASES.forEach(phase => {
    out += '<div class="ms-phase-title">'+phase.name+'</div>';
    out += '<div class="ms-phase-sub">'+phase.sub+'</div>';
    SPIRITUAL_MILESTONES.filter(sm => {
      const crNum = sm.count/CRORE;
      return crNum >= phase.range[0] && crNum <= phase.range[1];
    }).forEach(sm => {
      const pct = Math.min(100, (total/sm.count)*100);
      const achieved = total >= sm.count;
      const remaining = Math.max(0, sm.count - total);
      const pred = !achieved ? predictDate(remaining) : null;
      const crNum = sm.count / CRORE;
      const isBig = crNum >= 10;
      const descHi = CRORE_DESCS_HI[crNum] || sm.desc;
      const descBn = CRORE_DESCS_BN[crNum] || '';
      const desc = lang === 'bn' && descBn ? descBn : descHi;
      out += '<div class="ms-card tier-saffron'+(achieved?' achieved':' locked')+(isBig?' million':'')+'" onclick="openMsDetail(\'crore\','+sm.count+','+pct.toFixed(1)+','+achieved+')">';
      out += '<div class="ms-card-header">';
      out += '<span class="ms-icon">'+sm.icon+'</span>';
      out += '<div><div class="ms-label">'+crNum+' Crore</div>';
      out += '<div class="ms-eng">'+sm.eng+'</div></div>';
      out += '<span class="ms-count-label">'+sm.tag+'</span>';
      out += '</div>';
      const descId = 'msDesc'+sm.count;
      out += '<div class="ms-desc'+(lang==='bn'?' bangla':'')+'" id="'+descId+'">'+desc+'</div>';
      out += '<span class="ms-read-more" onclick="event.stopPropagation();toggleMsDesc(\''+descId+'\',this)">Read more ▾</span>';
      if (achieved) {
        out += '<div class="ms-badge achieved">✓ ACHIEVED</div>';
      } else if (pred) {
        out += '<div class="ms-badge prediction">⏳ Estimated: '+pred+'</div>';
      } else {
        out += '<div class="ms-badge locked">🙏 Keep chanting to see prediction</div>';
      }
      out += '<div class="ms-pct">'+pct.toFixed(1)+'% — '+formatMsCount(total)+' / '+formatMsCount(sm.count)+'</div>';
      out += '<div class="ms-progress-wrap"><div class="ms-progress-fill saffron" style="width:'+pct+'%"></div></div>';
      out += '</div>';
    });
  });

  el.innerHTML = out;
}

// ─── CRORE DESCRIPTIONS ───
const CRORE_DESCS_HI = {
  1: 'Tanu Shuddhi: Sharir puri tarah nishpaap aur pavitra ho jata hai. Rajogun aur Tamogun ka nash hota hai, aur har samay Shuddh Satogun bana rehta hai. Har samay Bhagwan ka bhajan hota he. Bimariyon ke \'paap beej\' (root causes) khatam ho jate hain. Agar koi rog hai bhi, toh use sehne ki taqat mil jati hai. Sapne mein devta, rishi-muni aur sant, bhakta aakar baatein karte hain.',
  2: 'Dhan (Wealth): Dhan ka abhaav (lack of money) khatam ho jata hai. Sabse badi baat ye hai ki insan ke andar se ameer banne ki chah (desire) hi mit jati hai. Bhagwan do tarah se madad karte hain—ya toh desire hata dete hain, ya fir bina maange itna dhan dete hain ki chah khatam ho jaye. Jaise nadiyaan apne aap samundar mein milti hain, saara vaibhav sadhak ko gher leta hai. Return to home from abroad.',
  3: 'Mental Purity: Antahkaran param pavitra hota hai. Jo buri aadatein (kaam, krodh) pehle \'asadhy\' (impossible) lagti thi, wo aasaan ho jati hain. Pura sansaar sadhak ko sage bhai ki tarah pyar karne lagta hai.',
  4: 'Sukha Sthan: Hriday mein Bhagvadanand (Divine Bliss) prakat hota hai. Stability: Maan-apmaan ya dukh-sukh ka hriday par koi asar nahi padta. Self-Realization: Bina shastra padhe hi \'Nityatva Bodh\' ho jata hai ki \'Main nitya hoon, ye sharir anitya hai\'.',
  5: 'Divine Knowledge: Vidya ka prakaash hota hai. Sadhak ki vaani se shastra nikalne lagte hain. Material Success: Agar koi worldly cheez chahiye (putra, lambi aayu, ya dushman par vijay), toh wo turant mil jati hai.',
  6: 'Victory over Enemies: Kaam, krodh, lobh, moh, mad, aur matsarya par puri vijay. Healing: \'Dushadhya\' (incurable) rog bhi sankalp se samool vinash ho jate hain.',
  7: 'Purity from Lust: Duniya ki koi bhi apsara ya kaamini use mohit nahi kar sakti. Direct Interaction: Narad Ji aur Sanakadi jaise mahabhagwat prakat mein milkar baatein karte hain.',
  8: 'No Fear of Death: Mritiyu ka bhay khatam. Sadhak hamesha \'Atma-Singhasan\' par viraajman rehta hai.',
  9: 'Sagun Sakshatkar: Jiska naam japa (Ram, Radha, Shiv), unka sakhshat darshan hota hai. Satyavakta: Sadhak jo bolega wahi hoga. Uska kalyan ho jayega.',
  10: 'Karma Burn: Saare sanchit aur prarabdha karma bhasm ho jate hain. No Rebirth: Ab dubara janm nahi lena padega. Hriday mein itna anand hota hai ki uska varnan nahi ho sakta.',
  11: '11 Crore: Gyan, bhakti aur yog ki saari bhumikaayein aur siddhiyaan haazir ho jati hain. Gokul, Ayodhya, Kashi ki leelaon mein pravesh milta hai.',
  12: '12 Crore: Bhagwan bhakt ke adheen ho jate hain aur uske piche-piche dolte hain.',
  13: '13 Crore: Sadhak kisi bhi paapi insan ko \'Moksha\' dila sakta hai.'
};

const CRORE_DESCS_BN = {
  1: 'তনু শুদ্ধি: শরীর পুরোপুরি নিষ্পাপ ও পবিত্র হয়ে যায়। রজোগুণ ও তমোগুণ নাশ হয় এবং সর্বদা শুদ্ধ সত্যগুণ বজায় থাকে। সব সময় ভগবানের ভজন হতে থাকে। রোগের \'পাপ বীজ\' (মূল কারণ) খতম হয়ে যায়। যদি কোনো রোগ থাকেও, তবে তা সহ্য করার শক্তি পাওয়া যায়। স্বপ্নে দেবতা, ঋষি-মুনি এবং সন্ত-ভক্তরা এসে কথা বলেন।',
  2: 'ধন (সম্পদ): ধনের অভাব খতম হয়ে যায়। সবচেয়ে বড় কথা হলো মানুষের ভিতর থেকে ধনী হওয়ার তৃষ্ণা (ইচ্ছা) মিটে যায়। ভগবান দুইভাবে সাহায্য করেন—হয় ইচ্ছা সরিয়ে দেন, না হয় না চাইতেই এত ধন দেন যে ইচ্ছা শেষ হয়ে যায়। যেমন নদী নিজে থেকেই সমুদ্রে গিয়ে মেশে, তেমনই সমস্ত বৈভব সাধককে ঘিরে ধরে। বিদেশ থেকে স্বদেশে প্রত্যাবর্তন।',
  3: 'মানসিক পবিত্রতা: অন্তঃকরণ পরম পবিত্র হয়। যে খারাপ অভ্যাসগুলো (কাম, ক্রোধ) আগে \'অসাধ্য\' (অসম্ভব) মনে হতো, তা সহজ হয়ে যায়। সারা পৃথিবী সাধককে নিজের আপন ভাইয়ের মতো ভালোবাসতে শুরু করে।',
  4: 'সুখ স্থান: হৃদয়ে ভগবদানন্দ (দিব্য আনন্দ) প্রকট হয়। স্থায়িত্ব: মান-অপমান বা সুখ-দুঃখের হৃদয়ের ওপর কোনো প্রভাব পড়ে না। আত্ম-উপলব্ধি: শাস্ত্র না পড়েই \'নিত্যত্ব বোধ\' হয়ে যায় যে \'আমি নিত্য, এই শরীর অনিত্য\'।',
  5: 'দিব্য জ্ঞান: বিদ্যার প্রকাশ ঘটে। সাধকের বাণী থেকে শাস্ত্র নির্গত হতে থাকে। জাগতিক সাফল্য: যদি কোনো পার্থিব বস্তু (পুত্র, দীর্ঘ আয়ু, বা শত্রুর ওপর বিজয়) প্রয়োজন হয়, তবে তা তৎক্ষণাৎ মিলে যায়।',
  6: 'শত্রুর ওপর বিজয়: কাম, ক্রোধ, লোভ, মোহ, মদ এবং মাৎসর্যের ওপর পূর্ণ বিজয়। নিরাময়: \'দুসাধ্য\' (অসাধ্য) রোগও সংকল্পের মাধ্যমে সমূলে বিনাশ হয়ে যায়।',
  7: 'কামনাবাসনা থেকে মুক্তি: দুনিয়ার কোনো অপ্সরা বা কামিনী তাকে মোহিত করতে পারে না। সরাসরি আলাপচারিতা: নারদ জী এবং সনকাদির মতো মহাভাগবতরা সশরীরে এসে কথা বলেন।',
  8: 'মৃত্যুর ভয় নেই: মৃত্যুর ভয় শেষ হয়ে যায়। সাধক সর্বদা \'আত্ম-সিংহাসনে\' বিরাজমান থাকেন।',
  9: 'সগুণ সাক্ষাৎকার: যাঁর নাম জপ করা হয় (রাম, রাধা, শিব), তাঁর সাক্ষাৎ দর্শন মেলে। সত্যবক্তা: সাধক যা বলবেন তাই হবে। তার কল্যাণ হয়ে যাবে।',
  10: 'কর্ম দহন: সমস্ত সঞ্চিত এবং প্রারব্ধ কর্ম ভস্ম হয়ে যায়। পুনর্জন্ম রোধ: আর দ্বিতীয়বার জন্ম নিতে হবে না। হৃদয়ে এত আনন্দ হয় যে তার বর্ণনা করা সম্ভব নয়।',
  11: '১১ কোটি: জ্ঞান, ভক্তি ও যোগের সমস্ত ভূমিকা ও সিদ্ধি উপস্থিত হয়। গোকুল, অযোধ্যা, কাশীর লীলায় প্রবেশাধিকার মেলে।',
  12: '১২ কোটি: ভগবান ভক্তের অধীন হয়ে যান এবং তার পিছু পিছু ঘোরেন।',
  13: '১৩ কোটি: সাধক যেকোনো পাপী মানুষকেও \'মোক্ষ\' পাইয়ে দিতে পারেন।'
};

window._msLang = 'hi';
function setMsLang(lang) {
  window._msLang = lang;
  document.getElementById('msLangHi').classList.toggle('active', lang==='hi');
  document.getElementById('msLangBn').classList.toggle('active', lang==='bn');
  renderMilestonesTab();
}

function toggleMsDesc(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('expanded');
  btn.textContent = el.classList.contains('expanded') ? 'Show less ▴' : 'Read more ▾';
}

function openMsDetail(type, count, pct, achieved) {
  const sheet = document.getElementById('msDetailSheet');
  const overlay = document.getElementById('msDetailOverlay');
  if (!sheet || !overlay) return;
  const lang = window._msLang || 'hi';
  const hist = App.S.history || {};
  const histRV = App.S.historyRV || {};
  const rawTot = Object.values(hist).reduce((a,b)=>a+b,0) + Object.values(histRV).reduce((a,b)=>a+b,0);
  const total = Math.max(0, rawTot - (App.S.nameJapDeduct||0));

  let icon='📿', title='', eng='', desc='', descBn='';
  if (type === 'crore') {
    const sm = SPIRITUAL_MILESTONES.find(s => s.count === count);
    if (sm) { icon=sm.icon; title=(count/CRORE)+' Crore — '+sm.label; eng=sm.eng; desc=CRORE_DESCS_HI[count/CRORE]||sm.desc; descBn=CRORE_DESCS_BN[count/CRORE]||''; }
  } else {
    const l = count/100000;
    icon = achieved ? '👑' : '📿';
    title = l + ' Lakh Jap';
    eng = formatMsCount(count) + ' completed';
    desc = '';
  }

  // Total days calculation
  const startDate = localStorage.getItem('rjap_sadhana_start');
  let totalDays = '—';
  if (startDate) {
    const diff = Date.now() - new Date(startDate).getTime();
    totalDays = Math.floor(diff/86400000) + ' days';
  }

  // Peak day
  const allHist = {...hist};
  Object.keys(histRV).forEach(k => { allHist[k] = (allHist[k]||0) + (histRV[k]||0); });
  let peakDay = '—', peakVal = 0;
  Object.entries(allHist).forEach(([k,v]) => {
    if (v > peakVal) { peakVal = v; peakDay = k; }
  });
  if (peakVal > 0) {
    peakDay = new Date(peakDay).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) + ' ('+peakVal.toLocaleString('en-IN')+' jap)';
  }

  const displayDesc = (lang==='bn' && descBn) ? descBn : desc;

  let h = '<button class="ms-detail-close" onclick="closeMsDetail()">✕ Close</button>';
  h += '<div class="ms-detail-icon">'+icon+'</div>';
  h += '<div class="ms-detail-title">'+title+'</div>';
  h += '<div class="ms-detail-eng">'+eng+'</div>';
  if (achieved) {
    h += '<div class="ms-detail-stamp">✦ ACHIEVED ✦</div>';
  } else {
    h += '<div class="ms-detail-stamp" style="color:var(--td);font-size:14px">'+pct+'% complete</div>';
  }
  h += '<div class="ms-detail-stats">';
  h += '<div class="ms-detail-stat"><div class="val">'+totalDays+'</div><div class="lbl">Journey Duration</div></div>';
  h += '<div class="ms-detail-stat"><div class="val">'+peakDay.split(' (')[0]+'</div><div class="lbl">Peak Day</div></div>';
  h += '<div class="ms-detail-stat"><div class="val">'+formatMsCount(total)+'</div><div class="lbl">Total Jap</div></div>';
  h += '<div class="ms-detail-stat"><div class="val">'+pct+'%</div><div class="lbl">Progress</div></div>';
  h += '</div>';
  if (displayDesc) {
    h += '<div class="ms-detail-desc'+(lang==='bn'?' bangla':'')+'">'+displayDesc+'</div>';
  }
  sheet.innerHTML = h;
  overlay.classList.add('show');

  // Fire confetti for achieved milestones
  if (achieved && typeof confetti === 'function') {
    confetti({particleCount:80, spread:70, colors:['#FFD700','#FF9933','#FFA500'], origin:{y:0.7}});
  }
}

function closeMsDetail() {
  document.getElementById('msDetailOverlay').classList.remove('show');
}

function renderLakhGati2() { renderMilestonesTab(); }



// ═══════════════════════════════════════════════════════
// FIREBASE — Google Sign-In Only (no email/password)
// ═══════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyCvvXEdsJjXpTbITE2HuyYFnPZfZIkxVWA",
  authDomain: "guru-kripahi-kevalam-108.firebaseapp.com",
  projectId: "guru-kripahi-kevalam-108",
  storageBucket: "guru-kripahi-kevalam-108.firebasestorage.app",
  messagingSenderId: "368485403238",
  appId: "1:368485403238:web:a3ab5c1427ad0c40fffba7",
  measurementId: "G-SJP0N1FDZD"
};

let fbApp = null, fbAuth = null, fbDb = null, fbUser = null;
let fbListener = null;
let fbDeviceId = (function() {
  let id = localStorage.getItem('rjap_device_id');
  if (!id) { id = 'dev_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); localStorage.setItem('rjap_device_id', id); }
  return id;
})();

let fbSessionListener = null;

// ── Single-device session enforcement ──
async function fbClaimSession() {
  if (!fbUser || !fbDb) return;
  const sessionRef = fbDb.collection('users').doc(fbUser.uid).collection('session').doc('active');
  try {
    await sessionRef.set({
      deviceId: fbDeviceId,
      signedInAt: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent.slice(0, 120)
    });
    console.log('Session claimed by device:', fbDeviceId);
  } catch(e) { console.warn('Failed to claim session:', e.message); }
}

let fbForcedSignout = false;

function lockSignedOutScreen() {
  fbForcedSignout = true;
  if (fbSessionListener) { fbSessionListener(); fbSessionListener = null; }
  if (fbListener) { fbListener(); fbListener = null; }
  gdAccessToken = null;
  localStorage.removeItem('rjap_gd_token');
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;padding:0;background:#000;';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font:600 20px system-ui;padding:24px;z-index:999999;';
  overlay.innerHTML = '<div style="font-size:48px;margin-bottom:24px;">⚠️</div>' +
    '<div style="margin-bottom:12px;">Another device has signed in.</div>' +
    '<div style="font-size:14px;color:#888;">This session has been permanently signed out.<br>Please close this tab or refresh to sign in again.</div>';
  document.body.appendChild(overlay);
  fbAuth.signOut().catch(() => {});
}

function fbWatchSession() {
  if (fbSessionListener) { fbSessionListener(); fbSessionListener = null; }
  if (!fbUser || !fbDb) return;
  const sessionRef = fbDb.collection('users').doc(fbUser.uid).collection('session').doc('active');
  fbSessionListener = sessionRef.onSnapshot(snap => {
    if (!snap.exists) return;
    const data = snap.data();
    if (data.deviceId && data.deviceId !== fbDeviceId) {
      console.log('Another device signed in (' + data.deviceId + '). Locking this device.');
      lockSignedOutScreen();
    }
  }, err => console.warn('Session listener error:', err.message));
}


function fbInit() {
  if (fbApp) return true;
  if (typeof firebase === 'undefined') {
    if (!fbInit._r) fbInit._r = 0;
    if (fbInit._r++ < 10) { setTimeout(fbInit, 300); }
    return false;
  }
  try {
    fbApp = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbDb.enablePersistence({synchronizeTabs:false}).catch(() => {});
    // Handle redirect sign-in result (for in-app browsers that used signInWithRedirect)
    fbAuth.getRedirectResult().then(result => {
      if (result && result.credential && result.credential.accessToken) {
        gdAccessToken = result.credential.accessToken;
        localStorage.setItem('rjap_gd_token', gdAccessToken);
        toast('Signed in with Google! ☁️ Drive backup active 🙏');
      }
    }).catch(e => {
      // Ignore errors here — redirect result may simply not exist
      console.warn('getRedirectResult:', e.message);
    });

    fbAuth.onAuthStateChanged(user => {
      if (fbForcedSignout) { lockSignedOutScreen(); return; }
      fbUser = user;
      if (user) {
        document.getElementById('fbLoggedOut').style.display = 'none';
        document.getElementById('fbLoggedIn').style.display = 'block';
        document.getElementById('fbUserEmail').textContent = user.email || user.displayName || 'Google User';
        setSyncPill('syncing', 'Connecting…');
        // Single-device: claim this session & watch for other devices
        fbClaimSession().then(() => {
          fbWatchSession();
          // Pull data from Firebase on sign-in
          fbAutoSync();
        });
      } else {
        document.getElementById('fbLoggedOut').style.display = 'block';
        document.getElementById('fbLoggedIn').style.display = 'none';
        // Clean up session listener on sign out
        if (fbSessionListener) { fbSessionListener(); fbSessionListener = null; }
      }
    });
    return true;
  } catch(e) {
    console.error('Firebase init:', e);
    return false;
  }
}

// ── Single "Sign in with Google" button ──
function fbSignInGoogle() {
  if (!fbInit()) { toast('Firebase not ready. Check your connection.'); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');

  // Try popup first; if it fails (in-app browsers, storage-partitioned envs), fall back to redirect
  fbAuth.signInWithPopup(provider)
    .then(result => {
      const credential = result.credential;
      if (credential && credential.accessToken) {
        gdAccessToken = credential.accessToken;
        localStorage.setItem('rjap_gd_token', gdAccessToken);
      }
      toast('Signed in with Google! ☁️ Drive backup active 🙏');
    })
    .catch(e => {
      // Popup blocked or storage partitioned (e.g. Facebook in-app browser)
      if (
        e.code === 'auth/popup-blocked' ||
        e.code === 'auth/popup-closed-by-user' ||
        e.code === 'auth/cancelled-popup-request' ||
        e.message.includes('sessionStorage') ||
        e.message.includes('initial state') ||
        e.message.includes('storage-partitioned')
      ) {
        // Inform user and open in external browser instead
        toast('Opening in your browser for sign-in…');
        setTimeout(() => {
          // Try redirect as fallback
          try {
            fbAuth.signInWithRedirect(provider);
          } catch(err) {
            // If even redirect fails (rare), show helpful message
            const el = document.getElementById('fbErr');
            if (el) {
              el.textContent = 'Please open this app in Chrome or Safari (not inside Facebook/WhatsApp) to sign in.';
              setTimeout(() => el.textContent = '', 8000);
            }
          }
        }, 1000);
      } else {
        const el = document.getElementById('fbErr');
        if (el) { el.textContent = e.message; setTimeout(() => el.textContent = '', 5000); }
      }
    });
}

// ── Sign in with Zoho (OIDC provider) ──
function fbSignInZoho() {
  if (!fbInit()) { toast('Firebase not ready. Check your connection.'); return; }
  const provider = new firebase.auth.OAuthProvider('oidc.zoho');
  
  fbAuth.signInWithPopup(provider)
    .then(result => {
      toast('Signed in with Zoho! ☁️ Cloud sync active 🙏');
    })
    .catch(e => {
      if (
        e.code === 'auth/popup-blocked' ||
        e.code === 'auth/popup-closed-by-user' ||
        e.code === 'auth/cancelled-popup-request'
      ) {
        toast('Opening in your browser for Zoho sign-in…');
        setTimeout(() => {
          try {
            fbAuth.signInWithRedirect(provider);
          } catch(err) {
            const el = document.getElementById('fbErr');
            if (el) {
              el.textContent = 'Please open this app in Chrome or Safari to sign in with Zoho.';
              setTimeout(() => el.textContent = '', 8000);
            }
          }
        }, 1000);
      } else {
        const el = document.getElementById('fbErr');
        if (el) { el.textContent = e.message; setTimeout(() => el.textContent = '', 5000); }
      }
    });
}

function fbSignOut() {
  if (!fbAuth) return;
  if (fbSessionListener) { fbSessionListener(); fbSessionListener = null; }
  if (fbListener) { fbListener(); fbListener = null; }
  gdAccessToken = null;
  localStorage.removeItem('rjap_gd_token');
  fbAuth.signOut().then(() => toast('Signed out 🙏'));
}

// ── Firestore Full-State Sync ──
async function fbPushDelta() {
  return fbPushFull();
}

async function fbPushFull() {
  if (!fbUser) return;
  setSyncPill('syncing', 'Syncing…');
  const payload = {
    history: App.S.history||{}, h28: App.S.h28||{}, stotrams: App.S.stotrams||{},
    brahma: App.S.brahma||{}, customSt: App.S.customSt||[], timerHistory: App.S.timerHistory||{},
    timer28History: App.S.timer28History||{},
    sankalpas: App.S.sankalpas||[], occasions: App.S.occasions||{},
    ms: App.S.ms||108, dt: App.S.dt||0, lt: App.S.lt||0, nameJapDeduct: App.S.nameJapDeduct||0, cfg: App.S.cfg||{},
    malaLog: App.S.malaLog||[], malaLogDate: App.S.tk,
    brahmacharya_start_date: App.S.brahmacharya_start_date||'',
    japMode: App.S.japMode||'radha', historyRV: App.S.historyRV||{}, timerHistoryRV: App.S.timerHistoryRV||{},
    dtRV: App.S.dtRV||0, ltRV: App.S.ltRV||0, nameJapDeductRV: App.S.nameJapDeductRV||0, malaLogRV: App.S.malaLogRV||[],
    brahmacharya_start_date: App.S.brahmacharya_start_date||'',
    lastSync: firebase.firestore.FieldValue.serverTimestamp(),
    deviceId: fbDeviceId
  };
  try {
    await fbDb.collection('users').doc(fbUser.uid).collection('data').doc('main').set(payload);
    App.S.syncBaseline = JSON.parse(JSON.stringify(App.S.history||{}));
    App.S.syncBaseline28 = JSON.parse(JSON.stringify(App.S.h28||{}));
    App.S.syncBaselineTimer = JSON.parse(JSON.stringify(App.S.timerHistory||{}));
    App.S.syncBaselineTimer28 = JSON.parse(JSON.stringify(App.S.timer28History||{}));
    App._suspendCloudSync = true;
    await App.save();
    App._suspendCloudSync = false;
    setSyncPill('', '☁️ Synced ' + new Date().toLocaleTimeString());
  } catch(e) {
    App._suspendCloudSync = false;
    console.warn('Full sync failed:', e.message);
    setSyncPill('error', 'Sync failed');
  }
}

function fbApplyRemote(d) {
  if (d.deviceId && d.deviceId === fbDeviceId) return;
  if ('history' in d) App.S.history = JSON.parse(JSON.stringify(d.history || {}));
  if ('h28' in d) App.S.h28 = JSON.parse(JSON.stringify(d.h28 || {}));
  if ('timerHistory' in d) App.S.timerHistory = JSON.parse(JSON.stringify(d.timerHistory || {}));
  if ('timer28History' in d) App.S.timer28History = JSON.parse(JSON.stringify(d.timer28History || {}));
  if ('stotrams' in d) App.S.stotrams = JSON.parse(JSON.stringify(d.stotrams || {}));
  if ('brahma' in d) App.S.brahma = JSON.parse(JSON.stringify(d.brahma || {}));
  if ('customSt' in d) App.S.customSt = JSON.parse(JSON.stringify(d.customSt || []));
  if ('sankalpas' in d) App.S.sankalpas = JSON.parse(JSON.stringify(d.sankalpas || []));
  if ('occasions' in d) App.S.occasions = JSON.parse(JSON.stringify(d.occasions || {}));
  // Only apply malaLog from Firebase if it belongs to today AND local today has jap
  if ('malaLog' in d) {
    const remoteMalaLog = d.malaLog || [];
    const remoteMalaDate = d.malaLogDate || null;
    const localTodayJap = App.S.history[App.S.tk] || 0;
    if (remoteMalaDate === App.S.tk && localTodayJap > 0) {
      App.S.malaLog = JSON.parse(JSON.stringify(remoteMalaLog));
    } else {
      // Remote log is stale or no jap done today — clear it
      App.S.malaLog = [];
    }
  }
  if (d.ms) App.S.ms = d.ms;
  if (d.dt !== undefined) App.S.dt = d.dt;
  if (d.lt !== undefined) App.S.lt = d.lt;
  if (d.nameJapDeduct !== undefined) App.S.nameJapDeduct = d.nameJapDeduct;
  if (d.cfg) App.S.cfg = JSON.parse(JSON.stringify(d.cfg || {}));
  if ('historyRV' in d) App.S.historyRV = JSON.parse(JSON.stringify(d.historyRV || {}));
  if ('timerHistoryRV' in d) App.S.timerHistoryRV = JSON.parse(JSON.stringify(d.timerHistoryRV || {}));
  if (d.japMode) App.S.japMode = d.japMode;
  if (d.dtRV !== undefined) App.S.dtRV = d.dtRV;
  if (d.ltRV !== undefined) App.S.ltRV = d.ltRV;
  if (d.nameJapDeductRV !== undefined) App.S.nameJapDeductRV = d.nameJapDeductRV;
  if (d.brahmacharya_start_date) App.S.brahmacharya_start_date = d.brahmacharya_start_date;
  // Only apply malaLogRV from Firebase if it belongs to today AND local today has RV jap
  if ('malaLogRV' in d) {
    const remoteMalaLogRV = d.malaLogRV || [];
    const remoteMalaDate = d.malaLogDate || null;
    const localTodayRVJap = App.S.historyRV[App.S.tk] || 0;
    if (remoteMalaDate === App.S.tk && localTodayRVJap > 0) {
      App.S.malaLogRV = JSON.parse(JSON.stringify(remoteMalaLogRV));
    } else {
      App.S.malaLogRV = [];
    }
  }
  if (!App.S.historyRV) App.S.historyRV = {};
  if (!App.S.timerHistoryRV) App.S.timerHistoryRV = {};
  if (!App.S.historyRV[App.S.tk]) App.S.historyRV[App.S.tk] = 0;
  if (!App.S.timerHistoryRV[App.S.tk]) App.S.timerHistoryRV[App.S.tk] = 0;
  if (!App.S.history[App.S.tk]) App.S.history[App.S.tk] = 0;
  if (!App.S.h28[App.S.tk]) App.S.h28[App.S.tk] = 0;
  if (!App.S.timerHistory[App.S.tk]) App.S.timerHistory[App.S.tk] = 0;
  if (!App.S.timer28History[App.S.tk]) App.S.timer28History[App.S.tk] = 0;
  App.S.syncBaseline = JSON.parse(JSON.stringify(App.S.history||{}));
  App.S.syncBaseline28 = JSON.parse(JSON.stringify(App.S.h28||{}));
  App.S.syncBaselineTimer = JSON.parse(JSON.stringify(App.S.timerHistory||{}));
  App.S.syncBaselineTimer28 = JSON.parse(JSON.stringify(App.S.timer28History||{}));
  App._suspendCloudSync = true;
  App.save().finally(() => { App._suspendCloudSync = false; });
  App.lmc = Math.floor(App.gTod() / (App.S.ms||108));
  App.lm28 = Math.floor((App.S.h28[App.S.tk]||0) / (App.S.ms||108));
  switchJapMode(App.S.japMode || 'radha');
  renderSt(); u28(); renderBcal(); renderCal(); uStats(); renderSankalpas(); renderMalaLog();
  setSyncPill('', '🔄 Synced from cloud');
}

async function fbMigrate() {
  if (App.S.migrationV2Done) return;
  try {
    const docRef = fbDb.collection('users').doc(fbUser.uid).collection('data').doc('main');
    const snap = await docRef.get();
    if (!snap.exists) { await fbPushFull(); }
    else { fbApplyRemote({...snap.data(), deviceId: null}); await fbPushFull(); }
    App.S.migrationV2Done = true;
    App.save();
    setSyncPill('', '✅ Sync ready');
  } catch(e) { console.warn('Migration:', e.message); }
}

function fbAutoSync() {
  if (fbListener) { fbListener(); fbListener = null; }
  setTimeout(() => fbMigrate(), 1500);
  try {
    const docRef = fbDb.collection('users').doc(fbUser.uid).collection('data').doc('main');
    fbListener = docRef.onSnapshot(snap => {
      if (!snap.exists) return;
      fbApplyRemote(snap.data());
    }, err => console.warn('Listener:', err.message));
  } catch(e) { console.warn('Could not start listener:', e.message); }
}

let _fbDeb = null;
function fbDebouncedPush() {
  if (!fbUser) return;
  clearTimeout(_fbDeb);
  _fbDeb = setTimeout(() => fbPushDelta(), 3000);
}

// ═══════════════════════════════════════════════════════
// GOOGLE DRIVE — Silent Monk Auto Backup
// Uses the access token from Google Sign-In (same login)
// ═══════════════════════════════════════════════════════
const GDRIVE_FILENAME = 'radha-naam-jap-backup.json';
let gdAccessToken = localStorage.getItem('rjap_gd_token') || null;

async function gdDriveSilentBackup() {
  if (!gdAccessToken) return; // Not signed in with Google Drive scope
  try {
    const data = JSON.stringify({
      version: 3, exportedAt: new Date().toISOString(),
      history: App.S.history||{}, h28: App.S.h28||{},
      timerHistory: App.S.timerHistory||{}, timer28History: App.S.timer28History||{},
      stotrams: App.S.stotrams||{}, brahma: App.S.brahma||{}, customSt: App.S.customSt||[],
      sankalpas: App.S.sankalpas||[], occasions: App.S.occasions||{},
      ms: App.S.ms||108, dt: App.S.dt||0, lt: App.S.lt||0, nameJapDeduct: App.S.nameJapDeduct||0, cfg: App.S.cfg||{},
      malaLog: App.S.malaLog||[], malaLogDate: App.S.tk,
      japMode: App.S.japMode||'radha', historyRV: App.S.historyRV||{}, timerHistoryRV: App.S.timerHistoryRV||{},
      dtRV: App.S.dtRV||0, ltRV: App.S.ltRV||0, nameJapDeductRV: App.S.nameJapDeductRV||0, malaLogRV: App.S.malaLogRV||[]
    }, null, 2);
    // Find existing file
    const listResp = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("name='" + GDRIVE_FILENAME + "' and trashed=false") + '&spaces=drive&fields=files(id)',
      { headers: { 'Authorization': 'Bearer ' + gdAccessToken } }
    );
    if (!listResp.ok) { gdAccessToken = null; return; } // Token expired
    const listData = await listResp.json();
    const fileId = listData.files && listData.files.length ? listData.files[0].id : null;
    const boundary = 'rjap_' + Date.now();
    const metadata = JSON.stringify({ name: GDRIVE_FILENAME, mimeType: 'application/json' });
    const body = '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+metadata+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+data+'\r\n--'+boundary+'--';
    const method = fileId ? 'PATCH' : 'POST';
    const url = fileId
      ? 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=multipart'
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const uploadResp = await fetch(url, {
      method, headers: { 'Authorization': 'Bearer ' + gdAccessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });
    if (uploadResp.ok) setSyncPill('', '☁️ Drive backed up ' + new Date().toLocaleTimeString());
    else if (uploadResp.status === 401) { gdAccessToken = null; localStorage.removeItem('rjap_gd_token'); }
  } catch(e) { console.warn('Drive backup failed:', e.message); }
}




// ═══════════════════════════════════════════════════════
// 28 NAMES, SANKALP, STOTRAM, BRAHMACHARYA, CALENDAR
// (same logic as original, using App.S instead of S)
// ═══════════════════════════════════════════════════════

const NAMES28 = [
  {num:'১', name:'রাধা', meaning:'The Supreme Beloved'},
  {num:'২', name:'রাসেশ্বরী', meaning:'Goddess of the Rasa dance'},
  {num:'৩', name:'রম্যা', meaning:'The most beautiful & delightful'},
  {num:'৪', name:'শ্রীকৃষ্ণমন্ত্রাধিদেবতা', meaning:'Presiding deity of Krishna-mantra'},
  {num:'৫', name:'সর্বাদ্যা', meaning:'The primordial, first of all'},
  {num:'৬', name:'সর্ববন্দ্যা', meaning:'Worthy of worship by all'},
  {num:'৭', name:'বৃন্দাবনবিহারিণী', meaning:'Who plays in Vrindavan'},
  {num:'৮', name:'বৃন্দারাধ্যা', meaning:'Worshipped by Vrinda Devi'},
  {num:'৯', name:'রমা', meaning:'The blissful one'},
  {num:'১০', name:'অশেষগোপীমণ্ডলপূজিতা', meaning:'Worshipped by all the gopis'},
  {num:'১১', name:'সত্যা', meaning:'The eternal Truth'},
  {num:'১২', name:'সত্যপরা', meaning:'Supreme among the truthful'},
  {num:'১৩', name:'সত্যভামা', meaning:'True and lustrous one'},
  {num:'১৪', name:'শ্রীকৃষ্ণবল্লভা', meaning:'The beloved of Shri Krishna'},
  {num:'১৫', name:'বৃষভানুসুতা', meaning:'Daughter of King Vrishabhanu'},
  {num:'১৬', name:'গোপী', meaning:'The divine cowherd girl'},
  {num:'১৭', name:'মূলপ্রকৃতি', meaning:'The primordial nature'},
  {num:'১৮', name:'ঈশ্বরী', meaning:'The supreme goddess'},
  {num:'১৯', name:'গান্ধর্বা', meaning:'Goddess of divine music'},
  {num:'২০', name:'রাধিকা', meaning:'She who worships Krishna'},
  {num:'২১', name:'আরম্যা', meaning:'Noble, honoured one'},
  {num:'২২', name:'রুক্মিণী', meaning:'Adorned with gold'},
  {num:'২৩', name:'পরমেশ্বরী', meaning:'The supreme ruler'},
  {num:'২৪', name:'পরাৎপরতরা', meaning:'Beyond the beyond'},
  {num:'২৫', name:'পূর্ণা', meaning:'The complete, perfect one'},
  {num:'২৬', name:'পূর্ণচন্দ্রনিভাননা', meaning:'Face like the full moon'},
  {num:'২৭', name:'ভুক্তিমুক্তিপ্রদা', meaning:'Giver of enjoyment & liberation'},
  {num:'২৮', name:'ভবব্যাধিবিনাশিনী', meaning:'Destroyer of worldly suffering'}
];

function get28Pos() { return (App.S.h28[App.S.tk]||0) % 28; }

function render28Dots(pos) {
  const pg = document.getElementById('n28prog'); if (!pg) return; pg.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const d = document.createElement('div');
    d.className = 'n28dot' + (i < pos ? ' done' : (i === pos ? ' current' : ''));
    pg.appendChild(d);
  }
}

function u28() {
  const tod = App.S.h28[App.S.tk]||0;
  const tot = Object.values(App.S.h28).reduce((a,b) => a+b, 0);
  const cycles28 = Math.floor(tot/28);
  const todEl = document.getElementById('n28t'); if (todEl) todEl.textContent = tod;
  const pos = get28Pos(), entry = NAMES28[pos];
  const nameEl = document.getElementById('n28name');
  const meanEl = document.getElementById('n28meaning'), cycEl = document.getElementById('n28cycle');
  const isCompleting = !!App._n28CompletionAnimating;
  if (nameEl) {
    if (isCompleting) {
      nameEl.style.animation = 'none';
      nameEl.textContent = '';
    } else {
      nameEl.style.animation = 'none';
      nameEl.offsetHeight;
      nameEl.style.animation = 'nameIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards';
      nameEl.textContent = entry.name;
    }
  }
  if (meanEl) meanEl.textContent = isCompleting ? '' : entry.meaning;
  const cc = Math.floor(tod/28);
  if (cycEl) { cycEl.textContent = tod===0 ? 'Tap to begin · Cycle 1' : pos===0&&tod>0 ? '✨ Cycle '+(cc+1)+' begins!' : 'Cycle '+(cc+1)+' · '+pos+'/28 done'; }
  render28Dots(pos);
  renderSankalpas();
  // Show today's accumulated 28-Names time in Total Timer if not currently running
  if (!App._n28TimerInterval) {
    const fmt28 = s => Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60);
    const saved28 = App.S.timer28History[App.S.tk] || 0;
    const te = document.getElementById('n28TotalTimer');
    if (te && saved28 > 0) te.textContent = fmt28(saved28);
  }
  App._upd28PauseBtn();
  refresh28StatsIfOpen();
}

function spawnName28(e, nameText) {
  const zone = document.getElementById('tz28');
  const r = zone.getBoundingClientRect();
  let x, y;
  if (e.touches && e.touches[0]) { x = e.touches[0].clientX-r.left; y = e.touches[0].clientY-r.top; }
  else { x = e.clientX-r.left; y = e.clientY-r.top; }
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;font-family:serif;pointer-events:none;z-index:10;font-size:' + (22+Math.random()*16).toFixed(0) + 'px;color:rgba(255,215,0,0.65);text-shadow:0 0 8px rgba(255,215,0,0.5);left:'+(x-40)+'px;top:'+(y-10)+'px;animation:fu28 1.8s ease-out forwards;white-space:nowrap';
  el.textContent = nameText;
  zone.appendChild(el); setTimeout(() => el.remove(), 1800);
}

function cycleDone28() {
  // Capture cycle time before resetting
  const cycleTimeSec = App._n28CycleStart
    ? Math.floor((Date.now() - App._n28CycleStart) / 1000) : 0;
  const fmtCyc = s => Math.floor(s/60)+'m '+(s%60)+'s';
  App._n28CompletionAnimating = true;
  clearTimeout(App._n28CompletionTimer);

  App.resetCycleTimer28();

  // Show Radha Vallabh / Sri Harivangsa animation
  const mf28 = document.getElementById('mf28');
  if (mf28) mf28.classList.add('show');
  App._n28CompletionTimer = setTimeout(() => {
    if (mf28) mf28.classList.remove('show');
    App._n28CompletionAnimating = false;
    App._n28CompletionTimer = null;
    u28();
  }, 3000);

  // Show cycle time floating animation
  if (cycleTimeSec > 0) {
    const te = document.getElementById('n28CycleTimer');
    if (te) {
      const rect = te.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'mala-time-float';
      el.textContent = '📿 ' + fmtCyc(cycleTimeSec);
      el.style.fontSize = '20px';
      el.style.left = (rect.left + rect.width / 2 - 40) + 'px';
      el.style.top = (rect.top - 4) + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2100);
    }
  }

  // Stop total timer, reset cycle timer to zero
  App.flush28TimeToHistory();
  clearInterval(App._n28TimerInterval);
  App._n28TimerInterval = null;
  clearTimeout(App._n28AutoPauseTimeout);
  App._n28AutoPauseTimeout = null;
  App._n28CycleStart = null;
  App._n28TotalStart = null;
  App._n28SavedSecs = 0;
  App._n28Paused = false;
  App._n28PausedCycleSec = 0;
  App._n28PausedTotalSec = 0;
  const ce = document.getElementById('n28CycleTimer');
  if (ce) ce.textContent = '0:00';
  // Show accumulated total time (frozen)
  const fmt28t = s => Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60);
  const todaySec = App.S.timer28History[App.S.tk] || 0;
  const teDisp = document.getElementById('n28TotalTimer');
  if (teDisp) teDisp.textContent = fmt28t(todaySec);
  App._upd28PauseBtn();

  const zone = document.getElementById('tz28');
  zone.style.background = 'radial-gradient(ellipse at center,rgba(255,215,0,0.25) 0%,rgba(6,13,31,0.6) 100%)';
  setTimeout(() => zone.style.background = '', 600);
  const active = getActiveSankalp();
  let fulfilled = false;
  if (active && active.startCycles !== null) {
    const prog = (active._savedProgress||0) + Math.max(0, getTotalCycles28() - active.startCycles);
    if (prog >= active.target) { active.done = true; active.doneDate = App.S.tk; fulfilled = true; activateNextSankalp(); }
  }
  if (fulfilled) { App.save(); fbDebouncedPush(); renderSankalpas(); toast('🌟 Sankalp fulfilled! Jai Radhe Radhe! 🙏'); }
  else { toast('🌸 Cycle complete! राधे राधे 🙏'); }
  if (navigator.vibrate) navigator.vibrate([80,40,80,40,200]);
}

// ── Sankalp ──
function getTotalCycles28() { return Math.floor(Object.values(App.S.h28).reduce((a,b)=>a+b,0)/28); }
function getActiveSankalp() { return (App.S.sankalpas||[]).find(s=>!s.done)||null; }
function activateNextSankalp() {
  const next=(App.S.sankalpas||[]).find(s=>!s.done);
  if(next && next.startCycles===null) {
    next.startCycles = getTotalCycles28();
  }
}
function getSankalpProgress(sk) {
  const saved = sk._savedProgress || 0;
  const active = getActiveSankalp();
  if (active && active.id === sk.id) {
    if (sk.startCycles === null) return saved;
    return Math.min(saved + Math.max(0, getTotalCycles28() - sk.startCycles), sk.target);
  }
  return saved > 0 ? saved : -1;
}

function addSankalp() {
  const wish = (document.getElementById('skWish').value||'').trim();
  const target = parseInt(document.getElementById('skTarget').value)||0;
  if (!wish) { toast('ইচ্ছা লিখুন 🙏'); return; }
  if (target < 1) { toast('Please enter target cycles'); return; }
  const hasActive = (App.S.sankalpas||[]).some(s=>!s.done);
  const sk = { id:'sk_'+Date.now(), wish, target, startDate:App.S.tk, startCycles:hasActive?null:getTotalCycles28(), done:false, doneDate:null, _savedProgress:0 };
  App.S.sankalpas.push(sk);
  document.getElementById('skWish').value = '';
  document.getElementById('skTarget').value = '';
  App.save(); fbDebouncedPush(); renderSankalpas();
  toast(hasActive ? 'Queued after current wish 🌸' : 'Sankalp added! 🌸 Jai Radhe!');
}

// ── Prioritize: move wish to front, activate immediately ──
function prioritizeSankalp(id) {
  const all = App.S.sankalpas||[];
  const idx = all.findIndex(s=>s.id===id);
  if (idx<=0) return;
  const sk = all.splice(idx,1)[0];
  // Pause current active — reset its startCycles so progress is preserved
  const prevActive = all.find(s=>!s.done);
  if (prevActive && prevActive.startCycles !== null) {
    const liveProgress = Math.max(0, getTotalCycles28() - prevActive.startCycles);
    prevActive._savedProgress = (prevActive._savedProgress || 0) + liveProgress;
    prevActive.startCycles = null;
  }
  sk.startCycles = getTotalCycles28();
  all.unshift(sk);
  App.S.sankalpas = all;
  App.save(); fbDebouncedPush(); renderSankalpas();
  toast('⬆ Wish moved to front! 🌸 Jai Radhe!');
}

function getSankalpProgressById(id, list) {
  const sk = (list||App.S.sankalpas||[]).find(s=>s.id===id);
  if (!sk) return 0;
  const saved = sk._savedProgress || 0;
  if (sk.startCycles === null) return saved;
  return Math.min(saved + Math.max(0, getTotalCycles28() - sk.startCycles), sk.target);
}

// ── Edit target: update cycle count for a wish ──
function editSankalpTarget(id) {
  const sk = (App.S.sankalpas||[]).find(s=>s.id===id);
  if (!sk) return;
  const el = document.getElementById('sk-edit-'+id);
  if (!el) return;
  const newTarget = parseInt(el.value)||0;
  if (newTarget < 1) { toast('Target must be at least 1'); return; }
  const prog = getSankalpProgressById(id, null);
  if (newTarget < prog) { toast('Target cannot be less than current progress ('+prog+')'); return; }
  sk.target = newTarget;
  App.save(); fbDebouncedPush(); renderSankalpas();
  toast('Target updated to '+newTarget+' cycles 🙏');
}

function adjustSankalpCycles(id, sign) {
  const sk = (App.S.sankalpas||[]).find(s=>s.id===id);
  if (!sk) return;
  const el = document.getElementById("sk-adj-"+id);
  if (!el) return;
  const amt = parseInt(el.value)||0;
  if (amt < 1) { toast("Enter a valid number"); return; }

  const activeWish = getActiveSankalp();
  const editingActiveWish = !!activeWish && activeWish.id === id;
  const activeLiveBefore = (!editingActiveWish && activeWish && activeWish.startCycles !== null)
    ? Math.max(0, getTotalCycles28() - activeWish.startCycles)
    : null;

  // ── STEP 1: Freeze this wish's live progress into _savedProgress ──
  // This rebases startCycles so the upcoming h28 change doesn't
  // cause a double-count or under-count on the wish bar.
  if (sk.startCycles !== null) {
    const live = Math.max(0, getTotalCycles28() - sk.startCycles);
    sk._savedProgress = (sk._savedProgress || 0) + live;
    sk.startCycles = getTotalCycles28(); // will be updated again below after h28 changes
  }

  if (sign === "add") {
    // Write to h28 → shows in All Time cycles and Stats panel automatically
    if (!App.S.h28) App.S.h28 = {};
    if (!App.S.h28[App.S.tk]) App.S.h28[App.S.tk] = 0;
    App.S.h28[App.S.tk] += amt * 28;
    App.lm28 = Math.floor(App.S.h28[App.S.tk] / (App.S.ms||108));
    // Credit this wish's progress bar for exactly amt cycles
    sk._savedProgress = (sk._savedProgress || 0) + amt;
    // Rebase startCycles to new total so live taps don't re-add these cycles
    if (sk.startCycles !== null) sk.startCycles = getTotalCycles28();
  } else {
    const totalProg = getSankalpProgressById(id, null);
    if (amt > totalProg) { toast("Cannot deduct more than current progress ("+totalProg+")"); return; }
    // Deduct from h28 → Stats and All Time go down
    if (!App.S.h28[App.S.tk]) App.S.h28[App.S.tk] = 0;
    App.S.h28[App.S.tk] = Math.max(0, App.S.h28[App.S.tk] - amt * 28);
    App.lm28 = Math.floor(App.S.h28[App.S.tk] / (App.S.ms||108));
    // Remove from this wish's progress bar for exactly amt cycles
    sk._savedProgress = Math.max(0, (sk._savedProgress || 0) - amt);
    // Rebase startCycles so live taps don't re-add the deducted amount
    if (sk.startCycles !== null) sk.startCycles = getTotalCycles28();
  }

  // Rebase the ACTIVE wish's startCycles too (if different from target)
  // so it doesn't absorb the h28 change as phantom live progress
  if (!editingActiveWish && activeWish && activeWish.startCycles !== null && activeLiveBefore !== null) {
    activeWish.startCycles = Math.max(0, getTotalCycles28() - activeLiveBefore);
  }

  el.value = "";
  App.save(); fbDebouncedPush(); gdDriveSilentBackup(); renderSankalpas(); render28StatsPanel(); u28();
  toast((sign==="add"?"Added ":"Deducted ")+amt+" cycle(s) 🙏");
  const totalProg2 = getSankalpProgressById(id, null);
  if (!sk.done && totalProg2 >= sk.target) {
    sk.done = true; sk.doneDate = App.S.tk;
    activateNextSankalp();
    App.save(); fbDebouncedPush(); renderSankalpas();
    toast('🌟 Sankalp fulfilled! 🙏');
  }
}

function renderSankalpas() {
  const el = document.getElementById('skList'); if (!el) return;
  const all = App.S.sankalpas||[];
  if (!all.length) { el.innerHTML = '<div class="sk-empty">No sankalpa yet 🌸</div>'; return; }
  const nonDone = all.filter(s=>!s.done), done = all.filter(s=>s.done);
  let html = '';
  nonDone.forEach((sk,idx) => {
    const activeSk = getActiveSankalp();
    const isActive = (activeSk && activeSk.id === sk.id);
    const prog = getSankalpProgressById(sk.id, null);
    if (isActive) {
      const pct = Math.round(prog/sk.target*100);
      html += '<div class="sk-item" style="border-color:rgba(232,51,109,0.55);background:rgba(232,51,109,0.07)">'
        +'<div style="font-size:9px;color:var(--rose);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">▶ CURRENT WISH</div>'
        +'<div class="sk-wish">'+escHtml(sk.wish)+'</div>'
        +'<div class="sk-meta">Started '+sk.startDate+' · Target: <strong style="color:var(--tl)">'+sk.target+'</strong> cycles</div>'
        +'<div class="sk-bar-wrap"><div class="sk-bar'+(pct>=100?' full':'')+'" style="width:'+Math.min(pct,100)+'%"></div></div>'
        +'<div class="sk-prog-text">'+prog+' / '+sk.target+' cycles ('+pct+'%)</div>'
        // Edit target row
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:7px 9px;background:rgba(255,255,255,0.04);border-radius:8px">'
        +'<span style="font-size:11px;color:var(--td);flex:1">✏ Change target:</span>'
        +'<input id="sk-edit-'+sk.id+'" type="number" min="'+Math.max(1,prog)+'" value="'+sk.target+'" style="width:64px;background:rgba(0,0,0,0.35);border:1px solid rgba(232,51,109,0.3);border-radius:7px;padding:5px 8px;color:var(--tl);font-size:13px;text-align:center;font-family:Inter,sans-serif">'
        +'<button class="sk-btn grn" onclick="editSankalpTarget(\''+sk.id+'\')">Save</button>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:7px 9px;background:rgba(255,255,255,0.04);border-radius:8px">'
        +'<span style="font-size:11px;color:var(--td);flex:1">🔄 Adjust cycles:</span>'
        +'<input id="sk-adj-'+sk.id+'" type="number" min="1" placeholder="0" style="width:54px;background:rgba(0,0,0,0.35);border:1px solid rgba(232,51,109,0.3);border-radius:7px;padding:5px 8px;color:var(--tl);font-size:13px;text-align:center;font-family:Inter,sans-serif">'
        +'<button class="sk-btn" style="color:#4f4;border-color:rgba(0,255,0,0.3);font-size:11px" onclick="adjustSankalpCycles(\''+sk.id+'\',\'add\')">＋</button>'
        +'<button class="sk-btn" style="color:#f55;border-color:rgba(255,68,68,0.3);font-size:11px" onclick="adjustSankalpCycles(\''+sk.id+'\',\'deduct\')">－</button>'
        +'</div>'
        +'<div class="sk-btns"><button class="sk-btn grn" onclick="fulfillSankalp(\''+sk.id+'\')">✓ Fulfilled</button>'
        +'<button class="sk-btn grey" onclick="deleteSankalp(\''+sk.id+'\')">✕</button></div>'
        +'</div>';
    } else {
      const qProg = sk._savedProgress || 0;
      const qPct = sk.target > 0 ? Math.round(qProg/sk.target*100) : 0;
      html += '<div class="sk-item" style="opacity:0.85">'
        +'<div style="font-size:9px;color:var(--td);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px">⏳ QUEUED #'+(idx+1)+'</div>'
        +'<div class="sk-wish" style="color:var(--tl)">'+escHtml(sk.wish)+'</div>'
        +'<div class="sk-meta">Target: <strong style="color:var(--tl)">'+sk.target+'</strong> cycles</div>'
        +(qProg > 0 ? '<div class="sk-bar-wrap"><div class="sk-bar" style="width:'+Math.min(qPct,100)+'%"></div></div><div class="sk-prog-text">'+qProg+' / '+sk.target+' cycles ('+qPct+'%) — paused</div>' : '')
        // Edit target row for queued
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:7px 9px;background:rgba(255,255,255,0.03);border-radius:8px">'
        +'<span style="font-size:11px;color:var(--td);flex:1">✏ Change target:</span>'
        +'<input id="sk-edit-'+sk.id+'" type="number" min="1" value="'+sk.target+'" style="width:64px;background:rgba(0,0,0,0.35);border:1px solid rgba(74,144,226,0.25);border-radius:7px;padding:5px 8px;color:var(--tl);font-size:13px;text-align:center;font-family:Inter,sans-serif">'
        +'<button class="sk-btn grn" onclick="editSankalpTarget(\''+sk.id+'\')">Save</button>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:7px 9px;background:rgba(255,255,255,0.04);border-radius:8px">'
        +'<span style="font-size:11px;color:var(--td);flex:1">🔄 Adjust cycles:</span>'
        +'<input id="sk-adj-'+sk.id+'" type="number" min="1" placeholder="0" style="width:54px;background:rgba(0,0,0,0.35);border:1px solid rgba(74,144,226,0.25);border-radius:7px;padding:5px 8px;color:var(--tl);font-size:13px;text-align:center;font-family:Inter,sans-serif">'
        +'<button class="sk-btn" style="color:#4f4;border-color:rgba(0,255,0,0.3);font-size:11px" onclick="adjustSankalpCycles(\''+sk.id+'\',\'add\')">＋</button>'
        +'<button class="sk-btn" style="color:#f55;border-color:rgba(255,68,68,0.3);font-size:11px" onclick="adjustSankalpCycles(\''+sk.id+'\',\'deduct\')">－</button>'
        +'</div>'
        +'<div class="sk-btns">'
        +(idx > 0 ? '<button class="sk-btn" style="color:var(--a2);border-color:rgba(74,144,226,0.4)" onclick="prioritizeSankalp(\''+sk.id+'\')">⬆ Prioritize</button>' : '')
        +'<button class="sk-btn grey" onclick="deleteSankalp(\''+sk.id+'\')">✕</button></div>'
        +'</div>';
    }
  });
  if (done.length) {
    html += '<div class="sk-divider">✨ Fulfilled Sankalpas ✨</div>';
    done.forEach(sk => {
      html += '<div class="sk-item done">'
        +'<div class="sk-done-badge">✓ Fulfilled · '+sk.doneDate+'</div>'
        +'<div class="sk-wish" style="color:var(--td)">'+escHtml(sk.wish)+'</div>'
        +'<div class="sk-btns"><button class="sk-btn grey" onclick="deleteSankalp(\''+sk.id+'\')">✕ Remove</button></div>'
        +'</div>';
    });
  }
  el.innerHTML = html;
}

function fulfillSankalp(id) {
  const sk=(App.S.sankalpas||[]).find(s=>s.id===id);
  if(!sk)return;
  sk.done=true; sk.doneDate=App.S.tk;
  activateNextSankalp();
  App.save(); fbDebouncedPush(); renderSankalpas();
  toast('🌸 Sankalp fulfilled! Jai Radhe!');
}
function deleteSankalp(id) {
  const wasActive = getActiveSankalp()&&getActiveSankalp().id===id;
  App.S.sankalpas=(App.S.sankalpas||[]).filter(s=>s.id!==id);
  if(wasActive)activateNextSankalp();
  App.save(); fbDebouncedPush(); renderSankalpas();
  toast('Removed.');
}
function toggleSankalp() { const c=document.getElementById('skCollapse'),v=document.getElementById('skChevron'); const open=c.classList.toggle('open'); if(v)v.style.transform=open?'rotate(180deg)':'rotate(0deg)'; if(open)renderSankalpas(); }

// ═══════════════════════════════════════════════════════
// 28 NAMES STATS PANEL
// ═══════════════════════════════════════════════════════
function toggle28Stats() {
  const panel = document.getElementById('n28StatsPanel');
  const chev  = document.getElementById('n28StatsChev');
  const open   = panel.style.display === 'block';
  panel.style.display = open ? 'none' : 'block';
  if (chev) chev.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
  if (!open) render28StatsPanel();
}

// Called from u28() to keep stats panel live when open
function refresh28StatsIfOpen() {
  const panel = document.getElementById('n28StatsPanel');
  if (panel && panel.style.display === 'block') render28StatsPanel();
}

function fmt28Short(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s % 60;
  if (h > 0) return h + 'h ' + m + ':' + String(sec).padStart(2,'0');
  return m + ':' + String(sec).padStart(2,'0');
}

function render28StatsPanel() {
  const tk = App.S.tk;
  // Cycle counts — read directly from h28
  const todCycles = Math.floor((App.S.h28[tk]||0) / 28);
  const allCycles = getTotalCycles28();
  const e1 = document.getElementById('sp28CyclesTod'), e2 = document.getElementById('sp28CyclesAll');
  if (e1) e1.textContent = todCycles;
  if (e2) e2.textContent = allCycles;
  // Time — include live running session (not yet flushed)
  const savedTod = App.S.timer28History[tk] || 0;
  const liveExtra = (App._n28TotalStart && !App._n28Paused)
    ? Math.max(0, Math.floor((Date.now() - App._n28TotalStart) / 1000) - (App._n28SavedSecs || 0))
    : 0;
  const todTime = savedTod + liveExtra;
  const allTime = Object.values(App.S.timer28History).reduce((a,b)=>a+b,0) + liveExtra;
  const et = document.getElementById('sp28TimeTod'), ea = document.getElementById('sp28TimeAll');
  if (et) et.textContent = fmt28Short(todTime);
  if (ea) ea.textContent = fmt28Short(allTime);
}



// Add/deduct cycles (1 cycle = 28 taps)
// Live preview helpers
function prev28Cycles(val) {
  const n = parseInt(val)||0;
  const el = document.getElementById('sp28CyclePreview');
  if (!el) return;
  el.textContent = n > 0 ? '= ' + (n*28) + ' taps' : '';
}

function prev28Time() {
  const m = parseInt(document.getElementById('sp28TimeMin')?.value)||0;
  const s = parseInt(document.getElementById('sp28TimeSec')?.value)||0;
  const el = document.getElementById('sp28TimePreview');
  if (!el) return;
  el.textContent = (m > 0 || s > 0) ? m + 'm ' + s + 's' : '';
}

function adj28Cycles(sign) {
  const n = parseInt(document.getElementById('sp28CycleVal').value)||0;
  if (n < 1) { toast('Enter number of cycles'); return; }
  const taps = n * 28;
  const tk = App.S.tk;

  // ── Freeze ALL active wishes before touching h28 ──
  // Each wish's live progress = _savedProgress + (getTotalCycles28() - startCycles).
  // If we change h28 without freezing, every wish bar drifts by the same amount.
  // So we bake the live portion into _savedProgress first, then rebase after.
  (App.S.sankalpas||[]).filter(s => !s.done && s.startCycles !== null).forEach(s => {
    s._savedProgress = (s._savedProgress || 0) + Math.max(0, getTotalCycles28() - s.startCycles);
    s.startCycles = getTotalCycles28();
  });

  if (sign > 0) {
    App.S.h28[tk] = (App.S.h28[tk]||0) + taps;
    App.lm28 = Math.floor(App.S.h28[tk] / (App.S.ms||108));
    // Rebase all active wishes to the new global total — their bars stay put
    (App.S.sankalpas||[]).filter(s => !s.done && s.startCycles !== null).forEach(s => {
      s.startCycles = getTotalCycles28();
    });
    // Check fulfillment for active wish
    const active = getActiveSankalp();
    if (active) {
      const prog = getSankalpProgressById(active.id, null);
      if (prog >= active.target) { active.done = true; active.doneDate = tk; activateNextSankalp(); renderSankalpas(); toast('🌟 Sankalp fulfilled! 🙏'); }
    }
  } else {
    const cur = App.S.h28[tk]||0;
    if (taps > cur) { toast('Cannot deduct more than today\'s count'); return; }
    App.S.h28[tk] = cur - taps;
    App.lm28 = Math.floor(App.S.h28[tk] / (App.S.ms||108));
    // Rebase all active wishes to the new (lower) global total — bars stay put
    (App.S.sankalpas||[]).filter(s => !s.done && s.startCycles !== null).forEach(s => {
      s.startCycles = getTotalCycles28();
    });
  }

  document.getElementById('sp28CycleVal').value = '';
  const pr = document.getElementById('sp28CyclePreview'); if (pr) pr.textContent = '';
  render28StatsPanel(); u28(); uStats(); renderSankalpas();
  App.save(); fbDebouncedPush(); gdDriveSilentBackup();
  toast((sign>0?'Added ':'Deducted ')+n+' cycle'+(n>1?'s':'')+' 🙏');
}

// Add/deduct time (minutes + seconds)
function adj28Time(sign) {
  const m = parseInt(document.getElementById('sp28TimeMin').value)||0;
  const s = parseInt(document.getElementById('sp28TimeSec').value)||0;
  const secs = m*60 + Math.min(59, Math.max(0, s));
  if (secs < 1) { toast('Enter time to adjust'); return; }
  const tk = App.S.tk;
  if (sign > 0) {
    App.S.timer28History[tk] = (App.S.timer28History[tk]||0) + secs;
  } else {
    const cur = App.S.timer28History[tk]||0;
    if (secs > cur) { toast('Cannot deduct more than today\'s 28 Names time'); return; }
    App.S.timer28History[tk] = cur - secs;
  }
  // Clear inputs and preview instantly
  document.getElementById('sp28TimeMin').value = '';
  document.getElementById('sp28TimeSec').value = '';
  const pv = document.getElementById('sp28TimePreview'); if (pv) pv.textContent = '';
  // Update all displays immediately
  render28StatsPanel(); uStats();
  // Save and sync in background
  App.save(); fbDebouncedPush();
  toast((sign>0?'Added ':'Deducted ')+m+'m '+s+'s 🙏');
}


// Reset 28 Names time
function reset28Time(scope) {
  if (scope === 'today') {
    App.S.timer28History[App.S.tk] = 0;
    if (App._n28TotalStart || App._n28Paused) App.stopAll28Timers();
    toast('Today\'s 28 Names time reset 🙏');
  } else {
    App.S.timer28History = {};
    App.stopAll28Timers();
    toast('All 28 Names time reset 🙏');
  }
  // Update displays immediately
  render28StatsPanel(); uStats();
  // Save and sync in background
  App.save(); fbDebouncedPush();
}

// ── STOTRAM LIST (lyrics removed to keep file size manageable — same IDs as original) ──
const STLIST = [
  {id:'rks',name:'শ্রীরাধাকৃপাকটাক্ষস্তবরাজঃ',sub:'রাধার কৃপাদৃষ্টির প্রার্থনা'},
  {id:'gms',name:'গজেন্দ্র মোক্ষ স্তোত্রম্',sub:'মুক্তির প্রার্থনা'},
  {id:'nkc',name:'নারায়ণ কবচম',sub:'নারায়ণের দিব্য কবচ'},
  {id:'vs2',name:'শ্রী বিষ্ণু শতনাম স্তোত্রম্',sub:'বিষ্ণুর শতনাম'},
  {id:'bss',name:'বেদসার শিব স্তব',sub:'মহাদেবের স্তুতি'},
  {id:'ans',name:'অর্ধনারীশ্বরস্তোত্রম্',sub:'শিব-পার্বতীর স্তোত্র'},
  {id:'rds',name:'রুদ্রাষ্টকম্',sub:'রুদ্রের অষ্টক স্তোত্র'},
  {id:'sps',name:'শ্রী শিব পঞ্চাক্ষর স্তোত্রম্',sub:'পঞ্চাক্ষর মন্ত্রের স্তোত্র'}
];

function renderSt() {
  const list = document.getElementById('stList'); list.innerHTML = '';
  const all = [...STLIST,...(App.S.customSt||[]).map(x=>({...x,custom:true}))];
  all.forEach(st => {
    const tc = (App.S.stotrams[st.id]||{})[App.S.tk]||0;
    const tot = Object.values(App.S.stotrams[st.id]||{}).reduce((a,b)=>a+b,0);
    // Show 📖 for built-in (LYRICS[id]) OR custom with lyrics
    const hasLyrics = !!LYRICS[st.id] || (st.custom && st.lyrics && st.lyrics.trim().length > 0);
    const c = document.createElement('div'); c.className = 'stc';
    let inner = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:3px">'
      +'<span class="stn">'+escHtml(st.name)+'</span>'
      +(st.custom
        ?'<div style="display:flex;gap:5px">'
          +'<button class="dsb" style="color:var(--a2);border-color:rgba(74,144,226,0.35)" onclick="toggleStEdit(\''+st.id+'\')">✏</button>'
          +'<button class="dsb" onclick="delSt(\''+st.id+'\')">✕</button>'
          +'</div>'
        :'')
      +'</div>'
      +(st.sub?'<div class="sts">'+escHtml(st.sub)+'</div>':'')
      +'<div class="scr"><div>'
        +'<div class="scnt" id="sc'+st.id+'">'+tc+'</div>'
        +'<div class="std2">Today · Total: <strong style="color:var(--a2)">'+tot+'</strong></div>'
      +'</div>'
      +'<div class="sbtns">'
        +'<button class="sbtn m" onclick="adjSt(\''+st.id+'\',-1)">−</button>'
        +'<button class="sbtn p" onclick="adjSt(\''+st.id+'\',1)">+</button>'
        +(hasLyrics?'<button class="sbtn l" onclick="showLyrics(\''+st.id+'\')">📖</button>':'')
      +'</div></div>';
    // Edit lyrics panel (custom only) — hidden by default
    if (st.custom) {
      inner += '<div id="slePanel-'+st.id+'" style="display:none;margin-top:10px">'
        +'<div style="font-size:11px;color:var(--a2);margin-bottom:5px;letter-spacing:1px">✏ Edit Lyrics (stored in your account)</div>'
        +'<textarea id="sle-'+st.id+'" rows="8" style="width:100%;background:rgba(0,0,0,0.35);border:1px solid rgba(74,144,226,0.25);border-radius:9px;padding:9px 11px;color:var(--tl);font-size:14px;font-family:Hind Siliguri,serif;resize:vertical;line-height:1.8;box-sizing:border-box" placeholder="Paste full lyrics here…"></textarea>'
        +'<button onclick="editStLyrics(\''+st.id+'\')" style="margin-top:7px;padding:8px 18px;border-radius:9px;border:none;background:linear-gradient(135deg,var(--bg),var(--a));color:white;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">💾 Save Lyrics</button>'
        +'</div>';
    }
    c.innerHTML = inner;
    list.appendChild(c);
  });
}
function adjSt(id,d) {
  if(!App.S.stotrams[id])App.S.stotrams[id]={};
  if(!App.S.stotrams[id][App.S.tk])App.S.stotrams[id][App.S.tk]=0;
  App.S.stotrams[id][App.S.tk]=Math.max(0,App.S.stotrams[id][App.S.tk]+d);
  App.save(); fbDebouncedPush();
  const e=document.getElementById('sc'+id); if(e)e.textContent=App.S.stotrams[id][App.S.tk]; App.vib([20]);
}
function addSt() {
  const name=document.getElementById('snIn').value.trim();
  if(!name){toast('Please enter a name');return;}
  const sub=document.getElementById('ssIn').value.trim();
  const lyrics=(document.getElementById('slIn').value||'').trim();
  const id='c_'+Date.now();
  if(!App.S.customSt)App.S.customSt=[];
  App.S.customSt.push({id,name,sub,lyrics});
  if(!App.S.stotrams[id])App.S.stotrams[id]={};
  App.save(); fbDebouncedPush();
  document.getElementById('snIn').value='';
  document.getElementById('ssIn').value='';
  document.getElementById('slIn').value='';
  renderSt();
  toggleAsfForm(false); // auto-collapse after adding
  toast('Stotram added' + (lyrics?' with lyrics':'') + '! 🙏');
}

// Edit lyrics for existing custom stotram
function editStLyrics(id) {
  const st = (App.S.customSt||[]).find(x=>x.id===id);
  if(!st) return;
  const el = document.getElementById('sle-'+id);
  if(!el) return;
  st.lyrics = el.value.trim();
  App.save(); fbDebouncedPush(); renderSt();
  toast('Lyrics saved! 🙏');
}

function toggleStEdit(id) {
  const panel = document.getElementById('slePanel-'+id);
  if(!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if(!isOpen) {
    const st = (App.S.customSt||[]).find(x=>x.id===id);
    const ta = document.getElementById('sle-'+id);
    if(st && ta) ta.value = st.lyrics||'';
  }
}
function delSt(id) { App.S.customSt=(App.S.customSt||[]).filter(x=>x.id!==id); delete App.S.stotrams[id]; App.save(); fbDebouncedPush(); renderSt(); toast('Removed'); }

// ── Brahmacharya ──
function getBrahmaStart(){ return App.S.brahmacharya_start_date || '2026-03-16'; }
function confirmBrahmaStartChange(val){
  if(!val)return;
  const prev=getBrahmaStart();
  if(val===prev)return;
  if(!confirm('Changing start date will recalculate your entire Brahmacharya streak. Are you sure?')){
    document.getElementById('brahmaStartInput').value=prev; return;
  }
  App.S.brahmacharya_start_date=val;
  App.save(); fbDebouncedPush(); renderBcal();
  toast('Start date updated 🛡️');
}
function initBrahmaStartInput(){
  const el=document.getElementById('brahmaStartInput');
  if(el) el.value=getBrahmaStart();
}
let bcd = new Date();
const MN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function renderBcal() { renderCal(); }
function cbm(d){bcd.setMonth(bcd.getMonth()+d);renderBcal();}
function openBcDay(key,isBroken,cnt){
  const parts=key.split('-'), label=MN[parseInt(parts[1])-1]+' '+parseInt(parts[2])+', '+parts[0];
  document.getElementById('bcmoT').textContent=(isBroken?'❌ Broken — ':'✅ Maintained — ')+label;
  document.getElementById('bcmoD').textContent=isBroken?'Tap to restore or update.':'Tap to mark as broken.';
  document.getElementById('bcmoCnt').value=cnt||1;
  document.getElementById('bcmoBrkRow').style.display=isBroken?'none':'flex';
  document.getElementById('bcmoRst').style.display=isBroken?'':'none';
  document.getElementById('bcmoBrk').style.display=isBroken?'none':'';
  document.getElementById('bcmoBrk').onclick=function(){
    App.S.brahma[key]={status:'b',count:parseInt(document.getElementById('bcmoCnt').value)||1};
    App.save(); fbDebouncedPush(); renderBcal();
    document.getElementById('bcmo').classList.remove('show'); toast('Marked as broken 🙏');
  };
  document.getElementById('bcmoRst').onclick=function(){
    delete App.S.brahma[key];
    App.save(); fbDebouncedPush(); renderBcal();
    document.getElementById('bcmo').classList.remove('show'); toast('✅ Restored!');
  };
  document.getElementById('bcmo').classList.add('show');
}
function lb(st){
  const cnt=parseInt(document.getElementById('bci').value)||1;
  if(st==='b')App.S.brahma[App.S.tk]={status:'b',count:cnt};
  else delete App.S.brahma[App.S.tk];
  App.save(); fbDebouncedPush(); renderBcal();
  toast(st==='b'?'Logged. Keep going 🙏':'✅ Restored!');
}
function uBStats(){
  const startD=new Date(getBrahmaStart());startD.setHours(0,0,0,0);
  const todayD=new Date();todayD.setHours(0,0,0,0);
  const totalDays=Math.max(0,Math.round((todayD-startD)/86400000)+1);
  const brok=Object.values(App.S.brahma).filter(e=>e.status==='b').length;
  const maint=totalDays-brok;
  const tmc=Object.values(App.S.brahma).filter(e=>e.status==='b').reduce((s,e)=>s+e.count,0);
  const pct=totalDays>0?Math.round(maint/totalDays*100):0;
  let cs=0;const d=new Date();d.setHours(0,0,0,0);
  while(cs<999){const k=d.toISOString().split('T')[0];if(k<getBrahmaStart())break;const en=App.S.brahma[k];if(!en||en.status!=='b'){cs++;d.setDate(d.getDate()-1);}else break;}
  let bs=0,run=0;
  const allDays=[],cur=new Date(getBrahmaStart());cur.setHours(0,0,0,0);
  while(cur<=todayD){allDays.push(cur.toISOString().split('T')[0]);cur.setDate(cur.getDate()+1);}
  allDays.forEach(k=>{const en=App.S.brahma[k];if(!en||en.status!=='b'){run++;if(run>bs)bs=run;}else run=0;});
  document.getElementById('bcs').textContent=cs; document.getElementById('bbs').textContent=bs;
  document.getElementById('bbc').textContent=brok; document.getElementById('bmd').textContent=maint;
  document.getElementById('bbd').textContent=brok; document.getElementById('btm').textContent=tmc;
  document.getElementById('bmp').textContent=pct+'%';
}

// ── Calendar ──
let cald = new Date();
function renderCal(){
  const yr=cald.getFullYear(),mo=cald.getMonth();
  document.getElementById('cmy').textContent=MN[mo]+' '+yr;
  const g=document.getElementById('cg');
  while(g.children.length>7)g.removeChild(g.lastChild);
  const fd=new Date(yr,mo,1).getDay(),dim=new Date(yr,mo+1,0).getDate(),ts=App.getTk();
  for(let i=0;i<fd;i++)g.appendChild(document.createElement('div'));
  for(let d=1;d<=dim;d++){
    const key=yr+'-'+String(mo+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const cnt=(App.S.history[key]||0)+(App.S.historyRV[key]||0), timeSec=(App.S.timerHistory[key]||0)+(App.S.timerHistoryRV[key]||0), time28Sec=App.S.timer28History[key]||0;
    const occ=App.S.occasions&&App.S.occasions[key];
    const c=document.createElement('div');c.className='cc';
    if(key===ts)c.classList.add('today');
    // Brahmacharya coloring
    const bcEn=App.S.brahma[key], isBcBroken=bcEn&&bcEn.status==='b';
    const isBcActive=key>=getBrahmaStart()&&key<=ts;
    if(isBcActive){c.classList.add(isBcBroken?'bc-b':'bc-m');}
    const combinedDt=(App.S.dt||0)+(App.S.dtRV||0);
    if(cnt>0){c.classList.add('hd');if(combinedDt>0&&cnt>=combinedDt)c.classList.add('tm');}
    if(occ)c.classList.add('occ');
    let inner='<span>'+d+'</span>';
    if(cnt>0)inner+='<span class="ccc">'+cnt+'</span>';
    if(occ)inner+='<span class="cco">'+escHtml(occ)+'</span>';
    c.innerHTML=inner;
    c.onclick=(()=>{const k=key,n=cnt,t=timeSec,t28=time28Sec;return()=>showDay(k,n,t,t28);})();
    g.appendChild(c);
  }
  uBStats();
}
function chm(d){cald.setMonth(cald.getMonth()+d);renderCal();}
// ── Calendar day bottom sheet ──
let _sheetKey = null;
function showDay(key, cnt, timeSec, time28Sec) {
  _sheetKey = key;
  const ms = App.S.ms || 108;
  const pts = key.split('-'), yr = pts[0], mo = pts[1], d = pts[2];
  const occ = App.S.occasions && App.S.occasions[key];

  // Title
  document.getElementById('cdmoTitle').textContent = MN[parseInt(mo)-1] + ' ' + parseInt(d) + ', ' + yr;

  // Stats — detailed breakdown
  const radhaCount = App.S.history[key] || 0;
  const rvCount = App.S.historyRV[key] || 0;
  const radhaTime = App.S.timerHistory[key] || 0;
  const rvTime = App.S.timerHistoryRV[key] || 0;
  const n28Count = App.S.h28[key] || 0;
  const n28TimeSec = App.S.timer28History[key] || 0;
  const n28Cycles = Math.floor(n28Count / 28);
  const radhaMalas = Math.floor(radhaCount / ms);
  const rvMalas = Math.floor(rvCount / ms);
  const totalCount = radhaCount + rvCount;
  const totalMalas = Math.floor(totalCount / ms);

  document.getElementById('cdmoRadhaJap').textContent = radhaCount > 0 ? radhaCount + ' jap · ' + radhaMalas + ' malas' : '—';
  document.getElementById('cdmoRvJap').textContent = rvCount > 0 ? rvCount + ' jap · ' + rvMalas + ' malas' : '—';
  document.getElementById('cdmoRadhaTime').textContent = radhaTime > 0 ? App.fmtTime(radhaTime) : '—';
  document.getElementById('cdmoRvTime').textContent = rvTime > 0 ? App.fmtTime(rvTime) : '—';
  document.getElementById('cdmo28Names').textContent = n28Count > 0 ? n28Count + ' jap · ' + n28Cycles + ' cycles' : '—';
  const el28 = document.getElementById('cdmoTime28');
  if (el28) {
    if (n28TimeSec > 0) { const _m = Math.floor(n28TimeSec / 60), _s = n28TimeSec % 60; el28.textContent = _m + ':' + String(_s).padStart(2,'0'); }
    else el28.textContent = '—';
  }
  document.getElementById('cdmoTotalCount').textContent = totalCount > 0 ? totalCount + ' jap (' + totalMalas + ' malas)' : '—';
  const totalTimeSec = (radhaTime + rvTime + n28TimeSec);
  document.getElementById('cdmoTotalTime').textContent = totalTimeSec > 0 ? App.fmtTime(totalTimeSec) : '—';
  const combinedDt = (App.S.dt||0) + (App.S.dtRV||0);
  const pct = combinedDt > 0 ? Math.round(cnt / combinedDt * 100) + '%' : '—';
  document.getElementById('cdmoPct').textContent = pct;

  // Occasion
  _renderSheetOcc(key);

  // Brahmacharya section
  const bcSec = document.getElementById('cdmoBcSection');
  const bcStatus = document.getElementById('cdmoBcStatus');
  const bcCntRow = document.getElementById('cdmoBcCntRow');
  const bcMaintBtn = document.getElementById('cdmoBcMaint');
  const bcBrkBtn = document.getElementById('cdmoBcBrk');
  const ts = App.getTk();
  const isBcActive = key >= getBrahmaStart() && key <= ts;
  if (isBcActive) {
    bcSec.style.display = '';
    const bcEn = App.S.brahma[key], isBroken = bcEn && bcEn.status === 'b';
    if (isBroken) {
      bcStatus.innerHTML = '❌ <span style="color:var(--red)">Broken</span>' + (bcEn.count > 1 ? ' (' + bcEn.count + 'x)' : '');
      bcMaintBtn.style.display = '';
      bcBrkBtn.style.display = 'none';
      bcCntRow.style.display = 'none';
    } else {
      bcStatus.innerHTML = '✅ <span style="color:var(--green)">Maintained</span>';
      bcMaintBtn.style.display = 'none';
      bcBrkBtn.style.display = '';
      bcCntRow.style.display = 'flex';
    }
    document.getElementById('cdmoBcCnt').value = (bcEn && bcEn.count) || 1;
  } else {
    bcSec.style.display = 'none';
  }

  // Clear input
  document.getElementById('cdmoOccIn').value = '';

  document.getElementById('cdmo').classList.add('show');
}
function _renderSheetOcc(key) {
  const occ = App.S.occasions && App.S.occasions[key];
  const nameEl = document.getElementById('cdmoOccName');
  const curEl = document.getElementById('cdmoOccCur');
  if (occ) {
    curEl.innerHTML = '<span style="color:var(--gold)">🪔 ' + escHtml(occ) + '</span>' +
      '<button class="cdmo-occ-del" onclick="_delSheetOcc(\'' + key + '\')">✕</button>';
  } else {
    curEl.innerHTML = '<span style="color:var(--td);font-style:italic">None added</span>';
  }
}
function _delSheetOcc(key) {
  if (App.S.occasions) delete App.S.occasions[key];
  App.save(); fbDebouncedPush(); renderCal();
  _renderSheetOcc(key);
  toast('Occasion removed.');
}
function addOccasionFromSheet() {
  const key = _sheetKey;
  if (!key) return;
  const name = (document.getElementById('cdmoOccIn').value || '').trim();
  if (!name) { toast('Please enter an occasion name 🪔'); return; }
  if (!App.S.occasions) App.S.occasions = {};
  App.S.occasions[key] = name;
  document.getElementById('cdmoOccIn').value = '';
  App.save(); fbDebouncedPush(); renderCal();
  _renderSheetOcc(key);
  toast('Occasion added! 🪔 ' + name);
}
function closeDaySheet() {
  document.getElementById('cdmo').classList.remove('show');
  _sheetKey = null;
}
function sheetMarkBc(action) {
  const key = _sheetKey;
  if (!key) return;
  if (action === 'b') {
    const cnt = parseInt(document.getElementById('cdmoBcCnt').value) || 1;
    App.S.brahma[key] = { status: 'b', count: cnt };
    toast('Marked as broken 🙏');
  } else {
    delete App.S.brahma[key];
    toast('✅ Restored as maintained!');
  }
  App.save(); fbDebouncedPush(); renderCal();
  // Refresh the sheet to show updated status
  const cnt2 = (App.S.history[key]||0) + (App.S.historyRV[key]||0);
  const timeSec2 = (App.S.timerHistory[key]||0) + (App.S.timerHistoryRV[key]||0);
  const time28Sec2 = App.S.timer28History[key]||0;
  showDay(key, cnt2, timeSec2, time28Sec2);
}
function addOccasion(){
  const date=(document.getElementById('occDate')||{value:''}).value.trim();
  const name=(document.getElementById('occName')||{value:''}).value.trim();
  if(!date||!name)return;
  if(!App.S.occasions)App.S.occasions={};
  App.S.occasions[date]=name;
  App.save(); fbDebouncedPush(); renderCal(); toast('Occasion added! 🪔 '+name);
}
function deleteOccasion(key){if(App.S.occasions)delete App.S.occasions[key];App.save();fbDebouncedPush();renderCal();toast('Removed.');}
function renderOccasionList(){
  const el=document.getElementById('occList'); if(!el)return;
  const occs=App.S.occasions||{}, keys=Object.keys(occs).sort();
  if(!keys.length){el.innerHTML='<div style="font-size:12px;color:var(--td);padding:4px 0">No occasions added yet.</div>';return;}
  el.innerHTML=keys.map(k=>{const pts=k.split('-'),label=MN[parseInt(pts[1])-1]+' '+parseInt(pts[2])+', '+pts[0];return'<div class="occ-item"><span class="occ-item-date">'+label+'</span><span class="occ-item-name">🪔 '+escHtml(occs[k])+'</span><button class="occ-item-del" onclick="deleteOccasion(\''+k+'\')">✕</button></div>';}).join('');
}

// ── Sun Times ──
function calcSunTimes(lat,lng,date){
  const rad=Math.PI/180,JD=(date.getTime()/86400000)+2440587.5,n=JD-2451545.0;
  const L=(280.46+0.9856474*n)%360,g=(357.528+0.9856003*n)%360;
  const lambda=L+1.915*Math.sin(g*rad)+0.02*Math.sin(2*g*rad);
  const epsilon=23.439-0.0000004*n,sinDec=Math.sin(epsilon*rad)*Math.sin(lambda*rad);
  const dec=Math.asin(sinDec),cosHA=(Math.cos(90.833*rad)-Math.sin(lat*rad)*sinDec)/(Math.cos(lat*rad)*Math.cos(dec));
  if(cosHA>1||cosHA<-1)return null;
  const HA=Math.acos(cosHA)/rad,GMST=6.697375+0.0657098242*n,LMST=(GMST*15+lng)%360;
  const transit=(360-LMST+lambda)/15,sunrise=transit-HA/15,sunset=transit+HA/15;
  function toLocal(utcH){const off=date.getTimezoneOffset()/(-60);let h=(utcH+24+off)%24;const hh=Math.floor(h),mm=Math.round((h-hh)*60),fH=mm===60?hh+1:hh,fM=mm===60?0:mm,ap=fH>=12?'PM':'AM',h12=((fH%12)||12);return String(h12).padStart(2,'0')+':'+String(fM).padStart(2,'0')+' '+ap;}
  function toLocalRaw(utcH){const off=date.getTimezoneOffset()/(-60);return(utcH+24+off)%24;}
  return{sunriseH:toLocalRaw(sunrise),sunsetH:toLocalRaw(sunset),sunrise:toLocal(sunrise),sunset:toLocal(sunset)};
}
function fmtHour(h){let hh=Math.floor(h),mm=Math.round((h-hh)*60);if(mm>=60){hh++;mm=0;}if(hh>=24)hh-=24;const ap=hh>=12?'PM':'AM',h12=((hh%12)||12);return String(h12).padStart(2,'0')+':'+String(mm).padStart(2,'0')+' '+ap;}
function updateSunInfo(lat,lng){
  const now=new Date(),times=calcSunTimes(lat,lng,now); if(!times)return;
  const bmStart=times.sunriseH-96/60,bmEnd=times.sunriseH-46/60;
  document.getElementById('bm-start').textContent=fmtHour(bmStart<0?bmStart+24:bmStart);
  document.getElementById('bm-end').textContent=fmtHour(bmEnd<0?bmEnd+24:bmEnd);
  document.getElementById('rh-sunrise').textContent=times.sunrise;
  const skStart=times.sunsetH-24/60,skEnd=times.sunsetH+24/60;
  document.getElementById('sk-start').textContent=fmtHour(skStart);
  document.getElementById('sk-end').textContent=fmtHour(skEnd>24?skEnd-24:skEnd);
  document.getElementById('rh-sunset').textContent=times.sunset;
}
function initSunTimes(){
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      pos=>{updateSunInfo(pos.coords.latitude,pos.coords.longitude);setInterval(()=>updateSunInfo(pos.coords.latitude,pos.coords.longitude),600000);},
      ()=>updateSunInfo(23.8103,90.4125),
      {timeout:8000,maximumAge:3600000}
    );
  } else updateSunInfo(23.8103,90.4125);
}

// ── PWA Manifest ──
function buildPwaManifest(){
  const img=document.getElementById('appIconImg');
  function attach(){
    try{
      const c=document.createElement('canvas');c.width=c.height=512;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#060D1F';ctx.fillRect(0,0,512,512);
      ctx.save();ctx.beginPath();ctx.arc(256,256,256,0,Math.PI*2);ctx.clip();
      const s=Math.min(img.naturalWidth||512,img.naturalHeight||512);
      ctx.drawImage(img,(img.naturalWidth-s)/2,0,s,s,0,0,512,512);
      ctx.restore();
      ctx.strokeStyle='rgba(255,215,0,0.55)';ctx.lineWidth=15;
      ctx.beginPath();ctx.arc(256,256,248,0,Math.PI*2);ctx.stroke();
      const url=c.toDataURL('image/png');
      const mf={name:'Radha Naam Jap',short_name:'Radha Jap',description:'Jai Shri Radha',
        start_url:'./index.html',scope:'./',display:'standalone',orientation:'portrait-primary',
        background_color:'#060D1F',theme_color:'#060D1F',
        icons:[{src:url,sizes:'512x512',type:'image/png',purpose:'any maskable'},{src:url,sizes:'192x192',type:'image/png',purpose:'any maskable'}]};
      const blob=new Blob([JSON.stringify(mf)],{type:'application/manifest+json'});
      const lnk=document.createElement('link');lnk.rel='manifest';lnk.href=URL.createObjectURL(blob);document.head.appendChild(lnk);
      document.querySelectorAll('link[rel*="icon"],link[rel="apple-touch-icon"]').forEach(l=>l.remove());
      const ati=document.createElement('link');ati.rel='apple-touch-icon';ati.sizes='512x512';ati.href=url;document.head.appendChild(ati);
      const ico=document.createElement('link');ico.rel='icon';ico.type='image/png';ico.href=url;document.head.appendChild(ico);
    }catch(e){}
  }
  if(img&&img.complete&&img.naturalWidth)attach();
  else if(img)img.addEventListener('load',attach);
  else setTimeout(buildPwaManifest,100);
}

// ── Collapsible: Occasion Names form ──
function toggleOccForm() {
  const body = document.getElementById('occFormBody');
  const chevron = document.getElementById('occChevron');
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

// ── Collapsible: Add Stotram form ──
function toggleAsfForm(forceOpen) {
  const body = document.getElementById('asfBody');
  const chevron = document.getElementById('asfChevron');
  if (!body) return;
  const isOpen = forceOpen !== undefined ? forceOpen : !body.classList.contains('open');
  body.classList.toggle('open', isOpen);
  if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

// ── Collapsible: Mark as Broken ──
function toggleBrkCollapse() {
  const body = document.getElementById('brkBody');
  const chevron = document.getElementById('brkChevron');
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

// ── INIT ──
window.addEventListener('load', async () => {
  await App.load();
  App.lmc = Math.floor(App.gTod() / (App.S.ms||108));
  App.lm28 = Math.floor((App.S.h28[App.S.tk]||0) / (App.S.ms||108));
  App.lmcRV = Math.floor((App.S.historyRV[App.S.tk]||0) / (App.S.ms||108));

  // Timer always starts from 0 on each app open.
  // timerSavedSeconds tracks what's already committed to timerHistory this session.
  App.timerSeconds = 0;
  App.timerSavedSeconds = 0;
  // Restore wall-clock mala start for cross-session timing
  const savedMalaWall = localStorage.getItem('rjap_malaWallStart');
  const todayCount = App.gTod();
  const ms = App.S.ms || 108;
  const countInCurrentMala = todayCount % ms;
  if (savedMalaWall && countInCurrentMala > 0) {
    App.malaWallStart = parseInt(savedMalaWall);
  } else {
    App.malaWallStart = Date.now();
    localStorage.setItem('rjap_malaWallStart', String(App.malaWallStart));
  }
  document.getElementById('timerDisplay').textContent = '00:00:00';

  // Apply settings UI
  if (App.S.cfg.vib) document.getElementById('tgVib').classList.add('on');
  if (App.S.cfg.sound) document.getElementById('tgSnd').classList.add('on');

  // Live previews for stats inputs
  ['manualJapIn','prevJapIn','deductTodayIn','deductOtherIn','deductOtherDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', uStats);
  });
  const dtIn = document.getElementById('dtIn');
  const ltIn = document.getElementById('ltIn');
  if (dtIn) dtIn.addEventListener('input', function() { document.getElementById('dtMala').textContent = Math.ceil((parseInt(this.value)||0)/(App.S.ms||108)); });
  if (ltIn) ltIn.addEventListener('input', function() { document.getElementById('ltMala').textContent = Math.ceil((parseInt(this.value)||0)/(App.S.ms||108)).toLocaleString(); });

  App.ua();
  initJapModeUI();
  fbInit();
  initSunTimes();
  buildPwaManifest();

  // Restore Drive token if re-opened
  const savedToken = localStorage.getItem('rjap_gd_token');
  if (savedToken) gdAccessToken = savedToken;

  // Hide loading — guaranteed cleanup
  setTimeout(() => {
    const ls = document.getElementById('ls');
    if (ls) {
      ls.classList.add('hide');
      setTimeout(() => { if(ls.parentNode) ls.parentNode.removeChild(ls); }, 900);
    }
  }, 2800);
});

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', {scope:'./'})
      .then(r => console.log('SW registered:', r.scope))
      .catch(e => console.warn('SW registration failed:', e.message));
  });
}




// ═══════════════════════════════════════════════════════
// GURUDEV PHOTO FALLBACK — beautiful canvas placeholder
// if base64 is truncated/missing
// ═══════════════════════════════════════════════════════
function drawGuruDevFallback(img) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 440;
    const ctx = c.getContext('2d');
    // Deep blue background
    const bg = ctx.createRadialGradient(220,180,10,220,220,220);
    bg.addColorStop(0,'#0A1535'); bg.addColorStop(1,'#060D1F');
    ctx.fillStyle = bg; ctx.fillRect(0,0,440,440);
    // Gold circle border
    ctx.beginPath(); ctx.arc(220,220,210,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,215,0,0.6)'; ctx.lineWidth=4; ctx.stroke();
    // Lotus / OM symbol in gold
    ctx.fillStyle='rgba(255,215,0,0.15)';
    ctx.beginPath(); ctx.arc(220,220,160,0,Math.PI*2); ctx.fill();
    // OM text
    ctx.font='bold 120px serif'; ctx.fillStyle='rgba(255,215,0,0.85)';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('ॐ', 220, 210);
    // Name text
    ctx.font='bold 22px serif'; ctx.fillStyle='rgba(255,215,0,0.9)';
    ctx.fillText('Shri Hit Premanand Ji', 220, 310);
    ctx.font='16px serif'; ctx.fillStyle='rgba(109,184,255,0.8)';
    ctx.fillText('Jai Shri Radha', 220, 345);
    img.src = c.toDataURL('image/png');
  } catch(e) {
    img.style.background = 'linear-gradient(135deg,#0A1535,#2255CC)';
    img.src = ''; img.alt = 'ॐ';
  }
}

// Run fallback on load too in case base64 is partially broken
window.addEventListener('load', function() {
  const img = document.getElementById('guruImg');
  if (img && (!img.complete || img.naturalWidth === 0)) {
    drawGuruDevFallback(img);
  }
});

// ═══════════════════════════════════════════════════════
// STOTRAM LYRICS
// ═══════════════════════════════════════════════════════
const LYRICS = {
  rks:`শ্রীরাধাকৃপাকটাক্ষস্তবরাজঃ

মুনীন্দ্রবৃন্দবন্দিতে ত্রিলোকশোকহারিণি
প্রসন্নবক্ত্রপঙ্কজে নিকুঞ্জভূবিলাসিনি ।
ব্রজেন্দ্রভানুনন্দনি ব্রজেন্দ্রসূনুসঙ্গতে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ১॥

অশোকবৃক্ষবল্লরীবিতানমণ্ডপস্থিতে
প্রবালবালপল্লবপ্রভারুণাঙ্ঘ্রিকোমলে ।
বরাভয়স্ফুরৎকরে প্রভূতসম্পদালয়ে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ২॥

অনঙ্গরঙ্গমঙ্গলপ্রসঙ্গভঙ্গুরভ্রুবাং
সবিভ্রমং সসম্ভ্রমং দৃগন্তবাণপাতনৈঃ ।
নিরন্তরং বশীকৃতপ্রতীতিনন্দনন্দনে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ৩॥

তডিৎসুবর্ণচম্পকপ্রদীপ্তগৌরবিগ্রহে
মুখপ্রভাপরাস্তকোটিশারদেন্দুমণ্ডলে ।
বিচিত্রচিত্রসঞ্চরচ্চকোরশাবলোচনে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ৪॥

মদোন্মদাতিয়ৌবনে প্রমোদমানমণ্ডিতে
প্রিয়ানুরাগরঞ্জিতে কলাবিলাসপণ্ডিতে ।
অনন্যধন্যকুঞ্জরাজ্যকামকেলিকোবিদে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ৫॥

অশেষহাবভাবধীরহীরহারভূষিতে
প্রভূতশাতকুম্ভকুম্ভকুম্ভকুম্ভসুস্তনি ।
প্রশস্তমন্দহাস্যচূর্ণপূর্ণসৌখ্যসাগরে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ৬॥

মৃণালবালবল্লরীতরঙ্গরঙ্গদোর্লতে
লতাগ্রলাস্যলোলনীললোচনাবলোকনে ।
ললল্লুলন্মলন্মনোজ্ঞমুগ্ধমোহনাশ্রিতে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ৭॥

সুবর্ণমালিকাঞ্চিতত্রিরেখকম্বুকণ্ঠগে
ত্রিসূত্রমঙ্গলীগুণত্রিরত্নদীপ্তিদীধিতে ।
সলোলনীলকুন্তলপ্রসূনগুচ্ছগুম্ফিতে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ৮॥

নিতম্ববিম্বলম্বমানপুষ্পমেখলাগুণে
প্রশস্তরত্নকিঙ্কিণীকলাপমধ্যমঞ্জুলে ।
করীন্দ্রশুণ্ডদণ্ডকাবরাহসৌভগোরুকে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ৯॥

অনেকমন্ত্রনাদমঞ্জুনূপুরারবস্খলৎ
সমাজরাজহংসবংশনিক্বণাতিগৌরবে ।
বিলোলহেমবল্লরীবিডম্বচারুচঙ্ক্রমে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ১০॥

অনন্তকোটিবিষ্ণুলোকনম্রপদ্মজার্চিতে
হিমাদ্রিজাপুলোমজাবিরিঞ্চজাবরপ্রদে ।
অপারসিদ্ধিঋদ্ধিদিগ্ধসম্পদঙ্গুলীনখে
কদা করিষ্যসীহ মাং কৃপাকটাক্ষভাজনম্ ॥ ১১॥

মখেশ্বরি ক্রিয়েশ্বরি স্বধেশ্বরি সুরেশ্বরি
ত্রিবেদভারতীশ্বরি প্রমাণশাসনেশ্বরি ।
রমেশ্বরি ক্ষমেশ্বরি প্রমোদকাননেশ্বরি
ব্রজেশ্বরি ব্রজাধিপে শ্রীরাধিকে নমোঽস্তু তে ॥ ১২॥

অমুং মমাদ্ভুতং স্তবং নিশম্য ভানুনন্দনী
করোতু সন্ততং জনং কৃপাকটাক্ষভাজনম্ ।
ভবেত্তদৈব সঞ্চিতত্রিরূপকর্মনাশনং
ভবেত্তদা ব্রজেন্দ্রসূনুমণ্ডলপ্রবেশনম্ ॥ ১৩॥

ফলশ্রুতিঃ —
রাকায়াঞ্চ সিতাষ্টম্যাং দশম্যাঞ্চ বিশুদ্ধধীঃ ।
একাদশ্যাং ত্রয়োদশ্যাং যঃ পঠেৎ স শিবঃ স্বয়ম্ ॥ ১৪॥

যং যং কাময়তে কামং তন্তমাপ্নোতি সাধকঃ ।
রাধাকৃপাকটাক্ষেণ ভুক্ত্বান্তে মোক্ষমাপ্নুয়াৎ ॥ ১৫॥

॥ ইতি ঊর্ধ্বানায়তন্ত্রান্তর্গতঃ শ্রীরাধাকৃপাকটাক্ষস্তবরাজঃ সম্পূর্ণঃ ॥`,

  gms:`গজেন্দ্র মোক্ষ স্তোত্রম্

শ্রীশুক উবাচ
শ্লোক ১:
এবং ব্যবসিতো বুদ্ধ্যা সমাধায় মনো হৃদি।
জজাপ পরমং জাপ্যং প্রাগ্ জন্মন্যনুশিক্ষিতম্।। ১

অর্থ: শ্রীশুকদেব বললেন—হে পরীক্ষিৎ! নিজের বুদ্ধিতে এইভাবে কৃতনিশ্চয় হয়ে গজেন্দ্র নিজের মনকে চিত্তভূমিতে স্থির করে পূর্ব জন্মের অভ্যস্ত এই শ্রেষ্ঠ জপযোগ্য স্তোত্রের দ্বারা ভগবানের স্তুতি করতে লাগল।। ১

গজেন্দ্র উবাচ
শ্লোক ২:
ওঁ নমো ভগবতে তস্মৈ যত এতচ্চিদাত্মকম ।
পুরুষায়াদিবীজায় পরেশায়াভিধীমহি।। ২

অর্থ: গজেন্দ্র বলল—যিনি জগতের মূল কারণ এবং সকলের হৃদয়ে পুরুষরূপে বিরাজ করছেন, যিনি সমস্ত জগতের একমাত্র প্রভু, যাঁর জন্যে এই সংসারে চেতনার বিস্তার হয় সেই ভগবানকে নমস্কার এবং ভক্তিভরে তাঁর ধ্যান করি।। ২

শ্লোক ৩:
যস্মিন্নিদং যতশ্চেদং যেনেদং য ইদং স্বয়ম্।
যোঽস্মাৎ পরস্মাচ্চ পরস্তং প্রপদ্যে স্বয়ম্ভুবম্।। ৩

অর্থ: এই বিশ্ব যাঁর মধ্যে অবস্থিত, যাঁর সত্তাবশত এই বিশ্বের প্রতীতি হচ্ছে, যিনি এই বিশ্বে সর্বত্র ব্যাপ্ত এবং স্বয়ং যিনি এই রূপেই প্রকাশিত এবং এই সমস্ত হওয়া সত্ত্বেও যিনি এই সংসার ও তার কারণ প্রকৃতির অতীত, আমি সেই স্বয়প্রকাশ স্বয়ংসিদ্ধ সত্তাত্মক পরমেশ্বরের শরণাপন্ন হলাম।। ৩

শ্লোক ৪:
যঃ স্বাত্মনীদং নিজমায়য়ার্পিতং
ক্বচিদ্ বিভাতং ক্ব চ তৎ তিরোহিতম্।
অবিদ্ধদৃক্ সাক্ষ্যুভয়ং তদীক্ষতে
স আত্মমূলোঽবতু মাং পরাৎ পরঃ।। ৪

অর্থ: এই প্রপঞ্চ বিশ্বই তাঁর মায়ায় তাঁতেই অধ্যস্ত। তিনি কখনো ব্যক্ত, কখনো বা প্রলয়ে বিলীন এই বিশ্বকে নিত্য-অলুপ্ত দৃষ্টে সাক্ষিরূপে নিরীক্ষণ করছেন। সেই সর্বমূল তথা আত্মমূল, কার্য এবং কারণের অতীত স্বয়ংপ্রকাশ ভগবান আমাকে রক্ষা করুন।। ৪

শ্লোক ৫:
কালেন পঞ্চত্বমিতেষু কৃৎস্নশো
লোকেষু পালেষু চ সর্বহেতুষু।
তমস্তদাঽসীদ্ গহনং গভীরং
যস্তস্য পারেঽভিবিরাজতে বিভুঃ।। ৫

অর্থ: প্রলয়কালে লোক, লোকপাল এবং ভূতাদি সব কারণসহ বিনষ্ট হলে যে দুরবগাহ ঘোর অন্ধকার অবশিষ্ট থাকে সেই অন্ধকারের পারে বিরাজমান যে বিভু তিনি আমায় রক্ষা করুন।। ৫

শ্লোক ৬:
ন যস্য দেবা ঋষয়ঃ পদং বিদু-
র্জন্তঃ পুনঃ কোঽর্হতি গন্তুমীরিতুম্।
যথা নটস্যাকৃতিভিবিচেষ্টতো
দুরত্যয়ানুক্ৰমণঃ স মাবতু।। ৬

অর্থ: তাঁর লীলারহস্য জানা অতীব দুরূহ। তিনি অভিনেতার মতো নানা রূপ ও নানা বেশ ধারণ করেন। তাঁর বাস্তবিক স্বরূপ দেবতা বা ঋষিগণ—কেউ-ই জানেন না, তাহলে এমন কোন ব্যক্তি আছে যে তাঁর বর্ণনা করতে পারে? দুজ্ঞেয়-চরিত্র সেই প্রভু আমায় রক্ষা করুন।। ৬

শ্লোক ৭:
দিদৃক্ষবো যস্য পদং সুমঙ্গলং
বিমুক্তসঙ্গা মুনয়ঃ সুসাধবঃ।
চরন্ত্যলোকব্রতব্রণং বনে
ভূতাত্মভূতাঃ সুহৃদঃ স মে গতিঃ।। ৭

অর্থ: যাঁর পরম মঙ্গলময় স্বরূপ দর্শন করার জন্যে সাধুরা সংসারের সমস্ত আসক্তিকে ত্যাগ করে বনে গিয়ে নৈষ্ঠিক ব্রহ্মচর্য আদি অলৌকিক ব্রত পালন করেন এবং নিজ আত্মাকে সকলের হৃদয়ে বিরাজমান রূপে উপলব্ধি করে স্বাভাবিকভাবেই অপরের মঙ্গলে রত থাকেন—মুনিগণের সর্বস্ব সেই ভগবান আমার সহায়তা করুন এবং তিনিই আমার পরম গতি হোন।। ৭

শ্লোক ৮:
ন বিদ্যতে যস্য চ জন্ম কর্ম বা
ন নামরূপে গুণদোষ এব বা।
তথাপি লোকাপ্যয়সংভবায় যঃ
স্বমায়য়া তান্যনুকালমৃচ্ছতি।। ৮

অর্থ: যাঁর জন্ম-কর্ম অথবা নাম-রূপ কিছু নেই, তাঁর মধ্যে দোষ-গুণ কী করে কল্পনা করা যায়? তবুও তিনি বিশ্বের সৃষ্টি ও সংহারের জন্য মায়ায় যথাকালে জন্মাদি স্বীকার করে থাকেন।। ৮
 
 শ্লোক ৯:
তস্মৈ নমঃ পরেশায় ব্রহ্মণেঽনন্তশক্তয়ে।
অরূপায়োরুরূপায় নম আশ্চর্যকর্মণে।। ৯

অর্থ: সেই অনন্ত শক্তিমান ঐশ্বর্যময় পরব্রহ্ম পরমাত্মাকে নমস্কার। তিনি অরূপ হয়েও বহুরূপে প্রকাশিত হন। সেই আশ্চর্যকর্মার চরণে প্রণাম।। ৯

শ্লোক ১০:
নম আত্মপ্রদীপায় সাক্ষিণে পরমাত্মনে।
নমো গিরাং বিদূররায় মনসশ্চেতসামপি।। ১০

অর্থ: স্বপ্রকাশ, সাক্ষিস্বরূপ সেই পরমাত্মাকে নমস্কার। যিনি মন, বাক্য ও চিত্ত থেকে অনেক দূরে সেই পরমাত্মাকে বারবার নমস্কার।। ১০

শ্লোক ১১:
সত্ত্বেন প্রতিলভ্যায় নৈষ্কর্মেণ বিপশ্চিতা।
নমঃ কৈবল্যনাথায় নির্বাণসুখসংবিদে।। ১১

অর্থ: সাধক কর্মসন্ন্যাস অথবা কর্মসমর্পণ দ্বারা শুদ্ধান্তঃকরণ হয়ে যাঁকে লাভ করেন, যিনি নিত্যমুক্ত পরমানন্দ ও জ্ঞানস্বরূপ এবং অপরকে কৈবল্য-মুক্তি দেবার ক্ষমতা কেবল যাঁর আছে—সেই প্রভুকে আমি নমস্কার করি।। ১১

শ্লোক ১২:
নমঃ শান্তায় ঘোরায় মূঢ়ায় গুণধর্মিণে 
নির্বিশেষায় সাম্যায় নমো জ্ঞানঘনায় চ।। ১২

অর্থ: যিনি সত্ত্ব রজঃ ও তমঃ—এই তিন গুণের ধর্মকে স্বীকার করে যথাক্রমে সত্ত্বগুণে শান্ত, রজোগুণে ঘোর এবং কখনো বা তমোগুণে মূঢ়ের মতো আচরণ করেও ভেদরহিত, সমভাবে স্থিত ও জ্ঞানঘন, সেই প্রভুকে বারবার নমস্কার করি।। ১২

শ্লোক ১৩:
ক্ষেত্রজ্ঞায় নমস্তুভ্যং সর্বাধ্যক্ষায় সাক্ষিণে।
পুরুষায়াত্মমূল্যায় মূলপ্রকৃতয়ে নমঃ।। ১৩

অর্থ: আপনি সকলের প্রভু, ক্ষেত্রজ্ঞ এবং সর্বসাক্ষী, আপনাকে আমি নমস্কার করছি। আপনি নিজেই আপনার কারণ (উৎসস্থল)। আপনিই পুরুষ ও মূল প্রকৃতি রূপে বিদ্যমান। আপনাকে বারবার প্রণাম।। ১৩

শ্লোক ১৪:
সর্বেন্দ্রিয়গুণদ্রষ্ট্রে সর্বপ্রত্যয়হেতবে।
অসতাচ্ছায়য়োক্তায় সদাভাসায় তে নমঃ।। ১৪
অর্থ: আপনি যাবতীয় ইন্দ্রিয় এবং তাদের বিষয়সমূহের দ্রষ্টা এবং সর্ববিধ প্রতীতির আধার। অহংকার আদি ছায়ারূপ অসত্য বস্তুর দ্বারাও আপনার অস্তিত্বের প্রমাণ পাওয়া যায়। সমস্ত বিষয়ের মধ্যে যে চৈতন্যের আভাস পাওয়া যায় সেও আপনারই অস্তিত্ব প্রকাশ করে। আমি আপনাকে নমস্কার করি।। ১৪
শ্লোক ১৫:
নমো নমস্তেঽখিলকারণায়
নিষ্কারণায়াদ্ভুতকারণায়।
সর্বাগমাম্নায়মহার্ণবায়
নমোঽপবর্গায় পরায়ণায়।। ১৫

অর্থ: আপনি সকলের আদি কারণ কিন্তু আপনার কোনো কারণ নেই এবং সর্বকারণ হওয়া সত্ত্বেও আপনার কোনো বিকৃতি বা পরিণাম নেই, সেজন্য আপনি অদ্ভুত-কারণ! আপনাকে আমার নমস্কার। যেমন সমস্ত নদী ও ঝরনার অন্তিম গতি হল সমুদ্র সেইরূপ সমস্ত বেদ ও শাস্ত্রসমূহ আপনাতেই পর্যবসিত হয়। আপনি মোক্ষস্বরূপ এবং সমস্ত সাধুদের আশ্রয় স্থল, আপনাকে নমস্কার।। ১৫

শ্লোক ১৬:
গুণারণিচ্ছন্নচিদূষ্মপায়
তৎ ক্ষোভবিস্ফূর্জিতমানসায়।
নৈষ্কর্ম্যভাবেন বিবর্জিতাগম-
স্বয়ংপ্রকাশায় নমস্করোমি।। ১৬

অর্থ: যেমন যজ্ঞের কাষ্ঠে অগ্নি প্রচ্ছন্নভাবে থাকে তেমনই আপনি আপনার জ্ঞানকে গুণসমূহের মায়ায় ঢেকে রেখেছেন। গুণসমূহ যখন ক্ষুব্ধ হয় তখন আপনি তাদের দ্বারা নানাপ্রকার সৃষ্টির সংকল্প করেন। যাঁরা কর্মসন্ন্যাস অথবা কর্মসমর্পণ দ্বারা আত্মতত্ত্বের চিন্তা করে শাস্ত্রের বিধি-নিষেধকে অতিক্রম করতে পেরেছেন, তাঁদের আত্মা-রূপে আপনি প্রকাশিত হন। আপনাকে আমি নমস্কার করি।। ১৬

শ্লোক ১৭:
মাদৃক্ প্রপন্নপশুপাশবিমোক্ষণায়
মুক্তায় ভূরিকরুণায় নমোঽলয়ায় 
স্বাংশেন সর্বতনুভৃন্মনসি প্রতীত-
প্রত্যগ্‌ দৃশ্যে ভগবতে বৃহতে নমস্তে।। ১৭

অর্থ: যেমন দয়ালু ব্যক্তি জালে আবদ্ধ পশুকে মুক্ত করেন তেমনই আপনি আমার মতো শরণাগতকে পাশ থেকে মুক্ত করবেন। আপনি নিত্যমুক্ত, পরম করুণাময় এবং ভক্তের মঙ্গল করতে কখনো আপনার বিলম্ব হয় না। আপনার চরণে আমার প্রণাম। আপনি সমস্ত প্রাণীর মধ্যে আংশিকভাবে অন্তরাত্মারূপে অবস্থান করে উপলব্ধির বিষয় হন—সেই সর্বৈশ্বর্যপূর্ণ এবং অনন্ত ভগবান আপনাকে প্রণাম করছি।। ১৭
 
শ্লোক ১৮:
আত্মাত্মজাপ্তগৃহবিত্তজনেষু সক্তৈ-
দুস্প্রাপণায় গুণসঙ্গবিবর্জিতায়।
মুক্তাত্মভিঃ স্বহৃদয়ে পরিভাবিতায়
জ্ঞানাত্মনে ভগবতে নম ঈশ্বরীয়।। ১৮

অর্থ: যারা দেহ, পুত্র, গুরুজন, গৃহ, সম্পত্তি এবং স্বজনের প্রতি আসক্ত—তাদের পক্ষে আপনাকে লাভ করা বড়ই কঠিন, কেননা আপনি স্বয়ং গুণাদিতে আসক্তিশূন্য। জীবন্মুক্ত মহাপুরুষগণ নিজের হৃদয়ে অবিরত আপনার কথাই চিন্তা করেন। সেই সর্বৈশ্বর্যপূর্ণ জ্ঞানময় ভগবানকে প্রণাম করি।। ১৮

শ্লোক ১৯:
যং ধর্মকামার্থবিমুক্তিকামা
ভজন্ত ইষ্টাং গতিমাপ্নুবন্তি।
কিং ত্বাশিষো রাত্যপি দেহমব্যয়ং
করোতু মেঽদভ্ৰদয়ো বিমোক্ষণম্।। ১৯

অর্থ: মানুষ ধর্ম, অর্থ, কাম এবং মোক্ষ লাভের জন্য তাঁর আরাধনা করে তাদের অভীষ্ট বস্তু লাভ করে। শুধু তাই নয়, তিনি তাদের সর্বপ্রকার সুখ বিতরণ করেন এবং সেইসঙ্গে তাদের নিজের মতো অমর পার্ষদ-দেহ-দান করে থাকেন। সেই পরম দয়ালু প্রভু আমায় উদ্ধার করুন! ।। ১৯

শ্লোক ২০:
একান্তিনো যস্য ন কঞ্চনার্থং
বাঞ্ছন্তি যে বৈ ভগবৎ প্রপন্নাঃ।
অত্যদ্ভুতং তচ্চরিতং সুমঙ্গলং
গায়ন্ত আনন্দসমুদ্রমগ্নাঃ।। ২০

অর্থ: যাঁর শরণাগত একান্ত ভক্তগণ তাঁর কাছে কোনো বস্তুই প্রার্থনা করেন না এমন কী মোক্ষ পর্যন্ত প্রার্থনা করেন না, কেবল তাঁর পরমমঙ্গলময় দিব্য লীলাসমূহ কীর্তন করে আনন্দ সাগরে ডুবে থাকেন।। ২০
শ্লোক ২১:
তমক্ষরং ব্রহ্ম পরং পরেশ-
মব্যক্তমাধ্যাত্মিকযোগগম্যম্।
অতীন্দ্রিয়ং সূক্ষ্মমিবাতিদূর-
মনন্তমাদ্যং পরিপূৰ্ণমীড়ে।। ২১

অর্থ: যিনি অবিনাশী, সর্বশক্তিমান, অব্যক্ত, অতিন্দ্রিয় এবং অত্যন্ত সূক্ষ্ম, যিনি অতি নিকটস্থ হয়েও দূরবর্তী মনে হন, যাঁকে আধ্যাত্মিক যোগ অর্থাৎ জ্ঞানযোগ অথবা ভক্তিযোগের দ্বারা লাভ করা যায়—আমি সেই আদিপুরুষ, অনন্ত ও পূর্ণ পরব্রহ্মের স্তুতি করছি।। ২১

শ্লোক ২২ - ২৪:
যস্য ব্রহ্মাদয়ো দেবা বেদা লোকাশ্চরাচরাঃ।
নামরূপবিভেদেন ফল্গ্ব্যা চ কলয়া কৃতাঃ।। ২২
যথার্চিষোঽগ্নেঃ সবিতুর্গভস্তয়ো
নির্যান্তি সংযান্ত্যসকৃৎ স্বরোচিষঃ।
তথা যতোঽয়ং গুণসংপ্রবাহো
বুদ্ধিৰ্মনঃ খানি শরীরসর্গাঃ।। ২৩
স বৈ ন দেবাসুরমর্ত্যতির্যঙ্
ন স্ত্রী ন ষণ্ডো ন পুমান্ ন জন্তুঃ।
নায়ং গুণঃ কৰ্ম ন সন্ন চাসন্-
নিষেধশেষো জয়তাদশেষঃ।। ২৪

অর্থ: যাঁর সামান্য অংশ থেকে বহুপ্রকার নাম এবং রূপের ভেদযুক্ত ব্রহ্মা প্রমুখ দেবতা, বেদ এবং চরাচর সমস্ত লোকসকল সৃষ্ট হয়েছে, যেমন দীপ্তিশালী অগ্নি থেকে শিখাসমূহ অথবা প্রকাশশীল সূর্য থেকে তৎসদৃশ কিরণসমূহ পুনঃপুনঃ প্রকাশিত এবং তাতেই বিলীন হয়ে থাকে, সেরূপ গুণপ্রবাহরূপী বুদ্ধি, মন, ইন্দ্রিয় ও দেহ—বারবার যে স্বয়ংপ্রকাশ পরমাত্মা থেকে উৎপন্ন হয় আবার তাতেই লীন হয়, সেই ভগবান—দেবতা বা অসুর নন, অথবা মানুষ, পশু, কিংবা পক্ষীও না। তিনি স্ত্রী, পুরুষ কিংবা নপুংসকও নন, তিনি সাধারণ অথবা অসাধারণ কোনো প্রাণীও নন, গুণ, কর্ম, কার্য বা কারণ কোনো কিছুই নন। সমস্ত কিছুর নিষেধ হয়ে যাওয়ার পর যা অবশিষ্ট থাকে তাই যাঁর স্বরূপ এবং যিনি অশেষ, সেই পরমাত্মা আমাকে উদ্ধারের জন্যে আবির্ভূত হোন।। ২২-২৪
শ্লোক ২৫:

জিজীবিষে নাহমিহামুয়া কি-
মন্তর্বহিশ্চাবৃতয়েভয়োন্যা।
ইচ্ছামি কালেন ন যস্য বিপ্লব-
স্তস্যাত্মলোকাবরণস্য মোক্ষম্।। ২৫

অর্থ: আমি বাঁচতে চাই না। এই হস্তিযোনি ভিতরে এবং বাইরে চতুর্দিক থেকেই অজ্ঞানরূপ আবরণে আচ্ছন্ন। এই জীবন ধারণ করে কী লাভ? কালবশেও যাঁর বিনাশ হয় না সেই আত্মপ্রকাশের আবরণস্বরূপ অজ্ঞানান্ধকারের নাশরূপ মোক্ষই আমি ইচ্ছা করি।। ২৫
 
শ্লোক ২৬:
সোঽহং বিশ্বসৃজং বিশ্বমবিশ্বং বিশ্ববেদসম্।
বিশ্বাত্মানমজং ব্রহ্ম প্রণতোঽস্মি পরং পদম্।।

অর্থ: অতএব আমি সেই পরব্রহ্ম পরমাত্মার শরণ নিচ্ছি, যিনি বিশ্বস্রষ্টা অথচ বিশ্বব্যতিরিক্ত এবং বিশ্বরূপ। যিনি বিশ্বের অন্তরাত্মা এবং এই বিশ্ব যাঁর লীলার উপকরণ সেই অজ পরমপদ ব্রহ্মকে আমি নমস্কার করি।। ২৬
শ্লোক ২৭:

যোগরন্ধিতকর্মাণো হৃদি যোগবিভাবিতে।
যোগিনো যং প্রপশ্যন্তি যোগেশং তং নতোঽস্ম্যহম্।। ২৭

অর্থ: যোগিগণ যোগের দ্বারা কর্ম, কর্মবাসনা এবং কর্মফলকে দগ্ধ করে নিজেদের শুদ্ধ হৃদয়ে যে যোগেশ্বরকে দর্শন করেন, আমি সেই যোগেশ্বরকে প্রণাম করি।। ২৭
শ্লোক ২৮:
নমো নমস্তুভ্যমসহ্যবেগ-
শক্তিত্রয়ায়াখিলধীগুণায়।
প্রপন্নপালায় দুরন্তশক্তয়ে
কদিন্দ্রিয়াণামনবাপ্যবত্মনে।। ২৮

অর্থ: আপনার তিন শক্তি—সত্ত্ব, রজঃ ও তমঃ—এই তিন গুণের বেগ সহ্য করা সহজ নয়। আপনি মন এবং সকল ইন্দ্রিয়ের বিষয়রূপেও প্রতীয়মান হন। সেইজন্য যাঁর ইন্দ্রিয় বশীভূত থাকে না সে আপনার পথে যেতেই পারে না। আপনার শক্তি অনন্ত। আপনি শরণাগতবৎসল। আপনাকে আমি বারবার প্রণাম করি।। ২৮

শ্লোক ২৯:
নায়ং বেদ স্বমাত্মানং যচ্ছক্ত্যাহংধিয়া হতম্।
তং দুরত্যয়মাহাত্ম্যং ভগবন্তমিতোঽস্ম্যহম্।। ২৯

অর্থ: আপনার মায়াশক্তি অহং বুদ্ধিরূপে আত্মার স্বরূপকে আবৃত করে রাখায় জীব নিজের আত্মাকে জানতে পারে না। আপনার মহিমা অনন্ত। আমি সর্বশক্তিমান এবং মাধুর্যময় ভগবানের শরণাপন্ন হয়েছি।। ২৯

শ্রী শুক উবাচ:
শ্লোক ৩০:
এবং গজেন্দ্রমুপবর্ণিতনির্বিশেষং
ব্রহ্মাদয়ো বিবিধলিঙ্গভিদাভিমানাঃ।
নৈতে যদোপসসৃপুর্নিখিলাত্মকত্বাৎ
তত্রাখিলামরময়ো হরিরাবিরাসীৎ।। ৩০

অর্থ: শ্রীশুকদেব বললেন—পরীক্ষিৎ! গজেন্দ্র কোনো রকমের ভেদ-ভাব না করে শ্রীভগবানের অপ্রাকৃত নির্বিশেষ স্বরূপের স্তুতি করেছিল সেইজন্য ভিন্ন ভিন্ন নাম ও রূপযুক্ত বিবিধ মূর্তির অভিমানী ব্রহ্মাদি দেবতারা তাকে রক্ষা করার জন্য আসেননি। সেই সময় সর্বাত্মা হওয়ার কারণে সর্বদেবস্বরূপ ভগবান শ্রীহরি স্বয়ং আবির্ভূত হলেন।। ৩০

শ্লোক ৩১:
তং তদ্বদাৰ্ত্তমুপলভ্য জগন্নিবাসঃ
স্তোত্রং নিশম্য দিবিজৈঃ সহ সংস্তুবম্ভিঃ
ছন্দোময়েন গরুড়েন সমুহ্যমান-
শ্চক্রায়ুধোঽভ্যগমদাশু যতো গজেন্দ্রঃ।। ৩১

অর্থ: জগন্নিবাস শ্রীহরি গজেন্দ্রকে অত্যন্ত কাতর দেখলেন এবং তার উচ্চারিত তাঁর স্তুতি শুনে বেদময় গরুড়ে আরোহণ করে চক্রধারী ভগবান অতি দ্রুত বিপদগ্রস্ত গজেন্দ্রের কাছে পৌঁছালেন। শ্রীহরির স্তুতি করতে করতে অন্য দেবতাগণও সেখানে উপস্থিত হলেন।। ৩১

শ্লোক ৩২:
সোঽন্তঃসরস্যুরুবলেন গৃহীত আর্তো
দৃষ্ট্বা গরুত্মতি হরিং খ উপাত্তচক্রম্।
উৎক্ষিপ্য সাম্বুজকরং গিরমাহ কৃচ্ছ্রা
ন্নারায়ণাখিলগুরো ভগবন্ নমস্তে।। ৩২

অর্থ: সরোবরের ভিতরে সেই বলশালী কুমীর গজেন্দ্রকে ধরে রেখেছিল এবং গজেন্দ্র ভীষণ ব্যাকুল হয়ে উঠেছিল। যখন গজেন্দ্র আকাশে বিষ্ণু ভগবানকে চক্র হাতে নিয়ে গরুড়ে আরোহণ করে আসতে দেখল, তখন সে একটা পদ্মকে শুঁড়ে করে উপরে উঠিয়ে খুব কাতর স্বরে বলল, ‘হে নারায়ণ! হে জগদ্গুরু! ভগবান! আপনাকে প্রণাম’।। ৩২

শ্লোক ৩৩:
তং বীক্ষ্য পীড়িতমজঃ সহসাবতীৰ্য
সগ্রাহমাশু সরসঃ কৃপয়োজ্জহার।
গ্রাহাদ্ বিপাটিতমুখাদরিণা গজেন্দ্রং
সংপশ্যতাং হরিরমুমুচদুস্রিয়াণাম্।। ৩৩

অর্থ: যখন ভগবান গজেন্দ্রকে ভীষণ কাতর দেখলেন তখন গরুড়কে ত্যাগ করে করুণাবশে স্বয়ং জলে অবতীর্ণ হয়ে তৎক্ষণাৎ গজেন্দ্রের সঙ্গে কুমীরকে আকর্ষণ করে সরোবরের তীরে নিয়ে এলেন। অতঃপর সকল দেবতাদের সম্মুখেই চক্রের দ্বারা কুমীরের মুখকে ছিন্নভিন্ন করে গজেন্দ্রকে মুক্ত করলেন।। ৩৩



`,

nkc:`নারায়ণ কবচম্

মহারাজ পরীক্ষিৎ শ্রীল শুকদেব গোস্বামীর কাছে জিজ্ঞাসা করলেন – “হে মহর্ষে, দেবগুরু বৃহস্পতি তাঁর শিষ্য দেবতাদের কেন পরিত্যাগ করেছিলেন? দেবতারা তাঁর চরণে কি অপরাধ করেছিলেন? দয়া করে তা আমার কাছে বর্ণনা করুন।”

শ্রীল শুকদেব গোস্বামী বললেন – “হে রাজন, এক সময় দেবরাজ ইন্দ্র ত্রিভুবনের ঐশ্বর্য লাভে মদমত্ত হয়ে বৈদিক সদাচার লঙ্ঘন করেছিলেন।তিনি মরুদগণ, বসুগণ, রুদ্রগণ, আদিত্যগণ, ঋভুগণ, বিশ্বদেবগণ, সাধ্যগণ, অশ্বিনীকুমারদ্বয়, সিদ্ধ, চারণ, গন্ধর্ব এবং ব্রহ্মবাদী মুনিগণ কর্তৃক পরিবৃত হয়ে সভামগুলে সিংহাসনে উপবিষ্ট ছিলেন।বিদ্যাধর, অপ্সরা, কিন্নর, পতগ ও উরগেরা তাঁর সেবা এবং স্তব করছিলেন এবং অপ্সরা ও গন্ধর্বেরা তাঁর সম্মুখে অতি মধুর স্বরে গান করছিলেন। পূর্ণ চন্দ্রের মতো উজ্জ্বল শ্বেত ছত্র ইন্দ্রের মস্তকের উপর শোভা পাচ্ছিল এবং চামর , ব্যজন প্রভৃতি মহারাজ চক্রবর্তীর চিহ্নসমূহ সমন্বিত হয়ে ইন্দ্র তাঁর পত্নী শচীদেবী সহ সিংহাসনে উপবিষ্ট ছিলেন; তখন মহর্ষি বৃহস্পতি সেই সভায় এসে উপস্থিত হন। মুনিশ্রেষ্ঠ বৃহস্পতি ইন্দ্র এবং দেবতাদের গুরুদেব এবং তিনি সুর ও অসুর সকলেরই সম্মানিত। কিন্তু ইন্দ্র তাঁর গুরুদেবকে দর্শন করা সত্ত্বেও তাঁর আসন থেকে উঠে অভ্যর্থনা করলেন না অথবা তার গুরুদেবকে আসন প্রদান করলেন না। এইভাবে ইন্দ্র তাঁকে কোন প্রকার সম্মান প্রদর্শন করলেন না।”

“ভবিষ্যতে কি হবে বৃহস্পতি তা সবই জানতেন। ইন্দ্রের এই অসদ্ব্যবহার দর্শন করে তিনি বুঝতে পারলেন যে, ইন্দ্র তার ঐশ্বর্য মদে মত্ত হয়েছে। যদিও তিনি ইন্দ্রকে অভিশাপ দিতে সমর্থ ছিলেন তবুও তিনি তা করেননি। তিনি মৌনভাবে সভা ত্যাগ করে তাঁর নিজের গৃহে প্রত্যাবর্তন করেছিলেন।” “দেবরাজ ইন্দ্র তৎক্ষণাৎ তাঁর ভুল বুঝতে পেরেছিলেন।তিনি যে তাঁর গুরুদেবের প্রতি অশ্রদ্ধা প্রদর্শন করেছেন সেই কথা বুঝতে পেরে, তিনি সেই সভায় উপস্থিত সকলের সামনেই নিজের নিন্দা করতে লাগলেন।হায়, জড় ঐশ্বর্যের গর্বে গর্বিত হয়ে, অল্পবুদ্ধিবশত আমি কি শোচনীয় অন্যায় করেছি।সভায় সমাগত গুরুদেবকে অভ্যর্থনা না করে, আমি তাঁকে অপমান করেছি।যদিও আমি সাত্ত্বিক প্রকৃতি দেবতাদের রাজা, তবুও আমি সামান্য ধনমদে মত্ত হয়ে অহঙ্কারের দ্বারা কলুষিত হয়েছি।এই জগতে এই ধন-ঐশ্বর্য কে গ্রহণ করতে চায়, যার ফলে অধঃপতিত হওয়ার সম্ভাবনা থাকে ? হায় ! আমার এই ঐশ্বর্যকে ধিক্ যদি কেউ বলে, 'রাজসিংহাসনে উপবিষ্ট ব্যক্তিকে অন্য রাজা অথবা ব্রাহ্মণকে শ্রদ্ধা প্রদর্শন করার জন্য সিংহাসন থেকে উঠে দাঁড়াতে হবে না,বুঝতে হবে যে, সেই ব্যক্তি ধর্মের নীতি সম্বন্ধে সম্পূর্ণ অজ্ঞযে সমস্ত নেতারা অজ্ঞানের অন্ধকারে পতিত হয়েছে এবং যারা ধ্বংসের পথ প্রদর্শন করে মানুষকে বিপথে পরিচালিত করে, তারা প্রকৃতপক্ষে পাথরের তৈরি নৌকায় করে সমুদ্র পার হওয়ার চেষ্টা করছে;যারা অন্ধের মতো তাদের অনুসরণ করে, তারাও অচিরেই তাদের সঙ্গে নিমজ্জিত হবে, তেমনি যারা মানুষকে কুপথে পরিচালিত করে, তারা নরকগামী হয়, তাদের অনুগামীরাও তাদের সঙ্গে নরকে যায়।”

দেবরাজ ইন্দ্র বললেন—“তাই আমি এখন সরলভাবে নিষ্কপটে দেবগুরু বৃহস্পতির চরণকমলে আমার মস্তক অবনত করব, কারণ তিনি সমস্ত জ্ঞান পূর্ণরূপে আহরণ করেছেন এবং তিনি হচ্ছেন সর্বতোভাবে সত্ত্বগুণে অধিষ্ঠিত ব্রাহ্মণ। আমি আমার মস্তকের দ্বারা তাঁর শ্রীপাদপদ্ম স্পর্শ করে তাঁর প্রসন্নতা বিধানের চেষ্টা করব। দেবরাজ ইন্দ্র যখন এইভাবে তাঁর নিজের সভায় চিন্তা করছিলেন এবং অনুতাপ করছিলেন, তখন পরম শক্তিমান গুরু বৃহস্পতি তাঁর মনোভাব বুঝতে পেরে, তাঁর গৃহ ত্যাগ করে তাঁর আত্মমায়ার দ্বারা অদৃশ্য হয়েছিলেন। কারণ বৃহস্পতি আধ্যাত্মিক চেতনায় দেবরাজ ইন্দ্রের থেকে অনেক উন্নত ছিলেন।ইন্দ্র যদিও অন্য দেবতাগণ সহ সর্বত্র বৃহস্পতিকে খুঁজলেন, কিন্তু কোথাও তাঁকে খুঁজে পেলেন না।তখন ইন্দ্র ভাবলেন, ‘হায়, আমার গুরুদেব আমার প্রতি অসন্তুষ্ট হয়েছেন।এখন আমার সৌভাগ্য লাভের আর কোন উপায় নেই।ইন্দ্ৰ যদিও দেবতাদের দ্বারা পরিবেষ্টিত ছিলেন,তবুও তিনি মানসিক শান্তি পেলেন না। “ইন্দ্রের এই দুর্দশার কথা শুনে, দুষ্টমতি অসুরেরা তাদের গুরু শুক্রাচার্যের নির্দেশ অনুসারে, অস্ত্রশস্ত্রে সজ্জিত হয়ে দেবতাদের বিরুদ্ধে যুদ্ধ ঘোষণা করেছিল।অসুরদের তীক্ষ্ণ বাণের আঘাতে দেবতাদের মস্তক, ঊরু, বাহু প্রভৃতি অঙ্গ-সমূহ ক্ষত-বিক্ষত হয়েছিল। তখন ইন্দ্রাদি দেবতারা উপায়ন্তর না দেখে অবনত মস্তকে ভগবান  ব্রহ্মার শরণাপন্ন হয়েছিলেন। পরম শক্তিমান ব্রহ্মা যখন দেখলেন যে, অসুরদের বাণের আঘাতে ক্ষত-বিক্ষত দেহে দেবতারা তাঁর কাছে আসছেন,তখন তিনি অত্যন্ত দয়াপরবশ হয়ে তাঁদের সান্ত্বনা প্রদান করে বলতে লাগলেন—“হে সুরশ্রেষ্ঠগণ, দুর্ভাগ্যবশত ঐশ্বর্যমদে মত্ত হয়ে তোমরা তোমাদের সভায় সমাগত বৃহস্পতিকে যথাযথভাবে অভ্যর্থনা করনি,যেহেতু তিনি পরমব্রহ্ম সম্বন্ধে অবগত এবং সর্বতোভাবে ইন্দ্রিয়-দমনশীল, তাই তিনি হচ্ছেন সর্বশ্রেষ্ঠ ব্রাহ্মণ। অতএব এটি অত্যন্ত আশ্চর্যের বিষয় যে, তোমরা তাঁর প্রতি এই প্রকার দুর্ব্যবহার করেছ।হে দেবতাগণ, বৃহস্পতির প্রতি তোমাদের অন্যায় আচরণের ফলেই তোমরা অসুরদের দ্বারা পরাজিত হয়েছ।অসুরেরা তোমাদের থেকে দুর্বল, পূর্বে তারা কয়েকবার তোমাদের কাছে পরাজিত হয়েছে, তা হলে তোমরা অত্যন্ত সমৃদ্ধিশালী হওয়া সত্ত্বেও তাদের কাছে পরাজিত হলে । হে ইন্দ্ৰ, পূর্বে তোমার শত্রু দৈত্যরা তাদের গুরু শুক্রাচার্যের প্রতি অশ্রদ্ধা প্রদর্শন করার ফলে দুর্বল হয়েছিল, কিন্তু এখন গভীর ভক্তি সহকারে শুক্রাচার্যের আরাধনা করার ফলে, তারা অত্যন্ত শক্তিশালী হয়েছে। শুক্রাচার্যের প্রতি তাদের ভক্তির বলে তারা এতই শক্তিশালী হয়েছে যে, এখন তারা আমার ধামও অনায়াসে অধিকার করে নিতে পারে। শুক্রাচার্যের শিষ্য অসুরেরা তাদের গুরুর নির্দেশ পালনে দৃঢ়প্রতিজ্ঞ হওয়ার ফলে, দেবতাদের গণনাই করছে না। প্রকৃতপক্ষে, রাজা অথবা অন্যান্য যে সমস্ত ব্যক্তিরা ব্রাহ্মণ, গাভী এবং ভগবান শ্রীকৃষ্ণের কৃপার প্রতি দৃঢ় শ্রদ্ধাপরায়ণ এবং যাঁরা সর্বদা এই তিনের পূজা করেন, তাঁদের কখনও অমঙ্গল হয় না। হে দেবতাগণ, ত্বষ্টার পুত্র বিশ্বরূপকে তোমাদের গুরুরূপে বরণ কর। তিনি একজন শুদ্ধ, তপস্বী এবং অত্যন্ত শক্তিশালী ব্রাহ্মণ। তোমরা যদি অসুরদের প্রতি তাঁর পক্ষপাত সহ্য করে তাঁর ভজনা কর, তা হলে তিনি তোমাদের বাসনা পূর্ণ করবেন।”

শ্রীল শুকদেব গোস্বামী বললেন—“এইভাবে ব্ৰহ্মা কর্তৃক আদিষ্ট হয়ে এবং তাঁদের উৎকণ্ঠা থেকে মুক্ত হয়ে, সমস্ত দেবতারা ত্বষ্টার পুত্র বিশ্বরূপের কাছে গিয়েছিলেন এবং তাঁকে আলিঙ্গন করে বলেছিলেন, হে বিশ্বরূপ, তোমার মঙ্গল হোক। আমরা দেবতারা তোমার আশ্রমে অতিথিরূপে এসেছি ,আমরা তোমার পিতৃতুল্য, তাই আমাদের সময়োচিত বাসনা পূর্ণ কর।হে ব্ৰাহ্মণ, পুত্রবান হলেও পিতার সেবা করাই পুত্রের পরম ধর্ম, যাঁরা ব্রহ্মচারী, তাঁদের কথা আর কি বলব? যিনি উপনয়ন প্রদান করে বৈদিক জ্ঞান শিক্ষা দান করেন, সেই আচার্য হচ্ছেন বেদের মূর্তি।তেমনই, পিতা ব্রহ্মার মূর্তি, ভ্রাতা ইন্দ্রের মূর্তি, মাতা সাক্ষাৎ পৃথিবীর মূর্তি, ভগিনী দয়ার মূর্তি, অতিথি স্বয়ং ধর্মের মূর্তি, অভ্যাগত অগ্নিদেবের মূর্তি এবং সমস্ত জীবেরা হচ্ছেন ভগবান শ্রীবিষ্ণুর মূর্তি।হে পুত্র, আমরা শত্রুদের কাছে পরাজিত হয়ে অত্যন্ত দুঃখিত হয়েছি।তুমি তোমার তপোবলের দ্বারা আমাদের সেই দুঃখ দূর কর।আমাদের এই প্রার্থনা তুমি পূর্ণ কর।তুমি যেহেতু পূর্ণরূপে পরব্রহ্মকে জেনেছ, তাই তুমি একজন আদর্শ ব্রাহ্মণ এবং সমস্ত বর্ণের গুরু।আমরা তোমাকে আমাদের গুরু এবং পরিচালক রূপে বরণ করছি, যাতে তোমার তপোবলের প্রভাবে আমরা অনায়াসে শত্রুদের পরাজিত করতে পারি।”

“আমাদের কনিষ্ঠ বলে তুমি মনে কোন নিন্দার আশঙ্কা করো না, বৈদিক মন্ত্রের ক্ষেত্রে এই শিষ্টাচার প্রযোজ্য নয়। বৈদিক মন্ত্র ব্যতীত অন্য সমস্ত ক্ষেত্রে জ্যেষ্ঠত্ব নির্ধারিত হয় বয়সের পরিপ্রেক্ষিতে, কিন্তু বৈদিক মন্ত্র উচ্চারণে অধিক উন্নত হলে কনিষ্ঠও জ্যেষ্ঠের প্রণম্য অতএব যদিও সম্পর্কের দিক দিয়ে তুমি আমাদের কনিষ্ঠ তবুও তুমিই আমাদের পুরোহিত হবে, সেই জন্য কোন সংকোচ করো না।”

শ্রীল শুকদেব গোস্বামী বললেন — “সমস্ত দেবতারা যখন মহা তপস্বী বিশ্বরূপকে তাঁদের পুরোহিত হওয়ার জন্য অনুরোধ করলেন, তখন তিনি অত্যন্ত প্রসন্ন হয়ে উত্তর দিয়েছিলেন—হে দেবতাগণ, পৌরোহিত্য পূর্বলব্ধ ব্রহ্মতেজের ক্ষয়কারক বলে যদিও ধর্মশীল মুনিরা তার নিন্দা করেন, তবুও আমি কিভাবে আপনাদের প্রার্থনা প্রত্যাখ্যান করতে পারি? আপনারা ব্রহ্মাণ্ডের মহান অধ্যক্ষ। আমি আপনাদের শিষ্যসদৃশ এবং আপনাদের কাছ থেকে শিক্ষা গ্রহণ করাই আমার কর্তব্য। আমি আপনাদের প্রত্যাখ্যান করতে পারি না। তাই আমার নিজের মঙ্গলের জন্য আমি অবশ্যই আপনাদের অনুরোধ রক্ষা করব। হে বিভিন্ন লোকের অধীশ্বরগণ, শস্যক্ষেত্রে পরিত্যক্ত শস্যকণিকা গ্রহণ করে এবং হাটে পতিত শস্য গ্রহণ করে শিলোঞ্ছন বৃত্তির দ্বারাই আদর্শ অকিঞ্চন ব্রাহ্মণেরা দেহ ধারণ করেন। এইভাবে গৃহস্থ ব্রাহ্মণ তপস্যা করে নিজের এবং পরিবারের ভরণ-পোষণ করেন। এবং সর্বপ্রকার বাঞ্ছনীয় পুণ্যকর্ম অনুষ্ঠান করেন।যে ব্রাহ্মণ পৌরোহিত্য কর্মের দ্বারা ধন উপার্জন করে সুখভোগ করতে চান, তিনি অত্যন্ত নিচ মনোবৃত্তি সম্পন্ন। সেই প্রকার পৌরোহিত্য আমি কিভাবে গ্রহণ করব? আপনারা সকলে আমার গুরুজন।তাই, পৌরোহিত্য নিন্দনীয় হলেও, আমি আপনাদের স্বল্পমাত্র প্রার্থনাও প্রত্যাখ্যান করতে পারি না। আমি আমার ধন ও প্রাণ দিয়ে আপনাদের অনুরোধ সাধন করব।”

শ্রীল শুকদেব গোস্বামী বললেন – “হে রাজন, এইভাবে দেবতাদের প্রতিশ্রুতি দিয়ে মহাতপা বিশ্বরূপ দেবতাগণ পরিবৃত হয়ে পরম উদ্যম এবং মনোযোগ সহকারে পৌরোহিত্য-কার্য সম্পাদন করেছিলেন। শুক্রাচার্যের বিদ্যার দ্বারা যদিও দেবতাদের শত্রু দৈত্যদের ঐশ্বর্য রক্ষিত হয়েছিল, তবুও অত্যন্ত শক্তিমান বিশ্বরূপ নারায়ণ-কবচ নামক এক সুরক্ষাত্মক স্তোত্র রচনা পূর্বক সেই মন্ত্রের দ্বারা দৈত্যদের ঐশ্বর্য আহরণ করে তা মহেন্দ্রকে প্রদান করেছিলেন।অত্যন্ত উদারমতি বিশ্বরূপ সহস্রাক্ষ ইন্দ্রকে যে গুহ্য মন্ত্র প্রদান করেছিলেন, তা ইন্দ্রকে রক্ষা করেছিল এবং দৈত্য সৈন্যদের জয় করেছিল।


”মহারাজ পরীক্ষিৎ শুকদেব গোস্বামীকে জিজ্ঞাসা করলেন—“হে প্রভু, যে বিষ্ণুমন্ত্রের দ্বারা রক্ষিত হয়ে, দেবরাজ ইন্দ্র অনায়াসে বাহন সহ শত্রু সৈন্যদের জয় করে ত্রিলোকের ঐশ্বর্য ভোগ করেছিলেন, সেই বিষয়ে আমাকে বলুন। যে নারায়ণ-কবচের দ্বারা রক্ষিত হয়ে দেবরাজ ইন্দ্র যুদ্ধে বধোদ্যত শত্রুদের জয় করেছিলেন, সেই সম্বন্ধেও আমাকে বলুন।”

শ্রীল শুকদেব গোস্বামী বললেন—“দেবগণ কর্তৃক পুরোহিতরূপে নিযুক্ত বিশ্বরূপের কাছে দেবতাদের রাজা ,ইন্দ্র নারায়ণ-কবচ সম্বন্ধে জিজ্ঞাসা করলে তিনি যা বলেছিলেন, তা আমি বলছি, একাগ্র চিত্তে তা শ্রবণ করুন।”

বিশ্বরূপ বললেন—“যদি কোন ভয় উপস্থিত হয়, তা হলে হাত এবং পা ভালভাবে ধুয়ে তারপর, ওঁ অপবিত্রঃ পবিত্রো বা সর্বাবস্থাং গতোঽপি বা / যঃ স্মরেৎ পুণ্ডরীকাক্ষং স বাহ্যাভ্যন্তরঃ শুচিঃ / শ্রীবিষ্ণু শ্রীবিষ্ণু শ্রীবিষ্ণু—এই মন্ত্র উচ্চারণ করে আচমন করবে। তারপর কুশ গ্রহণ করে উত্তরমুখে মৌন অবলম্বনপূর্বক বসে শুদ্ধভাবে অষ্টাক্ষর মন্ত্রের(ওঁ নমো  নারায়ণায়) দ্বারা দেহের আটটি অঙ্গে অঙ্গন্যাস করবে এবং দ্বাদশ অক্ষর মন্ত্রের(ওঁ নমো ভগবতে বাসুদেবায়  ) দ্বারা করন্যাস করে নারায়ণ-কবচের দ্বারা নিম্নোক্তভাবে নিজেকে বন্ধন করবে। প্রথমে, ওঁ নমো নারায়ণায়—এই অষ্টাক্ষর মন্ত্র উচ্চারণ করে হস্তের দ্বারা শরীরের আটটি অঙ্গ—পদদ্বয়, জানুদ্বয়, ঊরুদ্বয়, হৃদয়, উদর, বক্ষঃস্থল, মুখ ও মস্তক যথাক্রমে স্পর্শ করবে। তারপর বিপরীতভাবে অর্থাৎ ‘য়’ থেকে ‘ওঁ’ পর্যন্ত বর্ণসমূহ পা থেকে মাথা পর্যন্ত সংহার-ন্যাস করে পুনরায় ওঁ’ থেকে ‘য়’পর্যন্ত বর্ণসকল মাথা থেকে পা পর্যন্ত ক্রমে উৎপত্তি-ন্যাস করবে। এইভাবে উৎপত্তি ন্যাস এবং সংহার-ন্যাস করা কর্তব্য। তারপর ‘ওঁ’ নমো ভগবতে বাসুদেবায়’ এই দ্বাদশ অক্ষর মন্ত্রে করন্যাস করবে। এই মন্ত্রের এক-একটি অক্ষর প্রণব যুক্ত করে, ডান হাতের তর্জনী থেকে শুরু করে বাম হাতের তর্জনী পর্যন্ত এই আটটি আঙ্গুলে আটটি বর্ণ ন্যাস করবে। তারপর অবশিষ্ট চারটি অক্ষর দুই হাতের অঙ্গুষ্ঠের দুটি পর্বে ন্যাস করবে। তারপর ‘ওঁ’ বিষ্ণবে নমঃ'—এই ছয় অক্ষর সমন্বিত মন্ত্র ন্যাস করতে হবে, যথা হৃদয়ে ‘ওঁ—এই বর্ণ ন্যাস করবে, পরে মস্তকে ‘বি’–এই বর্ণ, ভ্রূযুগলের মধ্যে ‘ষ’কার, শিখাগুচ্ছে ‘ণ’- কার, নেত্রদ্বয়ের মধ্যে ‘বে’ ন্যাস করবে। তারপর মন্ত্রজপকর্তা ‘ন’-কার তাঁর দেহের সমস্ত সন্ধিস্থলে ন্যাস করে ‘ম’-কারকে অস্ত্ররূপে চিন্তা করে ধ্যান করবে। এইভাবে তিনি স্বয়ং মন্ত্রমূর্তি হবেন। তারপর অন্তিম ম’- কারের সঙ্গে বিসর্গ যুক্ত করে, পূর্ব দিক থেকে শুরু করে সর্বদিকে ‘মঃ অস্ত্রায় ফট্’–এই মন্ত্র উচ্চারণ করবেন। এইভাবে সমস্ত দিক এই মন্ত্ররূপ কবচের দ্বারা বন্ধন করা হবে। এই ন্যাস সমাপ্তির পর নিজেকে ষড়ৈশ্বর্যপূর্ণ এবং ধ্যেয় পরমেশ্বর ভগবানের সঙ্গে গুণগতভাবে এক বলে চিন্তা করতে হবে। তারপর নারায়ণ কবচ নামক মন্ত্র জপ করবেন ।
                           
                                ওঁ শ্রীগণেশায় নমঃ
ওঁ হরির্বিদধ্যান্মম সর্বরক্ষাং
        ন্যস্তাঙ্ঘ্রিপদ্মঃ পতগেন্দ্রপৃষ্ঠে ।
দরারিচর্মাসিগদেষুচাপ-
        পাশান্দধানোঽষ্টগুণোঽষ্টবাহুঃ 
জলেষু মাং রক্ষতু মৎস্যমূর্তি-
         র্যাদোগণেভ্যো বরুণস্য পাশাৎ ।
স্থলেষু মায়াবটুবামনোঽব্যাৎ
        ত্রিবিক্রমঃ খেঽবতু বিশ্বরূপঃ

যিনি গরুড়ের পৃষ্ঠদেশে আসীন হয়ে তার শ্রীপাদপদ্মের দ্বারা তাকে স্পর্শ করছেন এবং যিনি আট হাতে শঙ্খ, চক্র, ঢাল, খড়, গদা, বাণ, ধনুক এবং পাশ ধারণ করে বিরাজ করছেন, সেই পরমেশ্বর ভগবান তাঁর আট হাতের দ্বারা আমাকে সর্বদা রক্ষা করুণ।তিনি সর্বশক্তিমান, কারণ তিনি অণিমা, লঘিমা আদি অষ্ট ঐশ্বর্য সমন্বিত। জলে বরুণ দেবতার পার্ষদ হিংস্র জলজন্তুদের থেকে মৎস্যরূপী ভগবান আমাকে রক্ষা করুন। মায়াবলে যিনি বামনরূপ ধারণ করেছিলেন, সেই ভগবান বামনদেব আমাকে স্থলে রক্ষা করুন। ভগবানের যে বিরাটস্বরূপ বিশ্বরূপ ত্রিলোক জয় করেছিল, তিনি আমাকে গগনমণ্ডলে রক্ষা করুন।

দুর্গেষ্বটব্যাজিমুখাদিষু প্রভুঃ
        পায়ান্নৃসিংহোঽসুরয়ূথপারিঃ ।
বিমুঞ্চতো যস্য মহাট্টহাসং
        দিশো বিনেদুর্ন্যপতংশ্চ গর্ভাঃ
 
 যার ভয়ঙ্কর অট্টহাসির শব্দে দিকমণ্ডল প্রতিধ্বনিত হয়েছিল এবং অসুর-পত্নীদের গর্ভ নিপতিত হয়েছিল, সেই হিরণ্যকশিপুর শত্রু ভগবান নৃসিংহদেব অরণ্য, যুদ্ধক্ষেত্র আদি দুর্গম স্থানে আমাকে রক্ষা করুন।

রক্ষত্বসৌ মাধ্বনি যজ্ঞকল্পঃ
           স্বদংষ্ট্রয়োন্নীতধরো বরাহঃ ।
রামোঽদ্রিকূটেষ্বথ বিপ্রবাসে
            সলক্ষ্মণোঽব্যাদ্ভরতাগ্রজোঽস্মান্ ॥

পরম অবিনশ্বর ভগবানকে যজ্ঞের মাধ্যমে জানা যায় এবং তাই তিনি যজ্ঞেশ্বর নামে পরিচিত। তিনি বরাহ অবতাররূপে রসাতল থেকে তাঁর তীক্ষ্ণ দশনাগ্রভাগ দ্বারা পৃথিবীকে উত্তোলন করেছিলেন। তিনি আমাকে পথের মধ্যে দুর্বৃত্তদের থেকে রক্ষা করুন। পরশুরামরূপী ভগবান আমাকে পর্বত-শিখরে রক্ষা করুন এবং ভরতাগ্রজ শ্রীরামচন্দ্র লক্ষ্মণ সহ আমাকে প্রবাসে রক্ষা করুন।

মামুগ্রধর্মাদখিলাৎপ্রমাদা-
           ন্নারায়ণঃ পাতু নরশ্চ হাসাৎ ।
দত্তস্ত্বয়োগাদথ যোগনাথঃ
           পায়াদ্গুণেশঃ কপিলঃ কর্মবন্ধাৎ

অনাবশ্যক ধর্ম এবং প্রমাদবশত বিহিত কর্মের লঙ্ঘন থেকে নারায়ণ আমাকে রক্ষা করুন। নররূপী ভগবান আমাকে গর্ব থেকে রক্ষা করুন, যোগেশ্বর দত্তাত্রেয়রূপী ভগবান আমাকে ভক্তিযোগের পতন হতে রক্ষা করুন এবং সমস্ত সৎ গুণের ঈশ্বর কপিলরূপী ভগবান আমাকে সংসার-বন্ধন থেকে রক্ষা করুন। 

সনৎকুমারোঽবতু কামদেবা-
          দ্ধয়শীর্ষা মাং পথি দেবহেলনাৎ ।
দেবর্ষিবর্যঃ পুরুষার্চনান্তরাৎ
          কূর্মো হরির্মাং নিরয়াদশেষাৎ

ভগবান সনৎকুমার আমাকে কামবাসনা থেকে রক্ষা করুন, ভগবান হয়গ্রীব আমাকে ভগবানের শ্রীবিগ্রহের প্রতি শ্রদ্ধা প্রদর্শনে অবহেলা জনিত অপরাধ থেকে রক্ষা করুন। দেবর্ষি নারদ আমাকে শ্রীবিগ্রহের অর্চনার অপরাধ থেকে রক্ষা করুন এবং কূর্মরূপী ভগবান আমাকে অশেষ নরক থেকে রক্ষা করুন। 

ধন্বন্তরির্ভগবান্পাত্বপথ্যা-
         দ্দ্বন্দ্বাদ্ভয়াদৃষভো নির্জিতাত্মা ।
যজ্ঞশ্চ লোকাদবতাঞ্জ্জনান্তা-
         দ্বলো গণাৎক্রোধবশাদহীন্দ্রঃ

ভগবান ধন্বন্তরি শরীরের ব্যাধিজনক দ্রব্যাদি ভক্ষণ থেকে আমাকে রক্ষা করুন। অন্তরেন্দ্রিয় ও বহিরেন্দ্রিয় বিজয়ী ঋষভদেব আমাকে শীতোষ্ণাদি দ্বৈতভাব জনিত ভয় থেকে রক্ষা করুন। ভগবান যজ্ঞ আমাকে লোকের অপবাদ থেকে রক্ষা করুন এবং শেষরূপী ভগবান বলরাম আমাকে ক্রোধান্ধ সর্পদের থেকে রক্ষা করুন। 

দ্বৈপায়নো ভগবানপ্রবোধা-
         দ্বুদ্ধস্তু পাখণ্ডগণপ্রমাদাৎ ।
কল্কিঃ কলেঃ কালমলাৎপ্রপাতু
         ধর্মাবনায়োরুকৃতাবতারঃ ॥

ব্যাসদেব রূপী ভগবান আমাকে বৈদিক জ্ঞানের অভাব জনিত সর্বপ্রকার অজ্ঞান থেকে রক্ষা করুন। ভগবান বুদ্ধদেব আমাকে বেদবিরুদ্ধ আচরণ এবং আলস্যবশত বেদবিহিত অনুষ্ঠানের বিমুখতারূপ প্রমাদ থেকে রক্ষা করুন এবং ধর্মরক্ষার জন্য যিনি অবতরণ করেন, সেই ভগবান কল্কিদেব আমাকে কলিযুগের কলুষ থেকে রক্ষা করুন। 

মাং কেশবো গদয়া প্রাতরব্যা-
         দ্গোবিন্দ আসঙ্গবমাত্তবেণুঃ ।
নারায়ণঃ প্রাহ্ণ উদাত্তশক্তি-
         র্মধ্যন্দিনে বিষ্ণুররীন্দ্রপাণিঃ

দিনের প্রথম ভাগে ভগবান কেশব তাঁর গদার দ্বারা আমাকে রক্ষা করুন, দিনের দ্বিতীয় ভাগে সর্বদা বেণুবাদনরত গোবিন্দ আমাকে রক্ষা করুন, সর্বশক্তি সমন্বিত নারায়ণ আমাকে দিনের তৃতীয় ভাগে রক্ষা করুন এবং দিনের চতুর্থ ভাগে চক্রহস্ত বিষ্ণু আমাকে রক্ষা করুন।

দেবোঽপরাহ্নে মধুহোগ্রধন্বা
         সায়ং ত্রিধামাবতু মাধবো মাম্ ।
দোষে হৃষীকেশ উতার্ধরাত্রে
         নিশীথ একোঽবতু পদ্মনাভঃ
 
 অসুরদের জন্য ভয়ঙ্কর ধনুর্ধারী ভগবান মধুসুদন দিনের পঞ্চম ভাগে আমাকে রক্ষা করুন, সন্ধ্যায় ব্ৰহ্মা, বিষ্ণু এবং মহেশ্বররূপে প্রকাশিত ভগবান মাধব আমাকে রক্ষা করুন, রাত্রির প্রথম ভাগে ভগবান হৃষীকেশ আমাকে রক্ষা করুন এবং অর্ধরাত্রে ও নিশীথে (রাত্রির দ্বিতীয় ও তৃতীয় ভাগে) ভগবান পদ্মনাভ আমাকে রক্ষা করুন।

শ্রীবৎসধামাপররাত্র ঈশঃ
         প্রত্যূষ ঈশোঽসিধরো জনার্দনঃ ।
দামোদরোঽব্যাদনুসন্ধ্যং প্রভাতে
         বিশ্বেশ্বরো ভগবান্ কালমূর্তিঃ

রাত্রির নিশীথকাল থেকে অরুণোদয় কাল পর্যন্ত বক্ষে শ্রীবৎস চিহ্নধারী শ্রীভগবান আমাকে রক্ষা করুন, প্রত্যূষকালে অর্থাৎ রাত্রির চতুর্থ ভাগে অসিধারী ভগবান জনার্দন আমাকে রক্ষা করুন, প্রভাতকালে দামোদর আমাকে রক্ষা করুন এবং প্রতি সন্ধি সময়ে কালমূর্তি ভগবান বিশ্বেশ্বর আমাকে রক্ষা করুন। 

চক্রং যুগান্তানলতিগ্মনেমি
         ভ্রমৎসমন্তাদ্ভগবৎপ্রয়ুক্তম্ ।
দন্দগ্ধি দন্দগ্ধ্যরিসৈন্যমাশু
         কক্ষং যথা বাতসখো হুতাশঃ

চতুর্দিকে ভ্রমণপূর্বক বায়ুর সহায়তায় আগুন যেমন তৃণরাশিকে ভস্মীভূত করে, সেইভাবে প্রলয়কালীন অগ্নির মতো প্রখর প্রান্তভাগ বিশিষ্ট সুদর্শন-চক্র ভগবান কর্তৃক নিযুক্ত হয়ে, আমাদের শত্রুদের ভস্মীভূত করুক।

গদেঽশনিস্পর্শনবিস্ফুলিঙ্গে
         নিষ্পিণ্ঢি নিষ্পিণ্ঢ্যজিতপ্রিয়াসি ।
কূষ্মাণ্ডবৈনায়কয়ক্ষরক্ষো-
         ভূতগ্রহাংশ্চূর্ণয় চূর্ণয়ারীন্ ॥

হে ভগবানের গদা, তোমার স্পর্শের ফলে বজ্রের মতো অগ্নিস্ফুলিঙ্গ উৎপন্ন হয় এবং তুমি ভগবানের অত্যন্ত প্রিয়। আমিও তাঁর দাস। অতএব তুমি দয়া করে আমাদের শত্রু – কুষ্মাণ্ড, বিনায়ক, যক্ষ, রাক্ষস, ভূত এবং গ্রহগণকে নিষ্পেষিত ও চূর্ণ-বিচূর্ণ কর।

ত্বং যাতুধানপ্রমথপ্রেতমাতৃ-
         পিশাচবিপ্রগ্রহঘোরদৃষ্টীন্ ।
দরেন্দ্র বিদ্রাবয় কৃষ্ণপূরিতো
         ভীমস্বনোঽরের্হৃদয়ানি কম্পয়ন্ ॥ ২৫॥

হে শঙ্খরাজ পাঞ্চজন্য, তুমি শ্রীকৃষ্ণের মুখমারুতে পূর্ণ হয়ে ভয়ঙ্কর শব্দ সহকারে শত্রুদের হৃদয় কম্পিত করে রাক্ষস, প্রমথ, প্রেত, মাতৃকা, পিশাচ এবং ভয়ঙ্কর দৃষ্টি সমন্বিত ব্রহ্মরাক্ষসদের বিদূরিত কর।

ত্বং তিগ্মধারাসিবরারিসৈন্য-
         মীশপ্রয়ুক্তো মম ছিন্ধি ছিন্ধি ।
চক্ষূংষি চর্মঞ্ছতচন্দ্র ছাদয়
         দ্বিষামঘোনাং হর পাপচক্ষুষাম্

হে তীক্ষ্ণধার খগরাজ, তুমি ভগবান কর্তৃক নিযুক্ত হয়ে আমার শত্রুদের খণ্ড খণ্ড কর। হে শতচন্দ্রাকৃতি মণ্ডল- বিশিষ্ট চর্ম (ঢাল), তুমি পাপাত্মা শত্রুদের চক্ষু আচ্ছাদন কর এবং তাদের পাপপূর্ণ চক্ষু অপহরণ কর। 

যন্নো ভয়ং গ্রহেভ্যোঽভূৎকেতুভ্যো নৃভ্য এব চ ।
সরীসৃপেভ্যো দংষ্ট্রিভ্যো ভূতেভ্যোংঽহোভ্য এব চ

ভগবানের দিব্য নাম, রূপ, গুণ এবং বৈশিষ্ট্যের কীর্তন দুষ্ট গ্রহের প্রভাব, উল্কাপাত, ঈর্ষাপরায়ণ মানুষ, সরীসৃপ, বৃশ্চিক, বাঘ-সিংহ আদি হিংস্র প্রাণী, ভূত-প্রেত, মাটি, জল, আগুন, বায়ু প্রভৃতির উপদ্রব, বিদ্যুৎ এবং পূর্বকৃত পাপ থেকে আমাদের রক্ষা করুক।

সর্বাণ্যেতানি ভগবন্নামরূপাস্ত্রকীর্তনাৎ ।
প্রয়ান্তু সঙ্ক্ষয়ং সদ্যো যে নঃ শ্রেয়ঃপ্রতীপকাঃ
 
 আমাদের মঙ্গলময় জীবনের প্রতিবন্ধকতার ভয়ে আমরা সর্বদা ভীত। তাই  ভগবানের নাম ও রূপ এর  কীর্তনের ফলে এই সব সম্পূর্ণরূপে বিনষ্ট হোক। 

গরুডো ভগবান্ স্তোত্রস্তোভশ্ছন্দোময়ঃ প্রভুঃ ।
রক্ষত্বশেষকৃচ্ছ্রেভ্যো বিষ্বক্সেনঃ স্বনামভিঃ

ভগবান বিষ্ণুর বাহন প্রভু গরুড় ভগবানেরই মতো শক্তিমান। তিনি বেদমূর্তি এবং বিশেষ মন্ত্রের দ্বারা তিনি পূজিত হন।তিনি আমাদের সমস্ত ভয়ঙ্কর পরিস্থিতি থেকে রক্ষা করুন এবং ভগবান বিষ্বক্সেন তাঁর পবিত্র নামের দ্বারা আমাদের সমস্ত সঙ্কট থেকে রক্ষা করুন।

সর্বাপদ্ভ্যো হরের্নামরূপয়ানায়ুধানি নঃ ।
বুদ্ধীন্দ্রিয়মনঃপ্রাণান্পান্তু পার্ষদভূষণাঃ ॥ ৩০॥

ভগবানের পবিত্র নাম, তাঁর চিন্ময় রূপ, তাঁর বাহন, অস্ত্র প্রভৃতি যাঁরা তাঁর পার্ষদের মতো তাঁকে অলঙ্কৃত করেন, তাঁরা আমাদের বুদ্ধি, ইন্দ্ৰিয়, মন ও প্রাণকে সমস্ত বিপদ থেকে রক্ষা করুন।

যথা হি ভগবানেব বস্তুতঃ সদসচ্চ যৎ ।
সত্যেনানেন নঃ সর্বে যান্তু নাশমুপদ্রবাঃ

সূক্ষ্ম এবং স্থূল জগৎ হচ্ছে জড়, কিন্তু তা সত্ত্বেও তা ভগবান থেকে অভিন্ন, কারণ চরমে তিনিই হচ্ছেন সর্বকারণের পরম কারণ। প্রকৃতপক্ষে কার্য এবং কারণ এক, কেননা কার্যের মধ্যে কারণ বিদ্যমান রয়েছে। তাই পরম সত্য ভগবান তাঁর যে কোন অংশের দ্বারা আমাদের সমস্ত বিপদ বিনাশ করতে পারেন।

যথৈকাত্ম্যানুভাবানাং বিকল্পরহিতঃ স্বয়ম্ ।
ভূষণায়ুধলিঙ্গাখ্যা ধত্তে শক্তীঃ স্বমায়যা

ঈশ্বর, জীব, মায়া এবং জগৎ—এই সবই বস্তু। বস্তুতত্ত্ব বিচারে তাদের মধ্যে কোন পার্থক্য নেই; চরমে তারা এক বাস্তব বস্তু ভগবান। তাই যাঁরা পারমার্থিক জ্ঞানে উন্নত, তাঁরা বৈচিত্র্যের মধ্যে ঐক্য দর্শন করেন।
 এই প্রকার উন্নত চেতনা সমন্বিত ব্যক্তিদের কাছে ভগবানের অঙ্গের ভূষণ, তাঁর নাম, তাঁর যশতাঁর গুণ, তাঁর রূপ, তাঁর আয়ুধ প্রভৃতি সব কিছুই তাঁর শক্তির প্রকাশ। 

তেনৈব সত্যমানেন সর্বজ্ঞো ভগবান্ হরিঃ ।
পাতু সর্বৈঃ স্বরূপৈর্নঃ সদা সর্বত্র সর্বগঃ

তাঁদের উন্নত চিন্ময় জ্ঞানের প্রভাবে তাঁরা জানেন যে, বিভিন্ন রূপে প্রকাশিত সর্বব্যাপ্ত ভগবান সর্বত্রই উপস্থিত। তিনি সর্বদা আমাদের সমস্ত বিপদ থেকে রক্ষা করুন। 

বিদিক্ষু দিক্ষূর্ধ্বমধঃ সমন্তা-
             দন্তর্বহির্ভগবান্নারসিংহঃ ।
প্রহাপয়ঁলোকভয়ং স্বনেন
             স্বতেজসা গ্রস্তসমস্ততেজাঃ

প্রহ্লাদ মহারাজ উচ্চস্বরে নৃসিংহদেবের পবিত্র নাম কীর্তন করেছিলেন।বড় বড়  অসুর নেতাদের দ্বারা সমস্ত দিকে বিষ, অস্ত্র, জল, অগ্নি, বায়ু ইত্যাদির দ্বারা যে সমস্ত বিপদ সৃষ্টি হয়েছে, ভক্ত প্রহ্লাদ মহারাজের জন্য গর্জনকারী নৃসিংহদেব তা থেকে আমাদের রক্ষা করুন। ভগবান তাঁর স্বীয় চিন্ময় প্রভাবের দ্বারা তাদের প্রভাব আচ্ছাদিত করুন। সর্বপ্রান্তে, উপরে, নিচে, অন্তরে, বাইরে এবং সর্বত্রই নৃসিংহদেব আমাদের রক্ষা করুন।”

বিশ্বরূপ বললেন—“হে ইন্দ্র, নারায়ণের সঙ্গে সম্পর্কিত এই দিব্য কবচের বর্ণনা আমি আপনার কাছে করলাম। এই কবচ ধারণ করার ফলে, আপনি নিশ্চিতভাবে অসুর নেতাদের জয় করতে পারবেনকেউ যদি এই কবচ ধারণ করে তাঁর চক্ষুর দ্বারা কাউকে দর্শন করেন অথবা তাঁর পায়ের দ্বারা কাউকে স্পর্শ করেন, তা হলে সেও তৎক্ষণাৎ উপরোক্ত সমস্ত ভয় থেকে মুক্ত হবেযেই ব্যক্তি এই নারায়ণ-কবচ নামক বিদ্যা ধারণ করেন, তাঁর কোন কালেও রাজা, দস্যু, অসুর অথবা ব্যাধি প্রভৃতি কোন বিষয় থেকে ভয় থাকবে না।”

“হে দেবরাজ, পুরাকালে কৌশিক নামক এক ব্রাহ্মণ এই কবচ ধারণ করে মরুপ্রদেশে যোগবলে দেহত্যাগ করেনব্রাহ্মণ যে স্থানে তাঁর দেহত্যাগ করেছিলেন,
গন্ধর্বরাজ চিত্ররথ এক সময় বহু সুন্দরী রমণী পরিবৃত হয়ে, বিমানে করে সেই স্থানের উপর দিয়ে যাচ্ছিলেন। চিত্ররথ হঠাৎ অধোমস্তক হয়ে তাঁর বিমান সহ আকাশ থেকে নিপতিত হয়েছিলেন।তারপর বালিখিল্য ঋষির নির্দেশ অনুসারে তিনি সেই ব্রাহ্মণের অস্থিগুলি পূর্ববাহিনী সরস্বতী নদীতে নিক্ষেপ করে তাতে স্নান করেছিলেন। তারপর তিনি অত্যন্ত বিস্মিত হয়ে তাঁর ধাম গন্ধর্বলোকে গমন করেছিলেন।”

শ্রীল শুকদেব গোস্বামী বললেন—“হে মহারাজ পরীক্ষিৎ, যে ব্যক্তি ভয় উপস্থিত হলে এই কবচ ধারণ করেন অথবা শ্রদ্ধা সহকারে সেই সম্পর্কে শ্রবণ করেন, তিনি তৎক্ষণাৎ সমস্ত বিপদ থেকে মুক্ত হন এবং সমস্ত জীবের পূজ্য হন।শতক্রতু ইন্দ্র বিশ্বরূপের কাছ থেকে এই বিদ্যা লাভ করেছিলেন এবং অসুরদের পরাজিত করে তিনি ত্রিভুবনের সমস্ত সম্পদ ভোগ করেছিলেন।
`,

  vs2:`শ্রী বিষ্ণু শতনাম স্তোত্রম্
(বিষ্ণু পুরাণ)

বাসুদেবং হৃষীকেশং বামনং জলশায়িনম্ ।
জনার্দনং হরিং কৃষ্ণং শ্রীবক্ষং গরুডধ্বজম্ ॥ ১ ॥

বারাহং পুণ্ডরীকাক্ষং নৃসিংহং নরকান্তকম্ ।
অব্যক্তং শাশ্বতং বিষ্ণুমনন্তমজমব্যযম্ ॥ ২ ॥

নারায়ণং গদাধ্যক্ষং গোবিন্দং কীর্তিভাজনম্ ।
গোবর্ধনোদ্ধরং দেবং ভূধরং ভুবনেশ্বরম্ ॥ ৩ ॥

বেত্তারং যজ্ঞপুরুষং যজ্ঞেশং যজ্ঞবাহনম্ ।
চক্রপাণিং গদাপাণিং শঙ্খপাণিং নরোত্তমম্ ॥ ৪ ॥

বৈকুণ্ঠং দুষ্টদমনং ভূগর্ভং পীতবাসসম্ ।
ত্রিবিক্রমং ত্রিকালজ্ঞং ত্রিমূর্তিং নন্দকেশ্বরম্ ॥ ৫ ॥

রামং রামং হয়গ্রীবং ভীমং রৌদ্রং ভবোদ্ভবম্ ।
শ্রীপতিং শ্রীধরং শ্রীশং মঙ্গলং মঙ্গলায়ুধম্ ॥ ৬ ॥

দামোদরং দমোপেতং কেশবং কেশিসূদনম্ ।
বরেণ্যং বরদং বিষ্ণুমানন্দং বসুদেবজম্ ॥ ৭ ॥

হিরণ্যরেতসং দীপ্তং পুরাণং পুরুষোত্তমম্ ।
সকলং নিষ্কলং শুদ্ধং নির্গুণং গুণশাশ্বতম্ ॥ ৮ ॥

হিরণ্যতনুসংকাশং সূর্যায়ুতসমপ্রভম্ ।
মেঘশ্যামং চতুর্বাহুং কুশলং কমলেক্ষণম্ ॥ ৯ ॥

জ্যোতীরূপমরূপং চ স্বরূপং রূপসংস্থিতম্ ।
সর্বজ্ঞং সর্বরূপস্থং সর্বেশং সর্বতোমুখম্ ॥ ১০ ॥

জ্ঞানং কূটস্থমচলং জ্ঞানদং পরমং প্রভুম্ ।
যোগীশং যোগনিষ্ণাতং যোগিসংযোগরূপিণম্ ॥ ১১ ॥

ঈশ্বরং সর্বভূতানাং বন্দে ভূতময়ং প্রভুম্ ।
ইতি নামশতং দিব্যং বৈষ্ণবং খলু পাপহম্ ॥ ১২ ॥

ব্যাসেন কথিতং পূর্বং সর্বপাপপ্রণাশনম্ ।
যঃ পঠেৎ প্রাতরুত্থায় স ভবেদ্বৈষ্ণবো নরঃ ॥ ১৩ ॥

সর্বপাপবিশুদ্ধাত্মা বিষ্ণুসাযুজ্যমাপ্নুয়াৎ ।
অশ্বমেধায়ুতং পুণ্যং ফলং প্রাপ্নোতি মানবঃ ॥ ১৪ ॥

॥ ইতি শ্রীবিষ্ণুপুরাণে শ্রী বিষ্ণু শতনাম স্তোত্রম্ সম্পূর্ণম্ ॥`,

  bss:`বেদসার শিব স্তব

পশূনাং পতিং পাপনাশং পরেশং
গজেন্দ্রস্য কৃত্তিং বসানং বরেণ্যম্ ।
জটাজূটমধ্যে স্ফুরদ্গাঙ্গবারিং
মহাদেবমেকং স্মরামি স্মরারিম্ ॥ ১ ॥

মহেশং সুরেশং সুরারাতিনাশং
বিভুং বিশ্বনাথং বিভূত্যঙ্গভূষম্ ।
বিরূপাক্ষমিন্দ্বর্কবহ্নিত্রিনেত্রং
সদানন্দমীড়ে প্রভুং পঞ্চবক্ত্রম্ ॥ ২ ॥

গিরীশং গণেশং গলে নীলবর্ণং
গবেন্দ্রাধিরূঢ়ং গুণাতীতরূপম্ ।
ভবং ভাস্বরং ভস্মনা ভূষিতাঙ্গং
ভবানীকলত্রং ভজে পঞ্চবক্ত্রম্ ॥ ৩ ॥

শিবাকান্ত শম্ভো শশাঙ্কার্ধমৌলে
মহেশান শূলিন্ জটাজূটধারিন্ ।
তমেকো জগদ্ব্যাপকো বিশ্বরূপঃ
প্রসীদ প্রসীদ প্রভো পূর্ণরূপ ॥ ৪ ॥

পরমাত্মানমেকং জগদ্বীজমাদ্যং
নিরীহং নিরাকারমোঙ্কারবেদ্যম্ ।
যতো জায়তে পাল্যতে যেন বিশ্বং
তমীশং ভজে লীয়তে যত্র বিশ্বম্ ॥ ৫ ॥

ন ভূমির্ন চাপো ন বহ্নির্ন বায়ুঃ
ন চাকাশমাস্তে ন তন্দ্রা ন নিদ্রা ।
ন গ্রীষ্মো ন শীতং ন দেশো ন বেশো
ন যস্যাস্তি মূর্তিস্ত্রিমূর্তিং তমীড়ে ॥ ৬ ॥

অজং শাশ্বতং কারণং কারণানাং
শিবং কেবলং ভাসকং ভাসকানাম্ ।
তুরীয়ং তমঃপারমাদ্যন্তহীনং
প্রপদ্যে পরং পাবনং দ্বৈতহীনম্ ॥ ৭ ॥

নমস্তে নমস্তে বিভো বিশ্বমূর্তে
নমস্তে নমস্তে চিদানন্দমূর্তে ।
নমস্তে নমস্তে তপোযোগগম্য
নমস্তে নমস্তে শ্রুতিজ্ঞানগম্য ॥ ৮ ॥

প্রভো শূলপাণে বিভো বিশ্বনাথ
মহাদেব শম্ভো মহেশ ত্রিনেত্র ।
শিবাকান্ত শান্ত স্মরারে পুরারে
ত্বদন্যো বরেণ্যো ন মান্যো ন গণ্যঃ ॥ ৯ ॥

শম্ভো মহেশ করুণাময় শূলপাণে
গৌরীপতে পশুপতে পশুপাশনাশিন্ ।
কাশীপতে করুণয়া জগদেতদেক-
স্ত্বং হংসি পাসি বিদধাসি মহেশ্বরোঽসি ॥ ১০ ॥

তত্ত্বং জগদ্ভবতি দেব ভব স্মরারে
ত্বয়েব তিষ্ঠতি জগন্মৃড় বিশ্বনাথ ।
ত্বয়েব গচ্ছতি লয়ং জগদেতদীশ
লিঙ্গাত্মক হর চরাচরবিশ্বরূপিন্ ॥ ১১ ॥

॥ ইতি বেদসার শিব স্তব সম্পূর্ণম্ ॥`,

  ans:`অর্ধনারীশ্বরস্তোত্রম্
(শ্রীমৎ শঙ্করাচার্যবিরচিত)

চাম্পেয়গৌরার্ধশরীরকায়ৈ কর্পূরগৌরার্ধশরীরকায় ।
ধম্মিল্লকায়ৈ চ জটাধরায় নমঃ শিবায়ৈ চ নমঃ শিবায় ॥ ১॥

কস্তূরিকাকুঙ্কুমচর্চিতায়ৈ চিতারজঃপুঞ্জবিচর্চিতায় ।
কৃতস্মরায়ৈ বিকৃতস্মরায় নমঃ শিবায়ৈ চ নমঃ শিবায় ॥ ২॥

ঝণৎক্বণৎকঙ্কণনূপুরায়ৈ পাদাব্জরাজৎফণিনূপুরায় ।
হেমাঙ্গদায়ৈ ভুজগাঙ্গদায় নমঃ শিবায়ৈ চ নমঃ শিবায় ॥ ৩॥

বিশালনীলোৎপললোচনায়ৈ বিকাসিপঙ্কেরুহলোচনায় ।
সমেক্ষণায়ৈ বিষমেক্ষণায় নমঃ শিবায়ৈ চ নমঃ শিবায় ॥ ৪॥

মন্দারমালাকলিতালকায়ৈ কপালমালাঙ্কিতকন্ধরায় ।
দিব্যাম্বরায়ৈ চ দিগম্বরায় নমঃ শিবায়ৈ চ নমঃ শিবায় ॥ ৫॥

অম্ভোধরশ্যামলকুন্তলায়ৈ তডিৎপ্রভাতাম্রজটাধরায় ।
নিরীশ্বরায়ৈ নিখিলেশ্বরায় নমঃ শিবায়ৈ চ নমঃ শিবায় ॥ ৬॥

প্রপঞ্চসৃষ্ট্যুন্মুখলাস্যকায়ৈ সমস্তসংহারকতাণ্ডবায় ।
জগজ্জনন্যৈ জগদেকপিত্রে নমঃ শিবায়ৈ চ নমঃ শিবায় ॥ ৭॥

প্রদীপ্তরত্নোজ্জ্বলকুণ্ডলায়ৈ স্ফুরন্মহাপন্নগভূষণায় ।
শিবান্বিতায়ৈ চ শিবান্বিতায় নমঃ শিবায়ৈ চ নমঃ শিবায় ॥ ৮॥

এতৎপঠেদষ্টকমিষ্টদং যো ভক্ত্যা স মান্যো ভুবি দীর্ঘজীবী ।
প্রাপ্নোতি সৌভাগ্যমনন্তকালং ভূয়াৎসদা তস্য সমস্তসিদ্ধিঃ ॥ ৯॥

॥ ইতি শ্রীমচ্ছঙ্করাচার্যবিরচিতম্ অর্ধনারীশ্বরস্তোত্রম্ সম্পূর্ণম্ ॥`,

  rds:`রুদ্রাষ্টকম্
(গোস্বামী তুলসীদাসকৃত — শ্রীরামচরিতমানস, উত্তরকাণ্ড)

নমামীশমীশান নির্বাণরূপং
বিভুং ব্যাপকং ব্রহ্মবেদস্বরূপম্ ।
নিজং নির্গুণং নির্বিকল্পং নিরীহং
চিদাকাশমাকাশবাসং ভজেঽহম্ ॥ ১ ॥

নিরাকারমোঙ্কারমূলং তুরীয়ং
গিরাজ্ঞানগোতীতমীশং গিরীশম্ ।
করালং মহাকালকালং কৃপালুং
গুণাগারসংসারপারং নতোঽহম্ ॥ ২ ॥

তুষারাদ্রিসংকাশগৌরং গভীরং
মনোভূতকোটিপ্রভাশ্রীশরীরম্ ।
স্ফুরন্মৌলিকল্লোলিনী চারুগঙ্গা
লসদ্ভালবালেন্দু কণ্ঠে ভুজঙ্গম্ ॥ ৩ ॥

চলৎকুণ্ডলং শুভ্রনেত্রং বিশালং
প্রসন্নাননং নীলকণ্ঠং দয়ালুম্ ।
মৃগাধীশচর্মাম্বরং মুণ্ডমালং
প্রিয়ং শঙ্করং সর্বনাথং ভজামি ॥ ৪ ॥

প্রচণ্ডং প্রকৃষ্টং প্রগল্ভং পরেশং
অখণ্ডং অজং ভানুকোটিপ্রকাশম্ ।
ত্রয়ীশূলনির্মূলনং শূলপাণিং
ভজেঽহং ভবানীপতিং ভাবগম্যম্ ॥ ৫ ॥

কলাতীতকল্যাণকল্পান্তকারী
সদা সজ্জনানন্দদাতা পুরারী ।
চিদানন্দসন্দোহমোহাপহারী
প্রসীদ প্রসীদ প্রভো মন্মথারী ॥ ৬ ॥

ন যাবদুমানাথপাদারবিন্দং
ভজন্তীহ লোকে পরে বা নরাণাম্ ।
ন তাবৎসুখং শান্তিসন্তাপনাশং
প্রসীদ প্রভো সর্বভূতাধিবাসম্ ॥ ৭ ॥

ন জানামি যোগং জপং নৈব পূজাং
নতোঽহং সদা সর্বদা শম্ভু তুভ্যম্ ।
জরাজন্মদুঃখৌঘতাতপ্যমানং
প্রভো পাহি আপন্নমামীশ শম্ভো ॥ ৮ ॥

রুদ্রাষ্টকমিদং প্রোক্তং বিপ্রেণ হরতুষ্টয়ে ।
যে পঠন্তি নরা ভক্ত্যা তেষাং শম্ভুঃ প্রসীদতি ॥ ৯ ॥

॥ ইতি শ্রীরামচরিতমানসে উত্তরকাণ্ডে গোস্বামীতুলসীদাসকৃতং শ্রীরুদ্রাষ্টকং সম্পূর্ণম্ ॥`,

  sps:`শ্রী শিব পঞ্চাক্ষর স্তোত্রম্
(শ্রীমৎ শঙ্করাচার্যবিরচিত)

নাগেন্দ্রহারায় ত্রিলোচনায়
ভস্মাঙ্গরাগায় মহেশ্বরায় ।
নিত্যায় শুদ্ধায় দিগম্বরায়
তস্মৈ নকারায় নমঃ শিবায় ॥ ১ ॥

মন্দাকিনীসলিলচন্দনচর্চিতায়
নন্দীশ্বরপ্রমথনাথমহেশ্বরায় ।
মন্দারপুষ্পবহুপুষ্পসুপূজিতায়
তস্মৈ মকারায় নমঃ শিবায় ॥ ২ ॥

শিবায় গৌরীবদনাব্জবৃন্দ-
সূর্যায় দক্ষাধ্বরনাশকায় ।
শ্রীনীলকণ্ঠায় বৃষধ্বজায়
তস্মৈ শিকারায় নমঃ শিবায় ॥ ৩ ॥

বসিষ্ঠকুম্ভোদ্ভবগৌতমার্য-
মুনীন্দ্রদেবার্চিতশেখরায় ।
চন্দ্রার্কবৈশ্বানরলোচনায়
তস্মৈ বকারায় নমঃ শিবায় ॥ ৪ ॥

যজ্ঞস্বরূপায় জটাধরায়
পিনাকহস্তায় সনাতনায় ।
দিব্যায় দেবায় দিগম্বরায়
তস্মৈ যকারায় নমঃ শিবায় ॥ ৫ ॥

পঞ্চাক্ষরমিদং পুণ্যং যঃ পঠেচ্ছিবসন্নিধৌ ।
শিবলোকমবাপ্নোতি শিবেন সহ মোদতে ॥ ৬ ॥

॥ ইতি শ্রীমচ্ছঙ্করাচার্যবিরচিতং শ্রীশিবপঞ্চাক্ষরস্তোত্রম্ সম্পূর্ণম্ ॥`
}

// ── showLyrics function ──
function showLyrics(id) {
  // Built-in stotram lyrics first, then custom stotram lyrics
  const ly = LYRICS[id] || ((App.S.customSt||[]).find(x=>x.id===id)||{}).lyrics || '';
  if (!ly) { toast('পাঠ্য পাওয়া যায়নি 🙏'); return; }
  const nm = [...STLIST,...(App.S.customSt||[])].find(x => x.id === id);
  document.getElementById('lmTitle').textContent = nm ? nm.name : id;
  document.getElementById('lyrBody').textContent = ly;
  document.getElementById('lmo').classList.add('show');
  document.getElementById('lmb').scrollTop = 0;
}
function closeLyrics() {
  document.getElementById('lmo').classList.remove('show');
}

// ═══════════════════════════════════════════════════════
// DAILY REMINDERS — Brahma Muhurta, Sandhyakal, Manual
// ═══════════════════════════════════════════════════════
const REM_KEY = 'radhaJapReminders_v2';
const remTimers = { brahma: null, sandhya: null, manual: null };

function showPwaGuide() {
  document.getElementById('pwaMo').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closePwaGuide() {
  document.getElementById('pwaMo').classList.remove('show');
  document.body.style.overflow = '';
}

function getRemCfg() {
  try { return JSON.parse(localStorage.getItem(REM_KEY)) || {}; } catch { return {}; }
}
function saveRemCfg(cfg) { localStorage.setItem(REM_KEY, JSON.stringify(cfg)); }

async function fetchSunTimes(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto&forecast_days=2`;
  const r = await fetch(url);
  const d = await r.json();
  return {
    sunrise: [ new Date(d.daily.sunrise[0]), new Date(d.daily.sunrise[1]) ],
    sunset:  [ new Date(d.daily.sunset[0]),  new Date(d.daily.sunset[1])  ]
  };
}

function brahmaNotifyTime(sunrise) {
  return new Date(sunrise.getTime() - (101 * 60 * 1000));
}
function sandhyaNotifyTime(sunset) {
  return new Date(sunset.getTime() - (5 * 60 * 1000));
}

function fmt12(date) {
  let h = date.getHours(), m = date.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}

async function loadSunTimes(forceRefresh) {
  const cfg = getRemCfg();
  const now = Date.now();
  const cached = cfg.sunCache;
  const locEl = document.getElementById('remLocStatus');

  if (!forceRefresh && cached && (now - cached.ts) < 6*3600*1000) {
    applySunCache(cached);
    return cached;
  }

  if (locEl) locEl.textContent = '📍 Detecting location…';

  return new Promise(resolve => {
    if (!navigator.geolocation) {
      if (locEl) locEl.textContent = '⚠️ GPS not available on this device';
      resolve(null); return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const sun = await fetchSunTimes(lat, lon);
        const cache = {
          ts: now, lat, lon,
          sunrise0: sun.sunrise[0].toISOString(),
          sunrise1: sun.sunrise[1].toISOString(),
          sunset0:  sun.sunset[0].toISOString(),
          sunset1:  sun.sunset[1].toISOString()
        };
        cfg.sunCache = cache;
        saveRemCfg(cfg);
        applySunCache(cache);
        if (locEl) locEl.textContent = '📍 Location detected · Times update daily';
        resolve(cache);
      } catch(e) {
        if (locEl) locEl.textContent = '⚠️ Could not fetch sun times. Check internet.';
        resolve(null);
      }
    }, () => {
      if (locEl) locEl.textContent = '⚠️ Location permission denied';
      resolve(null);
    }, { timeout: 10000 });
  });
}

function applySunCache(cache) {
  if (!cache) return;
  const sr0 = new Date(cache.sunrise0);
  const ss0 = new Date(cache.sunset0);
  const bTime = brahmaNotifyTime(sr0);
  const sTime = sandhyaNotifyTime(ss0);
  const btEl = document.getElementById('remTimeBrahma');
  const stEl = document.getElementById('remTimeSandhya');
  if (btEl) btEl.textContent = `Notify at ${fmt12(bTime)} · Sunrise ${fmt12(sr0)}`;
  if (stEl) stEl.textContent = `Notify at ${fmt12(sTime)} · Sunset ${fmt12(ss0)}`;
}

function scheduleType(type, cfg) {
  if (remTimers[type]) { clearTimeout(remTimers[type]); remTimers[type] = null; }
  if (!cfg[type] || !cfg[type].enabled) return;

  function arm() {
    const now = new Date();
    let fireAt = null;

    if (type === 'manual') {
      const [h, m] = (cfg.manual.time || '06:00').split(':').map(Number);
      fireAt = new Date(); fireAt.setHours(h, m, 0, 0);
      if (fireAt <= now) fireAt.setDate(fireAt.getDate() + 1);
    } else {
      const cache = cfg.sunCache;
      if (!cache) return;
      const sr0 = new Date(cache.sunrise0), sr1 = new Date(cache.sunrise1);
      const ss0 = new Date(cache.sunset0),  ss1 = new Date(cache.sunset1);
      if (type === 'brahma') {
        fireAt = brahmaNotifyTime(sr0);
        if (fireAt <= now) fireAt = brahmaNotifyTime(sr1);
      } else {
        fireAt = sandhyaNotifyTime(ss0);
        if (fireAt <= now) fireAt = sandhyaNotifyTime(ss1);
      }
    }

    if (!fireAt) return;
    const delay = fireAt - Date.now();
    remTimers[type] = setTimeout(() => {
      fireReminder(type);
      setTimeout(() => {
        const c = getRemCfg();
        if (c[type]?.enabled) {
          if (type !== 'manual') loadSunTimes(true).then(() => scheduleType(type, getRemCfg()));
          else scheduleType(type, c);
        }
      }, 5000);
    }, Math.max(delay, 1000));
  }
  arm();
}

function fireReminder(type) {
  if (Notification.permission !== 'granted') return;
  const titles = {
    brahma: 'ब्रह्म मुहूर्त 🌄',
    sandhya: 'संध्याकाल 🌅',
    manual: 'राधे राधे 🙏'
  };
  const bodies = {
    brahma: 'Brahma Muhurta begins — the most auspicious time for Naam Jap. राधे राधे!',
    sandhya: 'Sandhyakal is here — time for your evening Naam Jap. राधे राधे!',
    manual: 'Time for your daily Jap! Begin your naam jap. राधे राधे 🙏'
  };
  // Use Service Worker to show notification (required for mobile/Ulaa)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: titles[type],
      body: bodies[type],
      tag: `radha-jap-${type}`
    });
  } else {
    // Fallback for desktop browsers
    const n = new Notification(titles[type], {
      body: bodies[type],
      tag: `radha-jap-${type}`,
      renotify: true,
      vibrate: [200, 100, 200]
    });
    n.onclick = () => { window.focus(); n.close(); };
  }
}

async function toggleReminderType(type) {
  if (!('Notification' in window)) { showPwaGuide(); return; }
  const cfg = getRemCfg();
  const isOn = cfg[type]?.enabled;

  if (isOn) {
    cfg[type] = { ...(cfg[type] || {}), enabled: false };
    saveRemCfg(cfg);
    updateReminderUI(type, false, cfg);
    if (remTimers[type]) { clearTimeout(remTimers[type]); remTimers[type] = null; }
    const label = type === 'brahma' ? 'Brahma Muhurta' : type === 'sandhya' ? 'Sandhyakal' : 'Custom';
    toast(`${label} reminder off`);
  } else {
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') { showPwaGuide(); return; }
    if (type !== 'manual') {
      const cache = await loadSunTimes(false);
      if (!cache) { toast('Could not get location. Please allow GPS access.'); return; }
    }
    if (!cfg[type]) cfg[type] = {};
    cfg[type].enabled = true;
    if (type === 'manual' && !cfg.manual?.time) cfg.manual.time = '06:00';
    saveRemCfg(cfg);
    updateReminderUI(type, true, cfg);
    scheduleType(type, cfg);
    const label = type === 'brahma' ? '🌄 Brahma Muhurta' : type === 'sandhya' ? '🌅 Sandhyakal' : '🕐 Custom';
    toast(`${label} reminder on!`);
  }
}

function saveManualReminderTime() {
  const time = document.getElementById('reminderTimeIn').value;
  if (!time) { toast('Please select a time'); return; }
  const cfg = getRemCfg();
  if (!cfg.manual) cfg.manual = {};
  cfg.manual.time = time;
  cfg.manual.enabled = true;
  saveRemCfg(cfg);
  updateReminderUI('manual', true, cfg);
  scheduleType('manual', cfg);
  toast('Custom reminder saved 🙏');
}

function updateReminderUI(type, on, cfg) {
  const tgMap = { brahma: 'tgBrahma', sandhya: 'tgSandhya', manual: 'tgManual' };
  const tg = document.getElementById(tgMap[type]);
  if (tg) on ? tg.classList.add('on') : tg.classList.remove('on');

  if (type === 'manual') {
    const row = document.getElementById('reminderTimeRow');
    const timeEl = document.getElementById('remTimeManual');
    if (row) row.style.display = on ? 'flex' : 'none';
    if (timeEl) {
      const t = cfg.manual?.time;
      if (on && t) {
        const [h, m] = t.split(':').map(Number);
        const ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
        timeEl.textContent = `${h12}:${String(m).padStart(2,'0')} ${ap} daily`;
      } else {
        timeEl.textContent = 'Not set';
      }
    }
  }
}

async function initReminderUI() {
  const cfg = getRemCfg();
  ['brahma','sandhya','manual'].forEach(type => updateReminderUI(type, !!(cfg[type]?.enabled), cfg));
  if (cfg.manual?.time) document.getElementById('reminderTimeIn').value = cfg.manual.time;
  if (cfg.sunCache) applySunCache(cfg.sunCache);
  if (cfg.brahma?.enabled || cfg.sandhya?.enabled) {
    await loadSunTimes(false);
  } else {
    const locEl = document.getElementById('remLocStatus');
    if (locEl) locEl.textContent = 'Enable Brahma Muhurta or Sandhyakal to auto-detect times';
  }
}

(function restoreAllReminders() {
  if (Notification.permission !== 'granted') return;
  const cfg = getRemCfg();
  ['brahma','sandhya','manual'].forEach(type => {
    if (cfg[type]?.enabled) scheduleType(type, cfg);
  });
})();

// ══════════════════════════════════════════
// ── MILESTONE SYSTEM ──
// ══════════════════════════════════════════

// ── 13 CRORE SPIRITUAL MILESTONES (Shri Hit Premanand Ji Maharaj) ──
const CRORE = 10000000; // 1 crore = 10 million
const SPIRITUAL_MILESTONES = [
  { count: 1*CRORE, icon: '⭐', label: 'Sharir ki Shuddhi', tag: 'Tanu Sthan', eng: 'Body Purification', phase: 'shuddhikaran',
    desc: 'Sharir nishpaap hone lagta hai. Rajogun aur Tamogun khatam hokar Shuddha Sattva aata hai. Rogon ke beej nasht hote hain aur sapne mein Devi-Devtaon ke darshan hone lagte hain.' },
  { count: 2*CRORE, icon: '◇', label: 'Dhan Sthan ki Shuddhi', tag: 'Dhan Sthan', eng: 'Wealth Purification', phase: 'shuddhikaran',
    desc: 'Garibi aur daridrata ka dukh hamesha ke liye khatam ho jata hai. Bhagwan ya toh itna dhan de dete hain ki chah khatam ho jaye, ya fir man se paise ki bhookh hi mita dete hain.' },
  { count: 3*CRORE, icon: '✦', label: 'Antahkaran ki Shuddhi', tag: 'Parakram Sthan', eng: 'Inner Strength', phase: 'shuddhikaran',
    desc: 'Jo kaam pehle Asadhya lagte the (jaise gussa ya moh chhodna), wo Sadhya ho jate hain. Pura sansar aapko prem ki nazar se dekhne lagta hai.' },
  { count: 4*CRORE, icon: '❊', label: 'Hriday ki Shuddhi', tag: 'Sukh Sthan', eng: 'Heart Purification', phase: 'shuddhikaran',
    desc: 'Nityatva Bodh hota hai — aapko feel hone lagta hai ki aap ye marne wala sharir nahi, balki ek nitya Atma ho. Man aur buddhi par kisi bhi worldly dukh ka asar nahi padta.' },
  { count: 5*CRORE, icon: '☀', label: 'Vidya Sthan Jagrit', tag: 'Vidya Sthan', eng: 'Knowledge Awakening', phase: 'shakti',
    desc: 'Shastron ka gyan apne aap andar se nikalne lagta hai. Agar koi worldly wish ho (jaise santan ya lambi umar), toh wo bina maange puri hone lagti hai.' },
  { count: 6*CRORE, icon: '⚔', label: 'Shatruo par Vijay', tag: 'Ripu Sthan', eng: 'Victory Over Enemies', phase: 'shakti',
    desc: 'Bahar ke dushman hi nahi, balki andar ke 6 dushman (Kaam, Krodh, Lobh, Moh, Mad, Matsar) haar jate hain. Koi bhi incurable disease sankalp matra se thik ho sakta hai.' },
  { count: 7*CRORE, icon: '◉', label: 'Ichchhaon par Niyantran', tag: 'Jaya Sthan', eng: 'Desire Mastery', phase: 'shakti',
    desc: 'Duniya ki koi bhi attraction aise sadhak ko bhatka nahi sakti. Is stage par Narad Ji jaise maha-purushon se Pratyaksh milan aur baatchit shuru ho jati hai.' },
  { count: 8*CRORE, icon: '∞', label: 'Mrityu Bhay ka Ant', tag: 'Mrityu Sthan', eng: 'Death Fear Removed', phase: 'shakti',
    desc: 'Maut ka darr hamesha ke liye chala jata hai. Sadhak Atma-Raj ke sinhasan par baith jata hai, yani wo apne swaroop mein sthit ho jata hai.' },
  { count: 9*CRORE, icon: '◎', label: 'Saakshaatkaar', tag: 'Dharam Sthan', eng: 'Direct Divine Vision', phase: 'bhagwat',
    desc: 'Aap jiska naam jap rahe hain (Ram, Krishna, Shiva, ya Radha), unka Saakshaatkaar (Direct Vision) hota hai. Sadhak ki vani Satya ho jati hai — jo bologe wo ho jayega.' },
  { count: 10*CRORE, icon: '✿', label: 'Karm Bandhan Mukti', tag: 'Karm Sthan', eng: 'Karma Liberation', phase: 'bhagwat',
    desc: 'Saare purane karmo ka stock (Sanchit) aur current karmo ka phal bhasm ho jata hai. Ab janm-maran ka chakra hamesha ke liye khatam.' },
  { count: 11*CRORE, icon: '◈', label: 'Saari Siddhiyan Prapt', tag: 'Siddhi Sthan', eng: 'All Siddhis Attained', phase: 'bhagwat',
    desc: 'Saari Siddhiyan aur Riddhiyan haath jodkar khadi rehti hain. Sadhak Bhagwan ki nitya leelaon (Vrindavan, Saket etc.) mein pravesh kar jata hai.' },
  { count: 12*CRORE, icon: '☸', label: 'Bhagwan Bhakt ke Adheen', tag: 'Bhakti Sthan', eng: 'God Follows Devotee', phase: 'bhagwat',
    desc: 'Sadhak itna powerful ho jata hai ki Bhagwan uske piche-piche dolte hain (Bhagwan bhakt ke adheen ho jate hain).' },
  { count: 13*CRORE, icon: 'ੴ', label: 'Moksh Pradaan ki Shakti', tag: 'Moksh Sthan', eng: 'Power to Grant Liberation', phase: 'bhagwat',
    desc: 'Ye limit hai. Jo 13 crore naam jap leta hai, wo itna samarth ho jata hai ki wo kisi bhi Paapi insan ko bhi Moksha (liberation) dila sakta hai.' },
];

const PHASES = [
  { id: 'shuddhikaran', name: 'Shuddhikaran', sub: 'PURIFICATION · 1-4 CRORE', range: [1,4] },
  { id: 'shakti', name: 'Shakti & Vijay', sub: 'POWER & MASTERY · 5-8 CRORE', range: [5,8] },
  { id: 'bhagwat', name: 'Bhagwat Prapti', sub: 'ULTIMATE UNION · 9-13 CRORE', range: [9,13] },
];

// Regular 1K milestones (kept for regular celebrations)
const MILESTONES = [];
for (let k = 1; k <= 99; k++) {
  MILESTONES.push({ count: k * 1000, icon: '✨', label: (k) + 'K Jap', badge: '🎖️', type: 'regular' });
}
// Add bigger regular milestones
// Add all lakh milestones for tracking
for (let ll = 1; ll <= 130; ll++) {
  const lc = ll * 100000;
  if (![100000, 200000, 300000, 500000, 1000000, 2000000, 5000000].includes(lc)) {
    MILESTONES.push({ count: lc, icon: '📿', label: ll + ' Lakh Jap', badge: '📿', type: 'regular' });
  }
}
[100000, 200000, 300000, 500000, 1000000, 2000000, 5000000].forEach(c => {
  MILESTONES.push({ count: c, icon: '👑', label: formatMsCountLabel(c), badge: '👑', type: 'regular' });
});
// Add spiritual milestones to MILESTONES for celebration triggers
SPIRITUAL_MILESTONES.forEach(sm => {
  MILESTONES.push({ count: sm.count, icon: sm.icon, label: sm.label, badge: sm.icon, type: 'spiritual', tag: sm.tag, eng: sm.eng, desc: sm.desc });
});
MILESTONES.sort((a, b) => a.count - b.count);

function formatMsCountLabel(n) {
  if (n >= CRORE) return (n/CRORE) + ' Crore';
  if (n >= 100000) return (n/100000) + ' Lakh';
  if (n >= 1000) return (n/1000) + 'K';
  return n.toLocaleString('en-IN');
}

function getMilestoneData() {
  try {
    const d = localStorage.getItem('rjap_milestones');
    return d ? JSON.parse(d) : { reached: {}, lastChecked: 0 };
  } catch(e) { return { reached: {}, lastChecked: 0 }; }
}

function saveMilestoneData(data) {
  try { localStorage.setItem('rjap_milestones', JSON.stringify(data)); } catch(e) {}
}

function formatMsCount(n) {
  if (n >= CRORE) return (n/CRORE) + ' Crore';
  if (n >= 100000) return (n/100000).toFixed(n%100000 ? 1 : 0).replace(/\.0$/, '') + ' Lakh';
  return n.toLocaleString('en-IN');
}

function playShankha() { /* removed */ }

function spawnMsParticles() { /* removed */ }

function showMilestoneCelebration() { /* removed */ }

function dismissMilestone() { /* removed */ }




// ── LAKH MILESTONES for Jap ki Gati ──
const LAKH_MILESTONES = [];
for (let l = 1; l <= 130; l++) {
  LAKH_MILESTONES.push({ count: l * 100000, label: l + ' Lakh', num: l });
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  if (days > 365) {
    const yrs = Math.floor(days / 365);
    const remDays = days % 365;
    return yrs + 'y ' + remDays + 'd';
  }
  if (days > 0) return days + 'd ' + hrs + 'h';
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hrs > 0) return hrs + 'h ' + mins + 'm';
  return mins + 'm';
}

function renderLakhGati() { renderMilestonesTab(); }

function saveSadhanaStartDate(val) {
  if (val) {
    localStorage.setItem('rjap_sadhana_start', val);
    updateSadhanaSince();
    renderLakhGati();
  }
}

function loadSadhanaStartDate() {
  const saved = localStorage.getItem('rjap_sadhana_start');
  const input = document.getElementById('sadhanaStartDate');
  if (saved && input) {
    input.value = saved;
  }
  updateSadhanaSince();
}

function updateSadhanaSince() {
  const el = document.getElementById('sadhanaSince');
  const saved = localStorage.getItem('rjap_sadhana_start');
  if (!el) return;
  if (!saved) {
    el.textContent = 'Set your journey start date above ☝️';
    return;
  }
  const start = new Date(saved);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  const days = Math.floor(diff / 86400000);
  const years = Math.floor(days / 365);
  const remDays = days % 365;
  const months = Math.floor(remDays / 30);
  let str = '🙏 ';
  if (years > 0) str += years + ' year' + (years>1?'s':'') + ' ';
  if (months > 0) str += months + ' month' + (months>1?'s':'') + ' ';
  str += (remDays % 30) + ' days of Sadhana';
  el.textContent = str;
}


function renderMsView() { renderMilestonesTab(); }



