// ═══════════════════════════════════════════════════════
// Radha Naam Jap — Service Worker
// v55: Background Periodic Sync for Drive backup
// ═══════════════════════════════════════════════════════
const CACHE = 'radha-jap-v55';

const PRECACHE = [
  './index.html',
  './style.css',
  './stotrams.js',
  './app.js',
  './guru.jpg',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Hind+Siliguri:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:wght@400;600&family=Inter:wght@300;400;500;600&display=swap',
  'https://accounts.google.com/gsi/client',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
  'https://apis.google.com/js/api.js'
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
  'googleapis.com/drive',
  'googleapis.com/upload'
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
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE })))
  );
});

// ── Fetch ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (BYPASS.some(h => url.href.includes(h))) return;

  if (url.pathname.endsWith('index.html') || url.pathname.endsWith('/') || e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(resp => {
          if (resp && resp.status === 200) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.pathname.endsWith('app.js') || url.pathname.endsWith('style.css') || url.pathname.endsWith('stotrams.js')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(resp => {
          if (resp && resp.status === 200) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

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

// ── Background Periodic Sync — fires daily when app is closed (Android PWA) ──
self.addEventListener('periodicsync', e => {
  if (e.tag === 'gdrive-midnight-backup') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        if (clients.length > 0) {
          // App is open — tell it to run backup
          clients.forEach(client => client.postMessage({ type: 'TRIGGER_GDRIVE_BACKUP' }));
        } else {
          // App is closed — do backup directly from SW
          return _swDoDirectBackup();
        }
      })
    );
  }
});

// ── Direct backup from SW (app is closed) ──
async function _swDoDirectBackup() {
  try {
    const cache = await caches.open('rjap-backup-data');
    const [tokenResp, payloadResp, metaResp] = await Promise.all([
      cache.match('gd-token'), cache.match('gd-payload'), cache.match('gd-meta')
    ]);
    if (!tokenResp || !payloadResp) return;

    const token = await tokenResp.text();
    const payload = await payloadResp.text();
    const meta = metaResp ? JSON.parse(await metaResp.text()) : {};
    const today = new Date().toISOString().split('T')[0];

    if (meta.lastBackupDate === today) return; // Already done
    if (meta.tokenExpiry && meta.tokenExpiry < Date.now()) return; // Token expired

    const filename = 'radha-naam-jap-auto-' + today + '.json';
    const listResp = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("name='" + filename + "' and trashed=false") + '&spaces=drive&fields=files(id)',
      { headers: { 'Authorization': 'Bearer ' + token } }
    );
    if (!listResp.ok) return;

    const listData = await listResp.json();
    const fileId = listData.files && listData.files.length ? listData.files[0].id : null;
    const boundary = 'rjap_sw_' + Date.now();
    const fileMeta = JSON.stringify({ name: filename, mimeType: 'application/json' });
    const body = '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+fileMeta+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+payload+'\r\n--'+boundary+'--';
    const method = fileId ? 'PATCH' : 'POST';
    const url = fileId
      ? 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=multipart'
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const uploadResp = await fetch(url, {
      method,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });

    if (uploadResp.ok) {
      meta.lastBackupDate = today;
      await cache.put('gd-meta', new Response(JSON.stringify(meta)));
      await self.registration.showNotification('☁️ Radha Naam Jap Backed Up', {
        body: 'Auto backup saved to Google Drive for ' + today + ' 🙏',
        tag: 'gdrive-auto-backup',
        icon: './icon-192.png',
        vibrate: [200, 100, 200]
      });
      console.log('[SW] Background backup done:', filename);
    }
  } catch(e) {
    console.warn('[SW] Background backup error:', e.message);
  }
}

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

  // App caches token + payload in SW for background sync use when app is closed
  if (e.data && e.data.type === 'CACHE_BACKUP_DATA') {
    e.waitUntil((async () => {
      const cache = await caches.open('rjap-backup-data');
      await Promise.all([
        cache.put('gd-token',   new Response(e.data.token)),
        cache.put('gd-payload', new Response(e.data.payload)),
        cache.put('gd-meta',    new Response(JSON.stringify({
          tokenExpiry:    e.data.tokenExpiry    || 0,
          lastBackupDate: e.data.lastBackupDate || ''
        })))
      ]);
    })());
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
