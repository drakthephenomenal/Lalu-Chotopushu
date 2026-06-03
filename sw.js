// ═══════════════════════════════════════════════════════
// Radha Naam Jap — Service Worker
// v118: FCM integrated — handles background push messages directly.
//       Removed local SHOW_NOTIFICATION (no more setTimeout-based notifications).
//       importScripts Firebase at top so FCM push events work in this SW.
// v117: removed dead se-bridge.js + dead Ekadashi detector
// v115: removed all Ekadashi / Mahadvadashi / Paran logic & UI
// ═══════════════════════════════════════════════════════

// Firebase Messaging — must be imported before any push event can be handled
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyCvvXEdsJjXpTbITE2HuyYFnPZfZIkxVWA',
  authDomain:        'guru-kripahi-kevalam-108.firebaseapp.com',
  projectId:         'guru-kripahi-kevalam-108',
  storageBucket:     'guru-kripahi-kevalam-108.firebasestorage.app',
  messagingSenderId: '368485403238',
  appId:             '1:368485403238:web:a3ab5c1427ad0c40fffba7',
});

const messaging = firebase.messaging();

// Called when a push arrives and the app is in the BACKGROUND or closed
messaging.onBackgroundMessage((payload) => {
  const n    = payload.notification || {};
  const tag  = (payload.data && payload.data.tag) || 'radha-jap';
  return self.registration.showNotification(n.title || 'राधे राधे 🙏', {
    body:     n.body || '',
    tag,
    icon:     './icon-192.png',
    badge:    './icon-192.png',
    renotify: true,
    vibrate:  [200, 100, 200],
  });
});

// ───────────────────────────────────────────────────────
// Offline cache
// ───────────────────────────────────────────────────────
const CACHE = 'radha-jap-v118';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './404.html',
  './style.css',
  './style-stotram.css',
  './stotrams.js',
  './app.js',
  './panchangData.js',
  './guru.jpg',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
];

const EXTERNAL_ASSETS = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js',
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
  'fcm.googleapis.com',
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

async function cacheLocalAsset(cache, asset) {
  try {
    const response = await fetch(asset, { cache: 'reload' });
    if (response && response.ok) await cache.put(asset, response.clone());
  } catch (_) {}
}

async function cacheExternalAsset(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload', mode: 'no-cors' });
    if (response && (response.ok || response.type === 'opaque')) await cache.put(url, response.clone());
  } catch (_) {}
}

async function storeResponse(cacheKey, response) {
  if (!response || (!response.ok && response.type !== 'opaque')) return;
  const cache = await caches.open(CACHE);
  await cache.put(cacheKey, response.clone());
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(LOCAL_ASSETS.map((a) => cacheLocalAsset(cache, a)));
    await Promise.allSettled(EXTERNAL_ASSETS.map((a) => cacheExternalAsset(cache, a)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED', version: CACHE }));
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (BYPASS.some((host) => url.href.includes(host))) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-cache' });
        if (response && response.ok) await storeResponse('./index.html', response);
        return response;
      } catch (_) {
        return (await caches.match('./index.html')) || new Response('Offline', {
          status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  const localCacheKey = toLocalCacheKey(event.request);
  if (localCacheKey) {
    event.respondWith((async () => {
      const cached = await caches.match(localCacheKey);
      if (cached) return cached;
      try {
        const response = await fetch(event.request, { cache: 'no-cache' });
        await storeResponse(localCacheKey, response);
        return response;
      } catch (_) {
        return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      await storeResponse(event.request, response);
      return response;
    } catch (_) {
      return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  })());
});

self.addEventListener('message', (event) => {
  // All notifications now come via Firebase Cloud Messaging — no local SHOW_NOTIFICATION.
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
