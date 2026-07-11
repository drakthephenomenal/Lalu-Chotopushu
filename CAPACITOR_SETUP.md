# Capacitor rebuild guide — Google/Zoho sign-in, export, ghost mode

## What changed in this update
- `app.js` — `fbSignInGoogle()` and `fbSignInZoho()` now detect when they're
  running inside a native Capacitor app and use native sign-in flows instead
  of `signInWithPopup`/`signInWithRedirect`, which never work in an embedded
  WebView.
- `package.json` — added the Capacitor plugins these flows need.
- `capacitor.config.json` — new file, enables the Firebase Authentication
  plugin.
- Cache-busting version bumped (`app.js?v=134`, service worker `v170`) so the
  new code isn't served stale from cache.

Your JSON export code (`saveJsonFile`) and ghost mode were already written
correctly — they were failing only because (a) the required native plugins
weren't installed/synced, and (b) ghost mode requires being signed in as the
developer account, which sign-in being broken prevented.

## One important note
Your repo already has a working **TWA** build (`.well-known/assetlinks.json`,
package `app.vercel.radharadharadha.twa`, deployed via `vercel.json`). A TWA
runs inside real Chrome, so Google/Zoho sign-in already works there without
any of this. This guide is for a **separate Capacitor build** — don't reuse
the same appId unless you intend to replace the TWA entirely (and even then,
the Android signing key must match or Play Store will reject the update).

## 1. Fill in required values before building
- **`capacitor.config.json`** → `appId`: confirm or change the package name.
- **`app.js`** → `ZOHO_NATIVE_CONFIG.clientId`: get this from
  https://api-console.zoho.com (create/open your OIDC client under
  "Server-based Applications").
- **`app.js`** → `ZOHO_NATIVE_CONFIG.redirectUri`: must be registered in
  Zoho's console exactly as written, and reachable as a deep link back into
  the app (Android App Link or custom scheme — set up an intent-filter for
  it in `android/app/src/main/AndroidManifest.xml` after `cap add android`).
- If Zoho only gives you an authorization `code` (not `id_token`) in the
  redirect, you'll need a small backend/Cloud Function to exchange that code
  for tokens (Zoho requires a client secret, which must never ship inside
  the app) and return a Firebase custom token. The TODO is marked in
  `_zohoNativeSignIn()` in `app.js`.

## 2. Firebase Console — enable native Google Sign-In
1. Firebase Console → Project settings → Add Android app (if not already
   added), using the same package name as `capacitor.config.json`'s `appId`.
2. Get your Android signing certificate's SHA-1 and SHA-256:
   ```
   cd android && ./gradlew signingReport
   ```
3. Paste both fingerprints into the Firebase Console for that Android app.
4. Download the generated `google-services.json` and place it at
   `android/app/google-services.json` (after step 3 below creates the
   `android/` folder).

## 3. Build steps in GitHub Codespaces
```bash
# from the repo root
npm install
npx cap add android          # only if android/ doesn't exist yet
npx cap sync android

# copy the google-services.json you downloaded in step 2 into:
#   android/app/google-services.json

npm run build:apk            # produces android/app/build/outputs/apk/debug/app-debug.apk
```

For a release build (signed, for Play Store):
```bash
npm run build:apk:release
```
(You'll need a signing keystore configured in `android/app/build.gradle` for
this — ask me if you want help setting that up.)

## 4. Verify the fixes after installing the new APK
- **Google sign-in**: tap sign-in → should open a native Google account
  picker (not a webview popup) → returns you signed in.
- **Zoho sign-in**: tap sign-in → opens Chrome Custom Tabs → after login,
  should redirect back into the app automatically.
- **Export**: Settings → Export JSON → should show a native "Save/Share"
  sheet instead of doing nothing.
- **Ghost mode**: sign in with one of the developer emails in
  `firestore.rules` → the user list should now populate.

If any step still fails, check `adb logcat` (or Android Studio's Logcat)
filtered to your app's package name — the errors from this update are all
logged to console via `console.error(...)`.
