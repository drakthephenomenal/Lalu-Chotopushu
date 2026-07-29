# Android build setup — Google/Zoho sign-in, export, ghost mode

Your `app.js` code for all four features is already correct. What's missing
is (a) the generated `android/` project, and (b) three pieces of config that
only you can provide (they live in your Zoho/Firebase accounts).

## Step 0 — put this script in your repo
Copy `setup-android.sh` into the root of your repo (next to `package.json`),
in your GitHub Codespace.

## Step 1 — run the script
```bash
chmod +x setup-android.sh
./setup-android.sh
```
This will:
- `npm install`
- `npx cap add android` (generates the android/ project from the real
  Capacitor template — this needs the internet access your Codespace has)
- `npx cap sync android`
- Add the Zoho redirect deep link to `AndroidManifest.xml`
- Add the Google Services Gradle plugin to `android/build.gradle` and
  `android/app/build.gradle`
- Copy `google-services.json` into `android/app/`

It's idempotent — safe to re-run any time (e.g. after `npm run sync`).

## Step 2 — Firebase: register your Android app's signing fingerprints
```bash
cd android && ./gradlew signingReport
```
Copy the `SHA1` and `SHA256` values under the `debug` variant.

Firebase Console → Project settings → your Android app
(`app.vercel.radharadharadha.capacitor`) → **Add fingerprint** → paste both.

Then click **Download google-services.json** and overwrite
`android/app/google-services.json` with the new copy (it will now contain
an Android OAuth client, not just the web one — this is what native Google
Sign-In needs).

## Step 3 — Firebase: enable sign-in providers
Firebase Console → Authentication → Sign-in method:
- Enable **Google**.
- Add **Zoho** as a custom OIDC provider with ID `oidc.zoho` (if not already
  added) — issuer `https://accounts.zoho.com`, client ID/secret from step 4.

## Step 4 — Zoho: create an OIDC client
https://api-console.zoho.com → create a **Server-based Application**.
- Redirect URI: `https://guru-kripahi-kevalam-108.firebaseapp.com/__/auth/handler`
- Copy the **Client ID**.

Open `app.js`, find `ZOHO_NATIVE_CONFIG` (~line 4892), replace:
```js
clientId: "YOUR_ZOHO_CLIENT_ID_HERE",
```
with your real client ID.

> Note: Zoho's redirect may return an authorization `code` instead of an
> `id_token`. If that happens, you'll see the error "Received Zoho auth
> code but no server-side exchange is configured yet" — this needs a tiny
> Cloud Function to exchange the code for a Firebase custom token (Zoho
> requires a client secret, which can't ship inside the app). Ask if you
> want help building that.

## Step 5 — build
```bash
bash build-android.sh
```
This re-generates `android/` from scratch and re-applies every native patch
this project needs (manifest deep links, google-services.json, notification
icon/sound, MainActivity fixes, dependency fixes) before compiling — safe
and repeatable on every build. (Do **not** run `npm run build:apk` directly;
it skips all of these patches, which is what caused the notification icon
and custom sound to silently break in the past.)

APK: `android/app/build/outputs/apk/debug/app-debug.apk`
(right-click it in the Codespaces file explorer → Download).

## Step 6 — verify on device
- **Google sign-in** → native account picker opens, returns signed in.
- **Zoho sign-in** → Chrome Custom Tab opens Zoho login → redirects back
  into the app automatically.
- **Export JSON** → Settings → Export → native Save/Share sheet appears.
- **Ghost mode** → sign in with a developer email listed in
  `firestore.rules` → user list populates.

If something fails, check `adb logcat` (or Android Studio Logcat) filtered
to `app.vercel.radharadharadha.capacitor` — every failure path in `app.js`
logs via `console.error(...)`.
