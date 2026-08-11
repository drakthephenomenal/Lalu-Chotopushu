#!/usr/bin/env python3
"""
Restores a "one tap" GPS-enable experience that existed before the app
switched to the native @capacitor/geolocation plugin. Browsers automatically
prompt to turn on Location when it's off; the native plugin does not — it
just fails. This patch makes the GPS toggle check first and, if Location is
off, jump the user straight to Android's Location settings screen instead
of showing a dead-end error.

SCOPE NOTE: this is a simpler, lower-risk version of the fix compared to
Google Play Services' full "Location Accuracy" resolution dialog (the exact
in-context prompt seen in the browser test). That fuller version needs a
new Play Services dependency and Capacitor's ActivityResult wiring, which
is finicky and NOT something verifiable without a real Gradle build - too
risky to ship blind. This version uses only plain Android SDK APIs
(LocationManager, a standard Settings intent), the same proven pattern
already used successfully elsewhere in PowerPermissionsPlugin.java. It's
one extra tap (jump to Location settings, flip it, come back) rather than
a single in-app dialog tap, but it's reliable with no new dependencies.

REQUIRES android-src/PowerPermissionsPlugin.java to already have
isLocationEnabled() and openLocationSettings() methods (added directly
during this session's chat) - this script checks for both and stops with
a clear message if either is missing, rather than shipping half a fix.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_gps_settings_shortcut.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js -> app.js.bak-gpsshortcut first.

After running:
    bash setup-www.sh
    npx cap sync android
    git add app.js www/app.js android-src/PowerPermissionsPlugin.java
    git commit -m "Restore one-tap GPS enable shortcut"
    git push
    bash build-android.sh
"""
import os
import sys

APP_JS_FILES = ["app.js", os.path.join("www", "app.js")]
NATIVE_PLUGIN_FILE = os.path.join("android-src", "PowerPermissionsPlugin.java")

MARKER = "_lcProceedWithGpsRequest"

OLD_CALL_SITE = '''      const statusEl = document.getElementById("gpsLocationStatus");
      if (statusEl) statusEl.textContent = "📍 Detecting your location…";
      lcGetPosition({ timeout: 10000, maximumAge: 0 }).then(
        (pos) => {
          const lat = pos.coords.latitude, lng = pos.coords.longitude;
          window._appLat = lat; window._appLng = lng; // share with Vedic Panchanga engine
          if (App.S) { App.S.lastLat = lat; App.S.lastLng = lng; App.save(); }
          // Persist GPS-enabled state and coords to localStorage so the toggle
          // stays ON across refreshes for both guest and signed-in users,
          // WITHOUT re-prompting for geolocation permission on load.
          try {
            localStorage.setItem("rjap_gps_enabled", "1");
            localStorage.setItem("rjap_lastLat", String(lat));
            localStorage.setItem("rjap_lastLng", String(lng));
          } catch(e) {}
          updateSunInfo(lat, lng);
          if (tgGps) tgGps.classList.add("on");
          if (statusEl) statusEl.textContent = "✅ Location detected · " + lat.toFixed(3) + ", " + lng.toFixed(3);
          toast("📍 GPS location saved! Brahma Muhurta times updated 🙏");
          if (typeof renderCal === "function") renderCal();
        },
        (err) => {
          console.error("GPS error:", err);
          const _gpsMsg = _lcGpsErrorMessage(err);
          if (statusEl) statusEl.textContent = _gpsMsg;
          toast(_gpsMsg);
        },
      );'''

NEW_CALL_SITE = '''      const statusEl = document.getElementById("gpsLocationStatus");
      if (statusEl) statusEl.textContent = "📍 Detecting your location…";
      _lcProceedWithGpsRequest(statusEl, tgGps);'''

HELPER_FN = '''// -- GPS toggle handler: check the phone's system Location service first --
// (native platform only - browsers already prompt for this automatically).
// If it's off, jump straight to Android's Location settings screen instead
// of letting lcGetPosition() fail with a generic error the user then has
// to interpret and act on themselves.
async function _lcProceedWithGpsRequest(statusEl, tgGps) {
  if (_lcIsNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.PowerPermissions) {
    try {
      const res = await window.Capacitor.Plugins.PowerPermissions.isLocationEnabled();
      if (!res || !res.value) {
        if (statusEl) statusEl.textContent = "📍 Location is off — opening settings…";
        toast("📍 Please turn on Location, then come back and tap GPS Location again");
        try { await window.Capacitor.Plugins.PowerPermissions.openLocationSettings(); } catch (_e) {}
        return;
      }
    } catch (_e) {
      // isLocationEnabled/openLocationSettings not available (e.g. an older
      // installed build before these native methods existed) - fall through
      // to the normal flow below, identical to before this patch.
    }
  }
  lcGetPosition({ timeout: 10000, maximumAge: 0 }).then(
    (pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      window._appLat = lat; window._appLng = lng; // share with Vedic Panchanga engine
      if (App.S) { App.S.lastLat = lat; App.S.lastLng = lng; App.save(); }
      try {
        localStorage.setItem("rjap_gps_enabled", "1");
        localStorage.setItem("rjap_lastLat", String(lat));
        localStorage.setItem("rjap_lastLng", String(lng));
      } catch(e) {}
      updateSunInfo(lat, lng);
      if (tgGps) tgGps.classList.add("on");
      if (statusEl) statusEl.textContent = "✅ Location detected · " + lat.toFixed(3) + ", " + lng.toFixed(3);
      toast("📍 GPS location saved! Brahma Muhurta times updated 🙏");
      if (typeof renderCal === "function") renderCal();
    },
    (err) => {
      console.error("GPS error:", err);
      const _gpsMsg = _lcGpsErrorMessage(err);
      if (statusEl) statusEl.textContent = _gpsMsg;
      toast(_gpsMsg);
    },
  );
}

'''


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def apply_edit(src, old, new, label, filename):
    count = src.count(old)
    if count == 0:
        die(
            f"[{filename}] Anchor for '{label}' not found. This file may "
            "differ from the version this patch was written against - "
            "aborting without changing anything."
        )
    if count > 1:
        die(
            f"[{filename}] Anchor for '{label}' appears {count} times "
            "(expected exactly 1) - aborting without changing anything."
        )
    return src.replace(old, new, 1)


def main():
    if not os.path.isfile(NATIVE_PLUGIN_FILE):
        die(f"Could not find {NATIVE_PLUGIN_FILE}.")

    with open(NATIVE_PLUGIN_FILE, "r", encoding="utf-8") as f:
        native_src = f.read()

    if "isLocationEnabled" not in native_src or "openLocationSettings" not in native_src:
        die(
            f"{NATIVE_PLUGIN_FILE} is missing isLocationEnabled()/openLocationSettings(). "
            "Those were added directly to that file during this session's chat - make sure "
            "it matches before running this script."
        )
    print(f"  {NATIVE_PLUGIN_FILE}: confirmed isLocationEnabled()/openLocationSettings() present.")
    print("")

    print("Patching app.js (GPS toggle handler):")
    any_applied = False
    for path in APP_JS_FILES:
        if not os.path.isfile(path):
            print(f"  {path}: not found - skipping.")
            continue

        with open(path, "r", encoding="utf-8") as f:
            src = f.read()

        if MARKER in src:
            print(f"  {path}: already patched - skipping.")
            continue

        if "async function lcGetPosition(" not in src:
            die(f"[{path}] Could not find 'async function lcGetPosition(' anchor.")

        src = apply_edit(
            src,
            "async function lcGetPosition(",
            HELPER_FN + "async function lcGetPosition(",
            "insert _lcProceedWithGpsRequest helper",
            path,
        )

        src = apply_edit(src, OLD_CALL_SITE, NEW_CALL_SITE, "route GPS toggle through the pre-check helper", path)

        with open(path + ".bak-gpsshortcut", "w", encoding="utf-8") as f:
            f.write(open(path, "r", encoding="utf-8").read())

        with open(path, "w", encoding="utf-8") as f:
            f.write(src)

        print(f"  {path}: patched. Backup: {path}.bak-gpsshortcut")
        any_applied = True

    print("")
    if any_applied:
        print("Next steps:")
        print("   bash setup-www.sh")
        print("   npx cap sync android")
        print("   git add app.js www/app.js android-src/PowerPermissionsPlugin.java")
        print('   git commit -m "Restore one-tap GPS enable shortcut"')
        print("   git push")
        print("   bash build-android.sh")
    else:
        print("Nothing to do - already applied everywhere.")


if __name__ == "__main__":
    main()
