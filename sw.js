// ═══════════════════════════════════════════════════════
// Radha Naam Jap — Service Worker  v214
// v214: bumped cache to force-invalidate stale app.js — v213's bead-ring
// fix (pageshow/visibilitychange) turned out to not be the whole story:
// on iPad the ring's bottom edge can still drift after Safari's
// collapsible toolbar auto-hides a moment after load, growing the
// 100dvh viewport AFTER the ring already measured/drew at the smaller,
// toolbar-still-visible height — a resize that iOS doesn't reliably
// surface as a plain window "resize" event. Added a window.visualViewport
// resize listener plus a blunt ~3.6s post-load re-measure timer (both
// web/iPad only) so the ring converges on the right geometry regardless
// of which exact event does or doesn't fire on a given iPad. Android
// untouched. Web/PWA clients still running old app.js now pick up this
// build on next load.
// v213: bumped cache to force-invalidate stale app.js — the bead-ring
// cold-start revival (added for iPad's "lower border missing" bug) only
// ever ran on the "load" event, which does NOT fire when iOS Safari
// restores the page from its back-forward cache (bfcache) — the actual
// common case of switching away from the app and back, not a true
// relaunch. Added pageshow (event.persisted) and visibilitychange
// listeners so the ring self-corrects on those paths too, not just a
// genuine cold load. Web/PWA clients still running the old app.js now
// pick up this build on next load.
// v208: local JS/CSS/HTML assets (app.js, style.css, panchanga module,
// etc.) now use the SAME network-first strategy the navigate handler has
// used since v154, instead of cache-first/stale-while-revalidate. Root
// cause of "new version doesn't show up until the SECOND app open":
// even once an updated SW has installed and activated in the background,
// the old cache-first strategy for these files would still serve
// whatever was already cached instantly and only refresh it in the
// background for the load AFTER that — so a real code change always
// needed two cold opens to actually appear on screen, not one. Now, with
// a working connection, every local asset is fetched fresh (2.5s
// timeout) on each load and the cache is only a fallback for a slow/
// offline connection — so PWA users see the latest deployed version the
// very next time they open the app, not the time after. Bumped cache to
// force this change to take effect (existing behavior for external CDN
// assets and Firestore/FCM messaging is unchanged).
// v207: bumped cache to force-invalidate stale panchanga.html/js/css —
// tapping a saved profile in the "Others" folder popup no longer closes
// that popup and jumps to the main page's card. Its full breakdown
// (Vaar strip, Rashi card, Dasha/Sade Sati bar, full anga list) now
// renders as a page INSIDE the same #vp-others-overlay folder, with a
// "← Back to Profiles" button that returns to the saved-profiles list
// without leaving the folder. The folder popup itself is now full-screen
// (like the calculator) instead of a small 360px popup, since it needs
// the same room to show that detail. Web/PWA clients still running the
// old cached panchanga.js/html/css now pick up the current build on
// next load.
// v206: bumped cache to force-invalidate stale panchanga.html/js/css —
// fixes the REAL cause of "Save as Their Profile" doing nothing: the
// button's onclick="vpOthersSave(_vpHoroEditingOtherId)" referenced a
// variable that only exists inside panchanga.js's own IIFE closure —
// inline onclick attributes resolve against the global scope, so that
// lookup threw a ReferenceError before vpOthersSave() ever ran, every
// time, for every user. The button now calls vpOthersSave() with no
// argument, and the function reads its own closure variable internally
// instead. This also means the "Others" folder popup — already built
// in v201/v203 — can finally hold anything, since nothing could ever
// actually get saved into it before now. Web/PWA clients still running
// the old cached panchanga.js/html now pick up the current build on
// next load.
// v205: bumped cache to force-invalidate stale panchanga.html/js/css —
// "Calculate Rashi" inside the Add/Edit Profile popup (Your Rashi or
// Others) now shows the FULL breakdown right there — Vaar strip, Birth
// Moon Rashi card (with lord/deity), Mahadasha & Sade Sati bar, and the
// complete Tithi/Nakshatra/Yoga/Karana anga list — instead of just the
// Rashi name. Fixes report that calculating an Other profile's rashi
// showed only the Moon sign with no other detail. Web/PWA clients still
// running the old cached panchanga.js — where the inline result was
// Rashi-name-only — now pick up the current build on next load.
// v204: bumped cache to force-invalidate stale panchanga.html/js/css —
// "Calculate Rashi" inside the Add/Edit Profile popup (Your Rashi or
// Others) no longer closes that popup and jumps to the main page's
// result section. It now shows a compact inline result right there,
// directly above the existing Save button, so calculating and saving
// happen in one place instead of the flow appearing to "leave" the
// popup. The old full-page result view is kept only for a bare
// calculator with no save option, which no current button reaches.
// v203: bumped cache to force-invalidate stale panchanga.html/js/css —
// the header "Others" button now opens a dedicated list popup
// (#vp-others-overlay) showing saved other-person profiles directly,
// instead of scrolling down to a section buried below the whole
// "Your Rashi" breakdown. Adding a profile opens the existing
// calculator on top of this popup as before; tapping a saved profile
// closes the popup and shows that profile's full breakdown further
// down the page, unchanged. Web/PWA clients still running the old
// cached panchanga.js — where "Others" scrolled into the buried
// section instead — now pick up the current build on next load.
// v202: bumped cache to force-invalidate stale app.js — ships the real
// delta-sync rework: fbPushDelta() now actually sends only changed
// fields (arrayUnion for grow-only logs like malaLog/activityLog)
// instead of silently aliasing to a full-state push; skips the write
// entirely when nothing changed since the last confirmed sync; adds a
// "Tap to retry" button that appears if the sync pill sits on
// "Syncing…" for 60s straight; adds a rolling sync debug log
// (localStorage: rjap_sync_debug_log) for diagnosing future stuck-sync
// reports. fbPushFull() (restore/initial-push/full-overwrite paths) is
// unchanged. Web/PWA clients still running the old always-full-push
// app.js — the original cause of the "stuck syncing forever" report —
// now pick up the current build on next load.
// v201: bumped cache to force-invalidate stale vedic-panchanga module
// files (panchanga.html/css/js) — ships the "Others" Janmo Tithi & Rashi
// fixes: the header Others button now goes to a saved-profiles list
// instead of opening the calculator directly, each mode (Your Rashi vs
// Others) only shows its own Save CTA, and the button is now
// error-hardened end-to-end (vpOthersButtonClick → vpOthersGoToList →
// vpHoroOpenOther, each catching failures from the one before) so it can
// never silently do nothing even if a Firestore/auth check throws. Web/
// PWA clients that were still running a cached pre-fix panchanga.js —
// which is exactly why the button could appear "unresponsive" even after
// the source files were updated — now pick up the current build on next
// load.
// v197: bumped cache to force-invalidate stale app.js/index.html — ships
// the leaderboard/Ghost Mode fixes (unconditional presence + leaderboard
// doc creation on login, hardened login chain, users/*/data collection-
// group scan in Ghost Mode search, one-click leaderboard backfill). Web/
// PWA clients that were still running a cached pre-fix app.js — and could
// therefore still be hitting old opt-out-deletes-the-doc behavior — now
// pick up the current build on next load.
// v196: bumped cache to force-invalidate stale app.js/index.html — Update
// App now shows an "Open permission settings →" link that jumps straight
// to Android's install-permission screen for this app (via a new method
// on the existing custom PowerPermissions native plugin), instead of just
// describing where to find it in text. Shown after any install attempt
// (success or failure) since MIUI/Xiaomi can silently swallow this
// specific failure — tapping it is a harmless no-op if the install
// actually did work. Requires the native side patch
// (patch_power_permissions.py) applied to android-src/PowerPermissionsPlugin.java.
// v195: bumped cache to force-invalidate stale app.js — extends the v194
// mala start-time fix to survive fully closing and reopening the app, not
// just switching modes within one session. Each jap type's in-progress
// mala timing now persists to its own localStorage key
// (rjap_malaStash_<mode>), checked both when switching modes and on app
// boot (using whichever mode was active when the app was last closed) —
// closes the one edge case v194's changelog flagged as still open.
// v194: bumped cache to force-invalidate stale app.js — fixes History
// showing a falsely-short duration for a mala interrupted by switching
// jap types mid-way (e.g. 93/108 Radha taps, switch to RV, complete an
// RV mala, switch back and finish Radha's last 15). Root cause:
// malaWallStart/_currentMalaStartTs were shared globals instead of
// per-mode, so the other mode's own first-tap reset (or its mala-
// completion reset) wiped the original mode's in-progress start
// timestamp. switchJapMode() now stashes the outgoing mode's timing
// state and restores the incoming mode's, so each jap type keeps its
// own undisturbed mala clock across switches. NOTE: this fix is
// session-only — switching modes, then fully closing and reopening the
// app before switching back, can still lose the stash (only the most-
// recently-active mode's timing persists to localStorage across a
// restart). Worth revisiting if that edge case comes up in practice.
// v193: bumped cache to force-invalidate stale app.js — Update App now
// gives clear guidance (Settings → Apps → Radha Naam Jap → "Install
// unknown apps" / MIUI's "Other permissions") when the download succeeds
// but the installer can't be launched — this is almost always a missing
// Android permission, not a bug, and some manufacturers (MIUI/Xiaomi)
// silently block the launch instead of showing any error at all. Also:
// tapping Update again after fixing the permission now reuses the
// already-downloaded APK (tagged by target version) instead of
// re-downloading the full ~137MB every time.
// v192: bumped cache to force-invalidate stale app.js — fixes the Update
// App check showing "No release published yet on GitHub" when it's
// actually a GitHub API rate-limit hit (60 unauthenticated requests/hour,
// shared per network — easy to exhaust during heavy testing). Now caches
// the last known result for 30 min so it doesn't re-hit the API on every
// app open, and falls back to that cached result on a rate-limit/network
// failure instead of showing a misleading "no release" message.
// v191: bumped cache to force-invalidate stale app.js — adds a foreground
// catch-up check for the daily Drive backup, run once on every app open.
// If the chosen backup time already passed today and it hasn't run yet
// (checked via the same bgsync_last_drive_backup_date marker runner.js
// uses), it fires immediately using the live app's own connection —
// covers the case where background/runner.js's periodic wake (Android
// platform minimum ~15min, no exact-alarm option) missed the window
// entirely because the phone was closed/offline at the time.
// v190: bumped cache to force-invalidate stale app.js — fixes Update App
// download failing with a bare "Error downloading file: <url>" message.
// Root cause: a known Capacitor Filesystem bug (ionic-team/capacitor
// #6896, #7108, #1835) where downloadFile() throws ENOENT if its target
// directory (here, the app's own Cache dir) hasn't been created yet by
// Android — common on a fresh install/update before anything else has
// written to Cache. Added recursive:true so it creates the folder
// instead of failing. Also logs the full underlying error object to
// console for easier diagnosis if a future failure has a different cause.
// v189: bumped cache to force-invalidate stale app.js/index.html —
// Update App card now always shows "Installed version: vX.X.X" as a
// persistent line, independent of whether the GitHub update check
// succeeds — works offline or with zero releases published. Also adds a
// friendly "No release published yet on GitHub" message instead of
// silently doing nothing when GitHub returns 404 (e.g. after deleting
// all releases). NOTE: the GitHub *tag* must stay numeric (v1.0.6 etc)
// for the version comparison to keep working — the release *title* can
// be anything (e.g. "MashuTheKingCat 1").
// v188: bumped cache to force-invalidate stale app.js/index.html —
// Settings > Google Drive Backup now has a time picker (device-local)
// under the Daily Auto-Backup toggle. Chosen hour/minute is staged into
// CapacitorKV so background/runner.js (patched separately via
// patch_runner.py — not part of this www bundle) can check "am I within
// ~35 min of the chosen time, and haven't already backed up today?"
// before uploading, instead of just firing on whatever cycle WorkManager
// happens to wake it.
// v187: bumped cache to force-invalidate stale app.js — drops
// @capacitor/file-transfer entirely (its native Android module needs a
// newer Gradle/AGP toolchain than this project has and reliably fails
// to build, even after a full Gradle cache wipe — "Failed to create Jar
// file ... bcprov-jdk18on-1.79.jar"). The Update App download now uses
// @capacitor/filesystem's own downloadFile() instead — already bundled
// in this project, not deprecated until Filesystem v7.1.0 (this project
// is on Capacitor 6), and just as native/CORS-free/disk-direct.
// v186: bumped cache to force-invalidate stale app.js/style.css/index.html —
// the Update App card now turns blue and pulses with a soft glow whenever
// a newer version is actually available (via .update-available class),
// instead of just a thin gold border. Stays in its normal quiet state
// when already up to date or before the check has run.
// v185: bumped cache to force-invalidate stale app.js — fixes "Update
// failed: Failed to fetch" when tapping Update App. Root cause: the app's
// WebView origin isn't CORS-allowed by GitHub's release/API hosts, so
// plain fetch() was blocked before the request left the device. Now uses
// CapacitorHttp.request() for the small version-check JSON call, and the
// dedicated @capacitor/file-transfer plugin for the actual ~137MB APK
// download — both run at the native layer (no CORS), and file-transfer
// writes straight to disk instead of pulling the whole APK through the
// JS bridge as base64 (which risked an OOM crash at that file size).
// Requires: npm install @capacitor-community/file-opener@6 @capacitor/file-transfer
// v184: bumped cache to force-invalidate stale app.js —
// adds automatic "Update available — vX.X.X" detection on app launch:
// compares the installed app's version (Capacitor App.getInfo()) against
// the latest GitHub Release's tag via the GitHub API, and updates the
// Settings card's status line accordingly. Tapping the button still just
// downloads+installs the latest release either way — this only adds the
// "is there something new" indicator, and fails silently (no crash, no
// user-facing error) if offline or run outside the installed app.
// v183: bumped cache to force-invalidate stale app.js/index.html —
// adds an in-app "Update App" card at the top of Settings that downloads
// the latest APK from a GitHub Release via Capacitor Filesystem and hands
// it to the system installer (@capacitor-community/file-opener — see
// setup notes above checkAppUpdate() in app.js). Also fixes autoLoadHistory
// permanently disabling itself after one failed timing race, which could
// leave the History section's From/To fields stuck blank for the rest of
// the session ("Please select both From and To dates" even though a
// preset button looked selected).
// v182: bumped cache to force-invalidate stale style.css — fixes the
// Hit Chaurasi Ji player's prev/next arrows being pushed off-screen
// (and clipped by body{overflow-x:hidden}) on narrow Android phones,
// while showing fine on wider screens like iPad. .hcj-player row is
// now compacted under 480px width, plus a hidden-scrollbar fallback.
// v181: bumped cache to force-invalidate stale app.js/index.html/style.css —
// picks up: dedicated KV-only History section (table column, Period Totals
// card, drill-down) mirroring the existing HK-only history view.
// v180: bumped cache to force-invalidate stale app.js/index.html/style.css —
// picks up: KV mode's persistent tap display (#kvPersist), matching HK's
// stays-until-next-tap behavior instead of only a fading floating text.
// v179: bumped cache to force-invalidate stale app.js/index.html/style.css —
// picks up: 15s idle-pause grace for HK/KV modes, and the white-page
// email-style notification inbox redesign.
// v178: bumped cache to force-invalidate stale app.js/index.html/style.css —
// picks up: notification history inbox + unread badges, the hcj-next-btn/
// hcj-prev-btn visibility fix, and the notification bell in Settings.
// v177: bumped cache to force-invalidate stale app.js/index.html — adds
//  the PERMANENT Gift Ledger: every gift is now also written to its own
//  IndexedDB record + its own Firestore document immediately (no debounce),
//  isolated from the state blob that gets reset on UID change/cold start,
//  so a gift entry can no longer be silently dropped by the sync race.
// v176: bumped cache to force-invalidate stale app.js — picks up:
//  (1) Milestones total-jap fix — nets each jap type (Radha/RV/HK/KV)
//      against its own gift/deduct counter instead of pooling all
//      histories then subtracting only one counter.
//  (2) New Milestones "Consideration" chips (msConsider) — choose which
//      jap types count toward Bhagvat Prapti milestones, any combination.
//  (3) 28 Names milestone rule — contributes 0 while ANY wish (sankalp)
//      is active, since wishes chain continuously; only counts when no
//      wish is active.
//  (4) Community leaderboard breakdown fix — per-type totals now netted
//      against gifts (matching totalJap), plus a "🎁 X gifted" note per
//      type so a small netted count next to a long raw chanting time
//      reads as "gifted most of it" instead of a mismatch.
// v175: bumped cache to force-invalidate stale app.js/index.html — adds
// full Add/Deduct Jap Manually (Today / Other Day / Before This App /
// Name Jap — Lifetime) to the 28 Names Statistics screen, matching the
// main jap section's manual-entry feature.
// v174: bumped cache to force-invalidate stale app.js/index.html/style.css —
// adds the new "Krishnay Vasudevay Haraye Paramatmane" (KV) jap type
// alongside Radha / Radha Vallabh / Hare Krishna, with its own history,
// targets, stats, leaderboard and Firebase sync.
// v173: bumped cache to force-invalidate stale app.js — picks up the
// Firebase sync-hang fix, Brahma Muhurta reminder timing fix, and the
// native Share sheet fix (APK was silently falling back to copy-link
// because navigator.share doesn't exist in Capacitor's WebView).
// v172: bumped cache to force-invalidate stale app.js/index.html/style.css
// after adding Gaudiya/ISKCON top-deity + Acharya/Gurudev jap-display photos
// and fixing the app-boot sequence to call applyBgPhotos() on load.
// v171: re-added FCM background push handling (web/PWA) via
// firebase-messaging-compat, using the same firebaseConfig as app.js.
// Native (APK) push does NOT go through this file — that's handled by
// @capacitor-firebase/messaging directly.
// v169: manifest.json updated — added display_override, real screenshots
// (replaces placeholder icon-512.png screenshot entries)
//
// v156 fixes (vs v154):
//  • Promoted ./vedic-panchanga/panchanga.html, .css, .js to CORE_ASSETS so
//    install BLOCKS on them. Fixes "Vedic Panchanga module failed to load"
//    on first open / after update where the HTML fragment fetch failed
//    before the lazy cache step had completed.
//  • Bumped cache name to invalidate any stale v154 entry that may have
//    cached a failed/empty panchanga.html response.
// ═══════════════════════════════════════════════════════
const CACHE = 'radha-jap-v214';

// ── FCM background push (web/PWA only — no effect inside the Capacitor
// APK, which never registers this SW for messaging). Wrapped in try/catch
// because importScripts throws on browsers with no network at SW-install
// time; background push just won't be available there, nothing else breaks. ──
try {
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: "AIzaSyCvvXEdsJjXpTbITE2HuyYFnPZfZIkxVWA",
    authDomain: "guru-kripahi-kevalam-108.firebaseapp.com",
    projectId: "guru-kripahi-kevalam-108",
    storageBucket: "guru-kripahi-kevalam-108.firebasestorage.app",
    messagingSenderId: "368485403238",
    appId: "1:368485403238:web:a3ab5c1427ad0c40fffba7",
  });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    self.registration.showNotification(n.title || "Radha Naam Jap", {
      body: n.body || "",
      icon: './icon-192.png',
      badge: './icon-192.png',
    });
  });
} catch (e) {
  console.warn('FCM background messaging not available in this SW context:', e);
}

// Core assets — install BLOCKS on these. Anything the first paint needs
// must live here, otherwise users see a network round-trip on first open.
const CORE_ASSETS = [
  './',
  './index.html',
  './404.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Promoted in v154 — these are visible on first paint:
  './guru.jpg',
  './radha-coin.png',
  './bhagavadik-bank.png',
  './gurudev/1.png',
  './radha_vallabh/1.png',
  './hitju_maharaj/1.png',
  // Promoted in v155 — Vedic Panchanga module (was failing to load on first
  // open because the fragment fetch raced ahead of the lazy cache step).
  './vedic-panchanga/panchanga.html',
  './vedic-panchanga/panchanga.css',
  './vedic-panchanga/panchanga.js',
];

// Large / optional local assets — cached in background, not blocking install
const LAZY_LOCAL_ASSETS = [
  './style-stotram.css',
  './stotrams.js',
  './panchangData.js',
  './gurudev/2.png',
  './Panchojanno%20Shankya.mp3',
];

const EXTERNAL_ASSETS = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Hind+Siliguri:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:wght@400;600&family=Inter:wght@300;400;500;600&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
];

const BYPASS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
];

const BYPASS_PREFIXES = [
  'https://api.prokerala.com',
  'https://astronomy-engine',
];

function withinScopePath(pathname) {
  const scopePath = new URL(self.registration.scope).pathname;
  return pathname.startsWith(scopePath) ? pathname.slice(scopePath.length) : null;
}

function toLocalCacheKey(requestOrUrl) {
  const raw = typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url;
  const url = new URL(raw, self.location.origin);
  if (url.origin !== self.location.origin) return null;
  let relativePath = withinScopePath(url.pathname);
  if (relativePath == null) return null;
  if (!relativePath || relativePath === '/') return './index.html';
  if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
  return `./${relativePath}`;
}

function fetchWithTimeout(request, options, ms) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ms);
  return fetch(request, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(tid));
}

async function cacheLocalAsset(cache, asset) {
  try {
    const response = await fetchWithTimeout(asset, { cache: 'reload' }, 8000);
    if (response && response.ok) await cache.put(asset, response.clone());
  } catch (_) {}
}

async function cacheExternalAsset(cache, url) {
  try {
    const response = await fetchWithTimeout(url, { cache: 'reload', mode: 'no-cors' }, 8000);
    if (response && (response.ok || response.type === 'opaque')) await cache.put(url, response.clone());
  } catch (_) {}
}

async function storeResponse(cacheKey, response) {
  if (!response || (!response.ok && response.type !== 'opaque')) return;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(cacheKey, response.clone());
  } catch (_) {}
}

// ── INSTALL: block on CORE (incl. above-the-fold images); lazy + external in background ──
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE_ASSETS.map((asset) => cacheLocalAsset(cache, asset)));
    Promise.allSettled(LAZY_LOCAL_ASSETS.map((asset) => cacheLocalAsset(cache, asset)));
    Promise.allSettled(EXTERNAL_ASSETS.map((asset) => cacheExternalAsset(cache, asset)));
  })());
});

// ── ACTIVATE: delete old caches, then claim open clients and self-heal an
// empty/partial cache (see below). ──
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldKeys = keys.filter((key) => key !== CACHE);
    await Promise.all(oldKeys.map((key) => caches.delete(key)));

    // v212 offline fix: claim currently-open clients immediately instead of
    // waiting for the next navigation. The old comment here said this was
    // removed to avoid a mid-session "takeover flicker" — but that flicker
    // was actually caused by app.js's old location.reload() on
    // controllerchange (removed back in v154), not by claim() itself.
    // Claiming now means: if this is the very FIRST activation (fresh
    // install, no prior SW), the current session is covered by an active
    // SW right away instead of only from the next cold app-open onward —
    // closing the exact gap where "open once online, immediately go
    // offline and relaunch" could still hit the browser's native offline
    // page instead of this SW's own cached shell.
    await self.clients.claim();

    // Self-heal: if CORE_ASSETS somehow failed to cache during install
    // (e.g. install ran on a flaky connection — cacheLocalAsset() swallows
    // its own errors so install() always "succeeds" even with an empty
    // cache), retry them now. Cheap no-op if everything's already cached.
    try {
      const cache = await caches.open(CACHE);
      const missing = [];
      for (const asset of CORE_ASSETS) {
        if (!(await cache.match(asset))) missing.push(asset);
      }
      if (missing.length) {
        console.warn('[SW] self-heal: re-caching', missing.length, 'missing core asset(s)');
        await Promise.allSettled(missing.map((asset) => cacheLocalAsset(cache, asset)));
      }
    } catch (_) {}

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', version: CACHE }));
  })());
});

// ── FETCH ──
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (BYPASS.some((host) => url.href.includes(host))) return;
  if (BYPASS_PREFIXES.some((prefix) => url.href.startsWith(prefix))) return;

  // ── Navigation requests (page load) ──
  // v154: NETWORK-FIRST with 2s timeout. Fixes "old HTML + new app.js" mismatch.
  // - If network responds within 2s, use it and update cache.
  // - If network is slow/offline, serve cached index.html.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(event.request, { cache: 'no-cache' }, 2000);
        if (response && response.ok) {
          storeResponse('./index.html', response.clone()).catch(() => {});
          return response;
        }
        const cached = await caches.match('./index.html');
        return cached || response;
      } catch (_) {
        const cached = await caches.match('./index.html');
        return cached || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  const localCacheKey = toLocalCacheKey(event.request);
  if (localCacheKey) {
    // Local assets: NETWORK-FIRST with a 2.5s timeout — same pattern as
    // navigation above. On a normal open with a working connection this
    // always fetches the current deployed file, so a code change shows up
    // the very next time the app is opened. Falls back to whatever's
    // cached only if the network is slow/unavailable, so offline use is
    // unaffected.
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(event.request, { cache: 'no-cache' }, 2500);
        if (response && response.ok) {
          storeResponse(localCacheKey, response.clone()).catch(() => {});
          return response;
        }
        const cached = await caches.match(localCacheKey);
        return cached || response;
      } catch (_) {
        const cached = await caches.match(localCacheKey);
        return cached || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // External assets (fonts, CDN): cache-first, fallback to network
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetchWithTimeout(event.request, {}, 8000);
      await storeResponse(event.request, response);
      return response;
    } catch (_) {
      return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
