// ═══════════════════════════════════════════════════════
// Radha Naam Jap — Service Worker
// v81: PWA staleness fix — installed apps were stuck on v55 caches
//      causing Gaudiya/ISKCON toggle to lose styling and Mahamantra
//      floaters to render side-by-side. On activate we now nuke EVERY
//      old cache (any name) and force-navigate all clients so the
//      browser refetches index.html + style.css + app.js from network.
// ═══════════════════════════════════════════════════════
const CACHE = 'radha-jap-v81';

// These files are ALWAYS fetched fresh from the network (network-first, no-cache).
// Any content update in these files will be immediately visible even in installed PWA.
const ALWAYS_FRESH = [
  'index.html',
  'app.js',
  'style.css',
  'stotrams.js',
  'panchangData.js',
];

const PRECACHE = [
  './index.html',
  './style.css?v=80',
  './stotrams.js?v=80',
  './app.js?v=80',
  './panchangData.js?v=80',
  './guru.jpg',
  './icon-192.png?v=80',
  './icon-512.png',
  './manifest.json?v=80',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Hind+Siliguri:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:wght@400;600&family=Inter:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
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

// ── Install ──
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})))
    )
  );
});

// ── Activate ──
// CRITICAL: nuke EVERY cache (not just != CACHE) so stuck PWA users on old
// pre-v81 SW shake loose the stale style.css?v=55 / old index.html that
// were poisoning their layout.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // 1. Delete every cache except the current one
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));

    // 2. Take control of all open clients
    await self.clients.claim();

    // 3. Force every open client (installed PWA windows) to navigate again.
    //    A real navigation is the only way to evict the stale top-level
    //    response that an old SW handed them. Adds a cache-bust query so
    //    any HTTP-cached copy is bypassed too.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) {
      try {
        const u = new URL(c.url);
        u.searchParams.set('_swv', '81');
        await c.navigate(u.toString());
      } catch (_) {
        // fall back to message-based reload
        c.postMessage({ type: 'SW_UPDATED', version: CACHE });
      }
    }
  })());
});

// ── Fetch ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (BYPASS.some(h => url.href.includes(h))) return;

  const filename = url.pathname.split('/').pop();

  // ── Network-first for all core app files ──
  // Matches with or without ?v= query strings.
  if (
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    ALWAYS_FRESH.some(f => filename === f)
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        })
        .catch(() =>
          caches.match(e.request).then(cached =>
            cached || caches.match('./index.html')
          )
        )
    );
    return;
  }

  // ── Cache-first for static assets (icons, images, fonts, CDN) ──
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'error')
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => null);
      return cached || net.then(r => r || new Response('Offline', { status: 503 }));
    })
  );
});

// ── Messages from the page ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    e.waitUntil(
      self.registration.showNotification(e.data.title, {
        body: e.data.body,
        tag: e.data.tag,
        renotify: true,
        vibrate: [200, 100, 200],
        icon: './icon-192.png'
      })
    );
  }

  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Notification tap ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) { if ('focus' in client) return client.focus(); }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
