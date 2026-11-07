// firebase-messaging-sw.js
// Must be deployed at the SITE ROOT (same level as index.html), reachable at
// https://<your-domain>/firebase-messaging-sw.js — Firebase Messaging
// registers it at scope '/firebase-cloud-messaging-push-scope' and it was
// 404ing at that exact path, which is what broke the Drive backup button
// (see explanation in chat).

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCvvXEdsJjXpTbITE2HuyYFnPZfZIkxVWA",
  authDomain: "guru-kripahi-kevalam-108.firebaseapp.com",
  projectId: "guru-kripahi-kevalam-108",
  storageBucket: "guru-kripahi-kevalam-108.firebasestorage.app",
  messagingSenderId: "368485403238",
  appId: "1:368485403238:web:a3ab5c1427ad0c40fffba7",
  measurementId: "G-SJP0N1FDZD",
});

const messaging = firebase.messaging();

// Handles push notifications that arrive while the app/tab is closed or
// backgrounded (foreground messages are handled in app.js via onMessage()).
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "RadhaNaam SudhaRasam";
  const body = (payload.notification && payload.notification.body) || "";
  const opts = {
    body,
    icon: "/notif-icon.png",
    badge: "/notif-icon.png",
  };
  const mid = payload.fcmMessageId || (payload.data && payload.data["google.message_id"]);
  if (payload.data && payload.data.pid) opts.tag = "s:" + payload.data.pid;   // id the server kept this push under
  else if (mid) opts.tag = "p:" + mid;   // unique id → the app can list it in 🔔 without duplicates
  self.registration.showNotification(title, opts);
});

// Tapping a push: bring the app forward and tell it the message was opened (→ marked read in 🔔)
self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  n.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const msg = { type: "rjap-notif-click", title: n.title, body: n.body, tag: n.tag || "", timestamp: n.timestamp || Date.now() };
      for (const c of list) { try { c.postMessage(msg); } catch (_e) {} }
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return self.clients.openWindow ? self.clients.openWindow("/") : null;
    })
  );
});
