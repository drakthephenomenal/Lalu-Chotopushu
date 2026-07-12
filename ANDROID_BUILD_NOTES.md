# Android Build Notes

Everything below was learned the hard way building this app's first working
APK. `build-android.sh` automates all of it — **use `npm run build:apk`
(or `bash build-android.sh`) instead of running `cap add android` +
`gradlew` manually**, or you'll hit these same issues again.

## What the build script fixes automatically

| Problem | Fix |
|---|---|
| `@capacitor/background-runner@^6.0.1` doesn't exist on npm | Pinned to `^2.3.1` in `package.json` (first version with Capacitor 6 support) |
| Gradle 8.2.1 crashes under JDK 21 (`jdkImage` transform bug) | Project's `gradle/wrapper/gradle-wrapper.properties` bumped to Gradle 8.6 |
| `background-runner`'s own `build.gradle` can't resolve `compileSdkVersion` from the root project | Script hardcodes `compileSdk 34` directly in `node_modules/@capacitor/background-runner/android/build.gradle` after every `npm install` |
| `background-runner` needs a `.aar` file that `cap sync` doesn't copy | Script copies it into `android/capacitor-cordova-android-plugins/src/main/libs/` after every sync |
| Google Sign-In crashes: `NoClassDefFoundError: GoogleSignIn` | Script adds `com.google.android.gms:play-services-auth` to `android/app/build.gradle` |
| GPS permission never requested — Android shows no Location option at all | Script adds `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` to `AndroidManifest.xml` (the `@capacitor/geolocation` plugin doesn't declare these itself) |
| App text renders larger than the PWA | Script rewrites `MainActivity.java` to force `WebView.getSettings().setTextZoom(100)` (native WebView inherits system font scaling; Chrome/PWA doesn't) |
| `google-services.json` missing after a fresh `android/` regenerate | Script restores it from repo root or git history automatically |

## Manual steps this script can't do for you

- **JDK**: needs JDK 21 active. The script tries `sdk use java 21.0.5-tem`
  via SDKMAN automatically; if your environment doesn't have SDKMAN, install
  JDK 21 yourself and make sure `java -version` shows `21.x` before running
  the script.
- **Firebase SHA fingerprints**: Google Sign-In requires your debug
  keystore's SHA-1 *and* SHA-256 registered in Firebase Console → Project
  settings → your Android app. Get them with:
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep -E "SHA1|SHA256"
  ```
- **Icon**: put a 1024×1024 `resources/icon.png` in the repo root — the
  script auto-generates all densities from it via `capacitor-assets`.

## Why `android/` isn't committed to git

Only `android/app/google-services.json` is tracked. Everything else is
regenerated fresh by `npx cap add android` each time, since a hand-edited,
partially-committed native project tends to drift out of sync with what
Capacitor actually expects and causes confusing partial-state build errors.
The build script re-applies every patch above from scratch every time, so
this is safe and actually more reliable than committing `android/` directly.
