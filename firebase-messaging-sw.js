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
  const title = (payload.notification && payload.notification.title) || "Radha Naam Jap";
  const body = (payload.notification && payload.notification.body) || "";
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
  });
});
