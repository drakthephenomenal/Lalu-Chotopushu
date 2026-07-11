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
