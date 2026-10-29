# Google sign-in fix (v1.0.139 -> next release)

## What's in this zip
- `.app-version` : set to 139, so the next build becomes 140 (the build adds 1).
  Replace `.app-version` in the repo root.
- `app.js` : your v1.0.139 app.js with a safer native Google sign-in.
  Replace the existing `app.js` in the repo root (the folder that gets copied into `www`).

## What the patch does
1. Wraps the 3 `signInWithGoogle` calls in `_nativeGoogleSignIn()`.
2. If the phone has no Credential Manager, it retries once with `useCredentialManager: false`
   (only works if your plugin version supports that option; ignored otherwise).
3. If that also fails, it shows a clear message and opens the "or use Email" section.

NOTE: this makes the failure friendly. It cannot by itself make Google sign-in work on
a phone that lacks Credential Manager. That needs the build-side step below.

## Build-side step (not a file I could safely overwrite)
Your Play build uses a newer @capacitor-firebase/authentication (Credential Manager).
The old repo used 6.3.1 (legacy Google Sign-In), which worked on your phone.
Pick one:
- A) In the project that builds the AAB, check the plugin README for the Android
  option that disables Credential Manager and set it.
- B) Pin the old stack in package.json (no ^) and rebuild:
  "@capacitor-firebase/authentication": "6.3.1", "@capacitor/android": "6.2.1",
  "@capacitor/core": "6.2.1", "@capacitor/cli": "6.2.1" (keep the other 6.x plugins),
  then run `npx cap sync android` and make sure targetSdk meets Play's current requirement.

## Before uploading to Play
- Version: `.app-version` = 139 makes the build produce 140 / 1.0.140.
- In Firebase, make sure the SHA-1/SHA-256 of the Play App Signing key
  (Play Console > App integrity) are added, then use the fresh google-services.json.
- Test on the phone that failed, with Play services updated and not updated.
