#!/usr/bin/env python3
"""
Sync-reliability patch: fixes jap silently going missing from the cloud
(discovered only after logout or switching devices).

Root cause: fbPushFull() (the write to users/{uid}/data/main) and
pushLeaderboard() could fail silently -- weak connection, the OS killing
the app right after the last tap of a session (common on aggressive
battery-optimizer OEMs like Xiaomi/Samsung), a brief Firestore hiccup --
with nothing to retry the write or tell the user. The local device always
looked correct (it reads from its own IndexedDB), so nobody noticed until
they logged out or opened the app on a new device, at which point the
cloud copy -- missing that day -- became the only copy left.

This patch adds:
  1. A "pending sync" flag persisted to IndexedDB BEFORE each write starts,
     cleared only on confirmed success -- survives the app being killed
     mid-write.
  2. Backoff retry (5s -> 10s -> 20s ... capped at 2min) for both the main
     history doc and the leaderboard doc, triggered on app foreground,
     network reconnect, and app cold-start (resuming anything left pending
     from a killed previous session).
  3. A persistent red banner (not just the easy-to-miss small pill) once a
     write has failed repeatedly, so the person actually notices and opens
     the app on wifi.
  4. Sign-out now checks the pending flag and asks for confirmation before
     wiping local data if the last write never actually landed -- this is
     what closes the real permanent-loss window, since wiping local data
     is what turns a transient sync failure into unrecoverable loss.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu or ~/Lalu-Chotopushu/www):
    python3 apply_sync_reliability_fix.py

Safe to re-run: if it detects this fix is already applied, it exits without
touching your files again.
"""
import os
import sys

REQUIRED_FILES = ["app.js", "index.html"]


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def apply_pairs(text, pairs, filename):
    for old, new in pairs:
        count = text.count(old)
        if count == 0:
            die(
                f"Could not find an expected anchor in {filename}.\n"
                "This usually means the file has changed since this patch was "
                "written, or the patch was already partially applied by hand.\n"
                "No changes have been written -- your files are untouched."
            )
        if count > 1:
            die(
                f"Found {count} matches for an anchor in {filename} (expected "
                "exactly 1) -- refusing to guess which one to patch.\n"
                "No changes have been written -- your files are untouched."
            )
        text = text.replace(old, new)
    return text


def main():
    cwd = os.getcwd()
    for fn in REQUIRED_FILES:
        if not os.path.isfile(fn):
            die(
                f"Could not find {fn} in the current directory ({cwd}).\n"
                "Run this script from the folder that contains app.js and "
                "index.html, e.g.:\n"
                "  cd ~/Lalu-Chotopushu/www\n"
                "  python3 apply_sync_reliability_fix.py"
            )

    with open("app.js", "r", encoding="utf-8") as f:
        current_app_js = f.read()
    with open("index.html", "r", encoding="utf-8") as f:
        current_index_html = f.read()

    if "syncMeta" in current_app_js and "_schedulePushRetry" in current_app_js:
        print("This fix already appears to be applied. Nothing to do.")
        sys.exit(0)

    if "_schedulePushRetry" in current_app_js or "syncMeta" in current_app_js:
        die(
            "app.js appears to be in a partially-patched state (some but not "
            "all of this fix's markers were found). Please restore app.js "
            "from a backup before re-running this script."
        )

    print("Backing up current files to *.bak-syncfix ...")
    for fn in REQUIRED_FILES:
        with open(fn, "rb") as src:
            data = src.read()
        with open(fn + ".bak-syncfix", "wb") as dst:
            dst.write(data)

    print("Applying app.js changes...")
    new_app_js = apply_pairs(current_app_js, APP_JS_PAIRS, "app.js")

    print("Applying index.html changes...")
    new_index_html = apply_pairs(current_index_html, INDEX_HTML_PAIRS, "index.html")

    with open("app.js", "w", encoding="utf-8") as f:
        f.write(new_app_js)
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(new_index_html)

    print("Done. app.js and index.html updated.")
    print("Backups saved as app.js.bak-syncfix and index.html.bak-syncfix")
    print()
    print("Next: run 'node --check app.js' to confirm it's syntactically valid,")
    print("then rebuild/redeploy as usual.")


APP_JS_PAIRS = [
    (
        '    });\n\n    // ── When the device comes back online, push any local changes\n    //    accumulated while offline. Firestore persistence also replays its\n',
        '    });\n\n    // ── Push retry (separate from the hydration retry above) ────────────\n    // Hydration retry handles "never pulled cloud data yet". This handles\n    // the different, more common case: hydration succeeded, but a LATER\n    // fbPushFull()/pushLeaderboard() write failed (weak connection, OS\n    // killed the app mid-write, brief Firestore hiccup) and was never\n    // retried — this was the actual cause of jap silently going missing\n    // from the cloud, only discovered on logout or a new device.\n    App._pushRetryAttempts = 0;\n    App._pushRetryTimer = null;\n    App._pushFailBannerShown = false;\n\n    window._clearPushRetry = function () {\n      if (App._pushRetryTimer) {\n        clearTimeout(App._pushRetryTimer);\n        App._pushRetryTimer = null;\n      }\n      App._pushRetryAttempts = 0;\n      if (typeof window._hideSyncFailBanner === "function") window._hideSyncFailBanner();\n    };\n\n    window._schedulePushRetry = function () {\n      if (!fbUser || fbForcedSignout) return;\n      if (typeof isGhostMode === "function" && isGhostMode()) return; // never fight ghost mode\n      if (App._pushRetryTimer) return; // already scheduled\n      if (typeof navigator !== "undefined" && navigator.onLine === false) return; // wait for \'online\' instead\n\n      App._pushRetryAttempts++;\n      const delayMs = Math.min(120000, 5000 * Math.pow(2, App._pushRetryAttempts - 1));\n\n      // After several straight failures, make it impossible to miss —\n      // a persistent banner instead of the small pill most people never\n      // notice — so the person actually opens the app on wifi instead of\n      // the gap staying invisible for months.\n      if (App._pushRetryAttempts >= 4 && !App._pushFailBannerShown) {\n        App._pushFailBannerShown = true;\n        if (typeof window._showSyncFailBanner === "function") window._showSyncFailBanner();\n      }\n\n      App._pushRetryTimer = setTimeout(async () => {\n        App._pushRetryTimer = null;\n        try {\n          await fbPushFull();\n          await pushLeaderboard();\n        } catch (e) {\n          console.warn("Push retry failed:", e && e.message);\n        }\n        // Re-check the persisted flag rather than trusting the try above —\n        // fbPushFull() itself is the only thing that clears it, and only\n        // on confirmed success.\n        let stillPending = false;\n        try {\n          const meta = await App.dbGet("state", (App._uid || "guest") + ":syncMeta");\n          stillPending = !!(meta && meta.pending);\n        } catch (_) {}\n        if (stillPending) window._schedulePushRetry();\n      }, delayMs);\n    };\n\n    window._showSyncFailBanner = function () {\n      const b = document.getElementById("fbSyncFailBanner");\n      if (b) b.style.display = "block";\n      toast("⚠️ Some jap isn\'t backed up to the cloud yet — keep the app open on wifi for a moment");\n    };\n    window._hideSyncFailBanner = function () {\n      App._pushFailBannerShown = false;\n      const b = document.getElementById("fbSyncFailBanner");\n      if (b) b.style.display = "none";\n    };\n\n    // ── When the device comes back online, push any local changes\n    //    accumulated while offline. Firestore persistence also replays its\n',
    ),
    (
        '      console.warn("Push before sign-out failed:", e && e.message);\n    }\n  }\n  // Stop sync listeners so cloud changes cannot resurrect local state mid-wipe.\n',
        '      console.warn("Push before sign-out failed:", e && e.message);\n    }\n    // ── Verify the write actually landed before wiping local data ──────\n    // Don\'t just trust that the try block above didn\'t throw — fbPushFull()\n    // can fail for reasons unrelated to this exact call. Check the\n    // persisted pending flag instead, which is only cleared on confirmed\n    // success. This is what closes the real data-loss window: signing out\n    // used to wipe local IndexedDB unconditionally, which is harmless if\n    // the last write succeeded but permanently destroys the only surviving\n    // copy of that day\'s jap if it didn\'t.\n    let stillPending = false;\n    try {\n      const meta = await App.dbGet("state", (App._uid || "guest") + ":syncMeta");\n      stillPending = !!(meta && meta.pending);\n    } catch (_) {}\n    if (stillPending) {\n      const proceed = confirm(\n        "Some of your jap isn\'t backed up to the cloud yet (likely a weak " +\n        "connection). If you sign out now, that unsynced jap could be lost " +\n        "permanently. Sign out anyway?"\n      );\n      if (!proceed) {\n        setSyncPill("error", "Not synced — sign-out cancelled");\n        toast("Sign-out cancelled — try again once you\'re on a better connection 🙏");\n        return;\n      }\n    }\n  }\n  // Stop sync listeners so cloud changes cannot resurrect local state mid-wipe.\n',
    ),
    (
        '  }\n  setSyncPill("syncing", "Syncing…");\n  const payload = {\n    history: App.S.history || {},\n',
        '  }\n  setSyncPill("syncing", "Syncing…");\n  // ── Persist a "pending sync" flag BEFORE attempting the write ──────────\n  // This is the fix for the "app killed mid-write" data-loss case: if the\n  // OS kills the process the instant after this write starts (the common\n  // trigger on aggressive battery-optimizer OEMs), this flag survives the\n  // kill in IndexedDB even though everything in memory does not. The next\n  // app open can then see "last write was never confirmed" and retry —\n  // instead of silently assuming success, which is what let jap go\n  // missing from the cloud without anyone noticing until logout/device\n  // change exposed the gap.\n  try {\n    await App.dbPut("state", (App._uid || "guest") + ":syncMeta", {\n      pending: true,\n      ts: Date.now(),\n    });\n  } catch (_) {}\n  const payload = {\n    history: App.S.history || {},\n',
    ),
    (
        '      .doc("main")\n      .set(payload);\n    // Stage a plain-JSON copy (minus the serverTimestamp sentinel, which\n    // can\'t be serialized) for the native Background Runner. This is the\n',
        '      .doc("main")\n      .set(payload);\n    // Main doc write CONFIRMED — clear the pending flag and reset any\n    // backoff retry loop that was chasing this write.\n    try {\n      await App.dbPut("state", (App._uid || "guest") + ":syncMeta", {\n        pending: false,\n        ts: Date.now(),\n      });\n    } catch (_) {}\n    if (typeof window._clearPushRetry === "function") window._clearPushRetry();\n    // Stage a plain-JSON copy (minus the serverTimestamp sentinel, which\n    // can\'t be serialized) for the native Background Runner. This is the\n',
    ),
    (
        "    }\n    // ── Push leaderboard entry if opted in ──\n    pushLeaderboard().catch((e) => console.warn('pushLeaderboard (post-tap) error:', e && e.message));\n    App.S.syncBaseline = JSON.parse(JSON.stringify(App.S.history || {}));\n    App.S.syncBaseline28 = JSON.parse(JSON.stringify(App.S.h28 || {}));\n",
        '    }\n    // ── Push leaderboard entry if opted in ──\n    pushLeaderboard().catch((e) => {\n      console.warn(\'pushLeaderboard (post-tap) error:\', e && e.message);\n      if (typeof window._schedulePushRetry === "function") window._schedulePushRetry();\n    });\n    App.S.syncBaseline = JSON.parse(JSON.stringify(App.S.history || {}));\n    App.S.syncBaseline28 = JSON.parse(JSON.stringify(App.S.h28 || {}));\n',
    ),
    (
        '    console.warn("Full sync failed:", e.message);\n    setSyncPill("error", "Sync failed");\n  }\n}\n',
        '    console.warn("Full sync failed:", e.message);\n    setSyncPill("error", "Sync failed");\n    // Pending flag is intentionally left "true" here (it was already set\n    // above before the write attempt) — schedule a backoff retry so this\n    // day\'s jap gets another chance instead of being silently stranded.\n    if (typeof window._schedulePushRetry === "function") window._schedulePushRetry();\n  }\n}\n',
    ),
    (
        '  await fbMigrate();\n  if (typeof window._markHydrationRecovered === "function") window._markHydrationRecovered();\n  // ── Then set up the real-time listener for subsequent changes ──\n  try {\n',
        '  await fbMigrate();\n  if (typeof window._markHydrationRecovered === "function") window._markHydrationRecovered();\n  // ── Resume any write that never got confirmed last session ───────────\n  // If the app/OS was killed mid-write last time, this flag survived the\n  // restart in IndexedDB even though in-memory state did not. Catch it\n  // here instead of silently trusting the (possibly stale) cloud copy\n  // fbMigrate() just pulled.\n  try {\n    const meta = await App.dbGet("state", (App._uid || "guest") + ":syncMeta");\n    if (meta && meta.pending && typeof window._schedulePushRetry === "function") {\n      window._schedulePushRetry();\n    }\n  } catch (_) {}\n  // ── Then set up the real-time listener for subsequent changes ──\n  try {\n',
    ),
    (
        "  } catch(e) {\n    console.warn('pushLeaderboard error:', e.message);\n  }\n}\n",
        '  } catch(e) {\n    console.warn(\'pushLeaderboard error:\', e.message);\n    if (typeof window._schedulePushRetry === "function") window._schedulePushRetry();\n  }\n}\n',
    ),
]

INDEX_HTML_PAIRS = [
    (
        '        <span class="sync-pill" id="syncPill"><span class="sync-dot"></span><span id="syncPillText">Ready</span></span>\n      </div>\n      <button id="fbChangePassBtn" onclick="fbChangePasswordFromSettings()" class="premium-btn" style="margin-bottom:10px">🔑 Change Password</button>\n      <button onclick="fbSignOut()" class="premium-btn red">Sign Out</button>\n',
        '        <span class="sync-pill" id="syncPill"><span class="sync-dot"></span><span id="syncPillText">Ready</span></span>\n      </div>\n      <div id="fbSyncFailBanner" style="display:none;margin-bottom:12px;padding:10px 12px;border-radius:10px;background:rgba(255,90,90,0.08);border:1px solid rgba(255,90,90,0.3);font-size:11.5px;color:#ff8a8a;line-height:1.5;text-align:center">\n        ⚠️ Some jap isn\'t backed up to the cloud yet. Keep this app open on wifi for a minute to finish — please don\'t sign out or switch devices until it\'s done.\n      </div>\n      <button id="fbChangePassBtn" onclick="fbChangePasswordFromSettings()" class="premium-btn" style="margin-bottom:10px">🔑 Change Password</button>\n      <button onclick="fbSignOut()" class="premium-btn red">Sign Out</button>\n',
    ),
]

if __name__ == "__main__":
    main()
