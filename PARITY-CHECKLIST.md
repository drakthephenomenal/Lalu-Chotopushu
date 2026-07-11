# Getting the Capacitor APK to match your TWA/PWA

## 1. Deploy the Zoho token-exchange Cloud Function

This repo folder contains `functions/`, `firebase.json`, `.firebaserc`.
Copy all three into your repo root (merge `firebase.json`/`.firebaserc` if
you already have them).

```bash
npm install -g firebase-tools      # if not already installed
firebase login

firebase functions:config:set \
  zoho.client_id="1000.SI61HY6OEFKXFN1Z9H2KIUL69ZO2KO" \
  zoho.client_secret="YOUR_ZOHO_CLIENT_SECRET" \
  zoho.redirect_uri="https://guru-kripahi-kevalam-108.firebaseapp.com/__/auth/handler"

cd functions && npm install && cd ..
firebase deploy --only functions
```

Get your real client secret from api-console.zoho.com (the same screen
where you got the client ID) — never put it in `app.js` or anywhere in the
repo, only in this Firebase config.

After deploy, confirm the function URL matches what's already set in
`app.js` → `ZOHO_NATIVE_CONFIG.exchangeUrl`:
```
https://us-central1-guru-kripahi-kevalam-108.cloudfunctions.net/zohoTokenExchange
```
(Firebase will print the actual URL after deploying — double check the
region is `us-central1`; if it deployed elsewhere, update that URL in
`app.js`.)

`app.js` has already been updated in this download to call this function
and finish sign-in with `signInWithCustomToken`. If your repo's `app.js`
has diverged from what I have, apply the same two edits manually — see
`app.js.patch-notes.md` in this zip for the exact before/after.

## 2. Fix native Google Sign-In

You already added SHA-1/SHA-256 fingerprints in Firebase. Now:

1. Download the fresh `google-services.json` (Firebase Console → Project
   settings → your Android app → the download link).
2. Replace `android/app/google-services.json` with it.
3. Confirm which fingerprint you added — **debug** or **release**:
   - If you added the *debug* SHA-1 (`./gradlew signingReport`, debug
     variant) → build with `npm run build:apk` (debug).
   - If you added a *release* SHA-1 → you must build with
     `npm run build:apk:release`, signed with that same keystore, or
     sign-in will fail with a `DEVELOPER_ERROR` (code 10).
4. Re-sync and rebuild:
   ```bash
   npx cap sync android
   npm run build:apk
   ```
5. Install the new APK fresh (uninstall the old one first — stale native
   plugin state can otherwise linger).

If it still fails, get the exact error:
```bash
adb logcat | grep -i "app.vercel.radharadharadha.capacitor"
```
Common codes: `10` = SHA-1/package name mismatch with `google-services.json`,
`12500` = Google Play Services out of date on the test device/emulator.

## 3. Rebuild and verify all four features

```bash
npx cap sync android
npm run build:apk
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

- **Google sign-in** → native account picker → signed in.
- **Zoho sign-in** → Chrome Custom Tab → Zoho login → redirects back →
  signed in (this is the flow that now goes through the Cloud Function).
- **Export JSON** → native Save/Share sheet.
- **Ghost mode** → sign in with a developer email from `firestore.rules` →
  user list populates.

Check `adb logcat` for anything that fails — every failure path in `app.js`
logs via `console.error(...)`.

## 4. GPS, vibration, and background sync (this update)

These three were failing in the APK for the same underlying reason: the app
only ever called the **web** APIs (`navigator.geolocation`,
`navigator.vibrate`). Those work in a real browser tab (PWA/TWA) but Android's
WebView never grants them the runtime permission because nothing was asking
for it through the native plugin bridge — the calls either silently timed out
or did nothing.

**What changed:**
- `package.json` — added `@capacitor/geolocation`, `@capacitor/haptics`,
  `@capacitor/background-runner`.
- `app.js` — added `lcGetPosition()` / `lcVibrate()` helpers near the top of
  the file. On the APK they go through the native plugins (and properly
  request the Android runtime permission first); in a browser tab they fall
  straight through to the old web APIs, so the PWA/TWA is unaffected. The GPS
  toggle and all three haptic-feedback call sites now use these helpers.
- `capacitor.config.json` — added a `BackgroundRunner` plugin block pointing
  at `background/runner.js` (that file already existed in your repo and
  already had the Firestore-sync logic written — it just wasn't wired up
  anywhere, so it never ran). It fires roughly hourly while the app is
  closed. The `CapacitorKV` staging code it depends on (`bgsync_uid`,
  `bgsync_refresh_token`, `bgsync_payload`) was already present in `app.js`.
- `package.json` scripts — `sync`/`build:apk`/`build:apk:release` now run
  `setup-www.sh` first automatically. Previously `www/` had to be rebuilt by
  hand before every sync, so stale files were easy to accidentally ship.
- `android-setup/setup-android.sh` — now double-checks that
  `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, and `VIBRATE` end up in
  `AndroidManifest.xml` (normally the Geolocation/Haptics plugins add these
  automatically via Gradle manifest merging on `cap sync`; this is just a
  safety net).

**Rebuild:**
```bash
npm install
npx cap sync android
npm run build:apk
```
Install fresh (uninstall the old APK first) and test:
- **GPS** → tap the GPS toggle → Android should show its normal system
  location permission dialog → coordinates populate.
- **Vibration** → any haptic-feedback action (tap/mala complete/milestone)
  should physically buzz the device.
- **Background sync** → do some jap, close the app fully (swipe away from
  recents), wait ~1 hr (or use `adb shell cmd jobscheduler run` to force it
  for testing) → check Firestore to confirm the data landed even though the
  app was closed. Also check Android Settings → Battery → make sure the app
  isn't battery-restricted, or the OS may skip the background task entirely
  regardless of the code — that setting can't be forced from app code.

If GPS still doesn't prompt: `adb logcat | grep -i geolocation` and confirm
`ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` are actually in the built
`AndroidManifest.xml` (Android Studio → Build → Analyze APK → pick the APK →
`AndroidManifest.xml`).

## 5. Daily reminder notification (local, option 1)

Added a new **Daily Reminder** card in Settings (above/below GPS Location)
with a toggle + time picker.

- **`package.json`** — added `@capacitor/local-notifications`.
- **`app.js`** — `lcRequestNotifPermission()`, `lcScheduleDailyReminder(hour,
  minute)`, `lcCancelDailyReminder()`. On the APK these schedule a real
  Android alarm via the native plugin (fires even if the app/WorkManager
  task isn't running). On the PWA there's no reliable way to wake a fully
  closed browser tab at an exact time without a push server, so the web path
  is best-effort: it fires via the `Notification` API while the tab (or its
  service worker) is alive. The toggle/time input state persists across
  restarts either way.
- **`index.html`** — new settings card, `id="tgDailyReminder"` +
  `id="reminderTimeInput"`.

This is intentionally **local-only** — nothing calls your server. When
you're ready for option 2 (server-triggered push via Firebase Cloud
Messaging, e.g. for admin broadcast messages or streak-based nudges), that's
a separate build: `@capacitor-firebase/messaging` on the client + a Cloud
Function or Admin SDK call on your backend to actually send the push. Say
the word and I'll wire that up next — it can reuse this same toggle UI.

**Test after rebuild:** toggle Daily Reminder on, set a time 1–2 minutes in
the future, close the app fully, wait — you should get a system notification
at that time. Re-open the app and toggle it off to confirm it cancels.

## 6. Push notifications (server-triggered, option 2)

Added a **Push Notifications** toggle in Settings (below Daily Reminder,
requires sign-in) plus a **📣 Send Push to All Users** button in Developer
Settings (only visible to the emails in `firestore.rules`' `isDeveloper()`
list — same list is duplicated in `functions/index.js` as `DEV_EMAILS`,
since Cloud Functions can't read the rules file).

**How it works:**
- `app.js` → `lcRegisterPush()` gets an FCM token (native via
  `@capacitor-firebase/messaging`, web via `firebase-messaging-compat.js` +
  a VAPID key) and saves it to the user's own doc:
  `users/{uid}/data/main.fcmToken`. No rules change was needed — the owner
  can already write anywhere under their own `users/{uid}` doc.
- `functions/index.js` → new `sendBroadcastNotification` callable function.
  Checks the caller's email against `DEV_EMAILS`, reads every stored
  `fcmToken` via a `collectionGroup('data')` query, sends via
  `admin.messaging().sendEachForMulticast`, and prunes any tokens FCM
  reports as dead.
- `sw.js` → bumped to v171, re-added a background FCM handler
  (`onBackgroundMessage`) so **web/PWA** users get a system notification
  even with the tab closed. This does not affect the APK — native push goes
  through the plugin directly, not this service worker.

**Manual steps required before this works (I can't do these for you — they
need your Firebase Console access and a deploy):**

1. **Web Push certificate (VAPID key)** — Firebase Console → Project
   settings → Cloud Messaging → Web configuration → "Generate key pair" if
   you don't have one → copy the key → paste it into `app.js`:
   ```js
   const FCM_VAPID_KEY = ""; // <- put your key here
   ```
   (Only needed for the PWA/web build to receive push. The APK doesn't need
   this — `google-services.json` already handles native FCM.)
2. **Deploy the new Cloud Function:**
   ```bash
   cd functions && npm install && cd ..
   firebase deploy --only functions:sendBroadcastNotification
   ```
3. Rebuild the APK as usual (`npm install && npx cap sync android && npm run build:apk`).

**Test:** on two different accounts/devices, sign in and toggle Push
Notifications on. As a developer account, open Settings → Developer
Settings → 📣 Send Push to All Users, enter a title/message. Both devices
should get a system notification within a few seconds — even if the app is
fully closed.
