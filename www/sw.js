// ═══════════════════════════════════════════════════════
// Radha Naam Jap — Service Worker  v189
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
const CACHE = 'radha-jap-v189';

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

// ── ACTIVATE: delete old caches. Do NOT claim clients (avoids mid-session takeover). ──
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldKeys = keys.filter((key) => key !== CACHE);
    await Promise.all(oldKeys.map((key) => caches.delete(key)));
    // v154: removed self.clients.claim().
    // The new SW now takes over on the next navigation, not mid-session.
    // This eliminates the controllerchange→reload double-load.
    // Still notify open tabs so they CAN show a soft "Update available" pill
    // (app.js v154 no longer auto-reloads on this message).
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
    // Local assets: cache-first, stale-while-revalidate
    event.respondWith((async () => {
      const cached = await caches.match(localCacheKey);
      const networkPromise = fetchWithTimeout(event.request, { cache: 'reload' }, 6000)
        .then(async (response) => {
          if (response && response.ok) await storeResponse(localCacheKey, response);
          return response;
        })
        .catch(() => null);
      if (cached) return cached;
      const response = await networkPromise;
      return response || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
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
