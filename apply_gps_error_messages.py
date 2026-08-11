#!/usr/bin/env python3
"""
Replaces the generic "GPS error - check console" toast with specific,
actionable messages based on the actual error code/type — so users (and
you, debugging from a screenshot) know exactly what's wrong without
needing a dev console:

  - Permission denied (app-level)         -> tells them to grant location
                                              permission in app settings
  - Location services/GPS off (OS-level)  -> tells them to turn on
                                              Location in phone Settings
  - Timeout (GPS couldn't get a fix)      -> tells them to try again
                                              outdoors / near a window
  - Anything else                          -> falls back to showing the
                                              raw error message, same as
                                              before

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_gps_error_messages.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js -> app.js.bak-gpserrors first.

After running:
    bash setup-www.sh
    npx cap sync android
"""
import os
import sys

APP_JS_FILES = ["app.js", os.path.join("www", "app.js")]

MARKER = "function _lcGpsErrorMessage("

HELPER = '''// ── Turn a raw Geolocation error into a clear, actionable message ──
// Android's system Location toggle (device-wide) is a completely separate
// setting from the app's own location permission — a very common source
// of confusion, since the app permission popup can be "Allowed" while the
// phone's actual GPS/Location service is still switched off entirely.
function _lcGpsErrorMessage(err) {
  const code = err && err.code;
  const msg = (err && err.message) || String(err || "");
  const msgLower = msg.toLowerCase();

  // Web Geolocation API: code 1 = PERMISSION_DENIED
  // Capacitor Geolocation plugin: throws "Location permission denied" (see lcGetPosition)
  if (code === 1 || msgLower.includes("permission")) {
    return "⚠️ Location permission not granted. Please allow location access for this app in your phone's Settings → Apps → Radha Naam Jap → Permissions.";
  }

  // Web Geolocation API: code 2 = POSITION_UNAVAILABLE (often means GPS/Location
  // service is off device-wide). Capacitor/Android often surfaces this as a
  // message mentioning "location" being disabled/unavailable.
  if (
    code === 2 ||
    msgLower.includes("unavailable") ||
    msgLower.includes("disabled") ||
    msgLower.includes("not enabled") ||
    msgLower.includes("location service")
  ) {
    return "📍 Your phone's Location service appears to be turned off. Please turn on Location (swipe down from the top → tap Location, or Settings → Location) and try again.";
  }

  // Web Geolocation API: code 3 = TIMEOUT
  if (code === 3 || msgLower.includes("timeout") || msgLower.includes("timed out")) {
    return "⏱️ Couldn't get a GPS fix in time. Try again outdoors or near a window for a clearer signal.";
  }

  // Fallback — still show something useful rather than a bare error object.
  return "⚠️ GPS error: " + (msg || "Unknown error");
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
            "differ from the version this patch was written against — "
            "aborting without changing anything."
        )
    if count > 1:
        die(
            f"[{filename}] Anchor for '{label}' appears {count} times "
            "(expected exactly 1) — aborting without changing anything."
        )
    return src.replace(old, new, 1)


def patch_file(path):
    if not os.path.isfile(path):
        print(f"  {path}: not found — skipping.")
        return False

    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        print(f"  {path}: already patched — skipping.")
        return False

    old = '''        (err) => {
          console.error("GPS error:", err);
          if (statusEl) statusEl.textContent = "⚠️ GPS error: " + (err && err.message ? err.message : JSON.stringify(err));
          toast("⚠️ GPS error - check console");
        },'''

    new = '''        (err) => {
          console.error("GPS error:", err);
          const _gpsMsg = _lcGpsErrorMessage(err);
          if (statusEl) statusEl.textContent = _gpsMsg;
          toast(_gpsMsg);
        },'''

    src = apply_edit(src, old, new, "use clearer GPS error message in toast", path)

    if "function lcGetPosition(" not in src:
        die(f"[{path}] Could not find 'function lcGetPosition(' anchor — aborting without changing anything.")

    src = apply_edit(src, "async function lcGetPosition(", HELPER + "async function lcGetPosition(", "insert _lcGpsErrorMessage helper", path)

    with open(path + ".bak-gpserrors", "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())

    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"  {path}: patched. Backup: {path}.bak-gpserrors")
    return True


def main():
    print("Patching GPS error messages:")
    any_applied = False
    for path in APP_JS_FILES:
        if patch_file(path):
            any_applied = True

    print("")
    if any_applied:
        print("Next steps:")
        print("   bash setup-www.sh")
        print("   npx cap sync android")
        print("   git add app.js www/app.js")
        print('   git commit -m "Clearer GPS error messages"')
        print("   git push")
    else:
        print("Nothing to do — already applied everywhere.")


if __name__ == "__main__":
    main()
