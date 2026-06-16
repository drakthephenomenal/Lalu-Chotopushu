// ═══════════════════════════════════════════════════════
// Radha Naam Jap — Service Worker
// Push notifications & FCM removed.
// ═══════════════════════════════════════════════════════
const CACHE = 'radha-jap-v146';

// Core assets needed to render the shell — fetched during install
const CORE_ASSETS = [
  './',
  './index.html',
  './404.html',
  './style.css',
  './app.js',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
];

// Large / optional local assets — cached in background, not blocking install
const LAZY_LOCAL_ASSETS = [
  './style-stotram.css',
  './stotrams.js',
  './panchangData.js',       // can be large — never block install on this
  './guru.jpg',
  './bhagavadik-bank.png',
  './radha-coin.png',
  './gurudev/1.png',
  './gurudev/2.png',
  './radha_vallabh/1.png',
  './hitju_maharaj/1.png',
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

// ── Prokerala / astronomy APIs — always bypass (live data, never cache) ──
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

// Fetch with a timeout — rejects after ms milliseconds
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

// ── INSTALL: only block on CORE assets; lazy + external are background ──
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Core assets — wait for these (8s timeout each)
    await Promise.allSettled(CORE_ASSETS.map((asset) => cacheLocalAsset(cache, asset)));
    // Large local + external assets — fully background, never block install
    Promise.allSettled(LAZY_LOCAL_ASSETS.map((asset) => cacheLocalAsset(cache, asset)));
    Promise.allSettled(EXTERNAL_ASSETS.map((asset) => cacheExternalAsset(cache, asset)));
  })());
});

// ── ACTIVATE: delete old caches, claim clients ──
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldKeys = keys.filter((key) => key !== CACHE);
    const isUpdate = oldKeys.length > 0;
    await Promise.all(oldKeys.map((key) => caches.delete(key)));
    await self.clients.claim();
    if (isUpdate) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', version: CACHE }));
      await Promise.allSettled(clients.map((client) => client.url ? client.navigate(client.url) : null));
    }
  })());
});

// ── FETCH ──
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Bypass Firebase & live API calls
  if (BYPASS.some((host) => url.href.includes(host))) return;
  if (BYPASS_PREFIXES.some((prefix) => url.href.startsWith(prefix))) return;

  // ── Navigation requests (page load) ──
  // Strategy: cache-first with 4s network timeout → instant load from cache,
  // background revalidation. Falls back to cache if network is slow/offline.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html');
      try {
        // Race: network with 4s timeout vs immediate cache return
        const networkPromise = fetchWithTimeout(event.request, { cache: 'no-cache' }, 4000);
        if (cached) {
          // Return cache immediately; revalidate in background
          networkPromise.then(async (response) => {
            if (response && response.ok) await storeResponse('./index.html', response);
          }).catch(() => {});
          return cached;
        }
        // No cache yet — wait for network (first install)
        const response = await networkPromise;
        if (response && response.ok) await storeResponse('./index.html', response);
        return response;
      } catch (_) {
        return cached || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  const localCacheKey = toLocalCacheKey(event.request);
  if (localCacheKey) {
    // ── Local assets: cache-first, stale-while-revalidate ──
    // Serve from cache immediately; update cache in background from network.
    event.respondWith((async () => {
      const cached = await caches.match(localCacheKey);
      // Background revalidation (stale-while-revalidate)
      const networkPromise = fetchWithTimeout(event.request, { cache: 'reload' }, 6000)
        .then(async (response) => {
          if (response && response.ok) await storeResponse(localCacheKey, response);
          return response;
        })
        .catch(() => null);
      if (cached) {
        // Return cache instantly; network updates it in background
        return cached;
      }
      // Nothing cached yet — must wait for network
      const response = await networkPromise;
      return response || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  // ── External assets (fonts, CDN): cache-first, fallback to network ──
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
