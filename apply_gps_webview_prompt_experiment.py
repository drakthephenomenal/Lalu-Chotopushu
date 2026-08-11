#!/usr/bin/env python3
"""
EXPERIMENTAL — low risk, uncertain payoff. Read the note below before running.

Tries routing the native app's GPS request through the WebView's own
navigator.geolocation API (same API your browser test used, which showed
the automatic "Turn on Location" system dialog) instead of only the
Capacitor Geolocation plugin — on the chance that Android's System WebView
(also Chromium-based) offers the same automatic Play Services integration
that Chrome/Safari do.

⚠️ HONEST UNCERTAINTY: whether this actually triggers the same in-context
system dialog inside a Capacitor WebView depends on Capacitor's internal
WebView configuration (specifically whether it implements
WebChromeClient.onGeolocationPermissionsShowPrompt), which isn't something
I can verify without your device. This is a pure JS change — no compile
risk, no crash risk, safe to try — but it may simply not trigger the
dialog, in which case it silently falls through to the existing
settings-shortcut behavior already shipped (nothing is removed or made
worse either way).

WHAT THIS SCRIPT DOES:
  Modifies lcGetPosition()'s native branch so that, when running natively,
  it ALSO tries navigator.geolocation.getCurrentPosition() (the same call
  the web/browser branch already uses) instead of relying solely on the
  Capacitor Geolocation plugin. Whichever resolves first wins; if both
  fail, the existing settings-shortcut fallback (from the previous patch)
  still applies as before.

REQUIRES apply_gps_settings_shortcut.py to already be applied — this
script edits the same lcGetPosition() area and checks for that first.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_gps_webview_prompt_experiment.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js -> app.js.bak-gpswebview first.

After running:
    bash setup-www.sh
    npx cap sync android
    git add app.js www/app.js
    git commit -m "Experiment: try WebView navigator.geolocation for system prompt"
    git push
    bash build-android.sh

TEST ON YOUR PHONE: turn Location off, tap GPS toggle. If a system dialog
now appears in-app (not a jump to Settings), it worked. If you still just
get jumped to Settings (the existing fallback), this experiment didn't
pan out on your device/Capacitor version — that's useful information, not
a failure of the script itself.
"""
import os
import sys

APP_JS_FILES = ["app.js", os.path.join("www", "app.js")]
MARKER = "_lcTryWebViewGeolocation"

OLD_BLOCK = '''    return Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: options.timeout || 10000,
    });
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}'''

NEW_BLOCK = '''    // EXPERIMENT: also try the WebView's own navigator.geolocation, on the
    // chance it triggers the same automatic system "Turn on Location"
    // dialog seen in a regular browser (Android's System WebView is also
    // Chromium-based). Whichever resolves first is used; if the native
    // plugin call above already resolved, this is simply unused.
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        return await Promise.race([
          Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: options.timeout || 10000,
          }),
          _lcTryWebViewGeolocation(options),
        ]);
      } catch (_e) {
        // both attempts failed — fall through to native-only call below,
        // which will surface the real error via the normal catch path.
      }
    }
    return Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: options.timeout || 10000,
    });
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function _lcTryWebViewGeolocation(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}'''


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
    print("Patching lcGetPosition() to try WebView navigator.geolocation:")
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

        src = apply_edit(src, OLD_BLOCK, NEW_BLOCK, "add WebView geolocation experiment", path)

        with open(path + ".bak-gpswebview", "w", encoding="utf-8") as f:
            f.write(open(path, "r", encoding="utf-8").read())

        with open(path, "w", encoding="utf-8") as f:
            f.write(src)

        print(f"  {path}: patched. Backup: {path}.bak-gpswebview")
        any_applied = True

    print("")
    if any_applied:
        print("Next steps:")
        print("   bash setup-www.sh")
        print("   npx cap sync android")
        print("   git add app.js www/app.js")
        print('   git commit -m "Experiment: try WebView navigator.geolocation for system prompt"')
        print("   git push")
        print("   bash build-android.sh")
        print("")
        print("TEST: turn phone Location off, tap GPS toggle in-app.")
        print("  - System dialog appears in-app -> experiment worked!")
        print("  - Jumps to Settings (existing fallback) -> didn't pan out on this device.")
    else:
        print("Nothing to do - already applied everywhere.")


if __name__ == "__main__":
    main()
