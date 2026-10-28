# Play Console answers — RadhaNaam SudhaRasam
(Copy/paste and adjust. Answer honestly; Google may ask for proof.)

## Links
- Privacy policy: https://radharadharadha.vercel.app/privacy.html
- Account deletion page: https://radharadharadha.vercel.app/delete-account.html
- In-app deletion: Settings > Cloud Sync & Backup > Delete My Account & Data

## App content
- Ads: No ads.
- Target audience: 13+ (not designed for children).
- App access: Most features work without login. Sign-in with Google is optional (for cloud sync).
  If asked for a test account, give a spare Gmail and say: "Sign in from Settings > Cloud Sync".
- Category: Lifestyle (or Books & Reference). News app: No. Health app: No. Financial features: No.

## Foreground service declaration  (type: mediaPlayback)
Permission: FOREGROUND_SERVICE_MEDIA_PLAYBACK
Text:
"The app plays devotional naam/kirtan audio chosen by the user. While audio is playing and the user
switches apps or turns the screen off, a foreground service with a visible 'Playing in the background'
notification keeps playback going. It starts only when the user starts audio and stops when playback stops."
Video to record (30-60 sec): open the app, start audio, press Home, show the notification, lock the screen,
audio keeps playing, stop it from the app, notification disappears.

## Exact alarm declaration  (SCHEDULE_EXACT_ALARM)
Text:
"The app lets users set a daily reminder for their prayer/naam-jap practice at a time they choose.
Exact timing matters because the reminder is tied to the user's chosen worship time. The exact-alarm
permission is never requested automatically; it is requested only when the user taps the 'Exact alarm'
option in Settings. Without it, reminders can arrive late."
Fallback if Google rejects it: remove the permission (add tools:node="remove" for
android.permission.SCHEDULE_EXACT_ALARM in the manifest) and use inexact reminders.

## Location (ACCESS_COARSE/FINE_LOCATION)
"Used only while the app is open, and only after the user turns on the 'GPS Location' toggle, to calculate
local sunrise/sunset and related prayer times. Never used in the background, never sold or shared."

## Other permissions
- POST_NOTIFICATIONS: reminders and optional announcements.
- WAKE_LOCK / RECEIVE_BOOT_COMPLETED: keep reminders and audio working (added by plugins).
- INTERNET: sync and audio streaming.

## Data safety form
Data is encrypted in transit: Yes.  Users can request deletion: Yes (in-app + web link above).
Data shared with third parties: No. (Firebase/Google act as service providers for the app.)

| Data type | Collected | Purpose | Optional? |
|---|---|---|---|
| Name, email address | Yes | Account management | Yes (sign-in is optional) |
| Approximate + precise location | Yes | App functionality (prayer times) | Yes (GPS toggle) |
| App activity (jap counts, history, settings) | Yes | App functionality, sync | Yes |
| Messages (feedback you send) | Yes | App functionality, support | Yes |
| Device or other IDs (push token) | Yes | App functionality (notifications) | Yes |
| Files (backup JSON in your own Google Drive) | Yes, only with user permission | Backup | Yes |

Note: if the leaderboard is on, display name and jap totals are visible to other signed-in users.
Mention this in the privacy policy (already done) and keep the opt-out switch in Settings.

## Release checklist
1. Run workflow "Build AAB (Google Play)" and download the artifact (the .aab).
2. Play Console > Testing > Closed testing > Create release > upload the .aab.
3. Turn on Play App Signing when asked (recommended).
4. Fill App content, Data safety and the declarations above.
5. Keep versionCode increasing (the build script does this automatically).
