#!/usr/bin/env python3
"""
Extends the 2G/poor-connection sync retry ladder (from
apply_2g_sync_retry_fix.py) to give slow-but-alive connections more total
time to complete before handing off to the background retry system.

REQUIRES apply_2g_sync_retry_fix.py to have already been applied — this
script only edits the numbers inside _fbSyncLadderForConnection(), it
does not add that function.

NEW DURATIONS:
  2G / slow-2g       : 20s -> 35s -> 60s -> 90s  (waits: 3s, 5s, 8s)
                        worst case foreground wait: ~221s (~3.7 min)
  3G / unknown / iOS : 25s -> 45s -> 70s          (waits: 3s, 5s)
                        worst case foreground wait: ~148s (~2.5 min)
  4G / fast          : 25s (single attempt, up from 20s)

CAVEAT (unchanged from the original fix): this only helps a connection
that is slow but still alive and the app stays in the foreground. If the
app is backgrounded/closed mid-sync, the OS can suspend JS execution
before this ladder finishes — that gap is covered by the existing
Background Runner, not by lengthening these numbers.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_2g_sync_retry_extend.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js -> app.js.bak-2gsyncfix-extend first.

After running:
    bash setup-www.sh
    npx cap sync android
"""
import os
import sys

APP_JS = "app.js"


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


def main():
    cwd = os.getcwd()
    if not os.path.isfile(APP_JS):
        die(
            f"Could not find {APP_JS} in the current directory ({cwd}).\n"
            "Run this script from your repo root, e.g.:\n"
            "  cd ~/Lalu-Chotopushu\n"
            "  python3 apply_2g_sync_retry_extend.py"
        )

    with open(APP_JS, "r", encoding="utf-8") as f:
        app_src = f.read()

    if "_fbSyncLadderForConnection" not in app_src:
        die(
            "Could not find _fbSyncLadderForConnection() in app.js.\n"
            "This means apply_2g_sync_retry_fix.py has not been applied yet "
            "(or applied to a different file) — run that first."
        )

    if "[20000, 35000, 60000, 90000]" in app_src:
        print("This extended duration fix already appears to be applied. Nothing to do.")
        sys.exit(0)

    old1 = '''  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return { attempts: [15000, 25000, 40000], waits: [3000, 5000] };
  }
  if (effectiveType === "4g") {
    return { attempts: [20000], waits: [] };
  }
  // "3g", unknown effectiveType, or no navigator.connection support (iOS).
  return { attempts: [20000, 35000], waits: [3000] };'''

    new1 = '''  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return { attempts: [20000, 35000, 60000, 90000], waits: [3000, 5000, 8000] };
  }
  if (effectiveType === "4g") {
    return { attempts: [25000], waits: [] };
  }
  // "3g", unknown effectiveType, or no navigator.connection support (iOS).
  return { attempts: [25000, 45000, 70000], waits: [3000, 5000] };'''

    app_src = apply_edit(app_src, old1, new1, "extend retry ladder durations", APP_JS)

    with open(APP_JS + ".bak-2gsyncfix-extend", "w", encoding="utf-8") as f:
        pass
    with open(APP_JS, "r", encoding="utf-8") as f:
        pass  # (original already captured before mutation above via app_src copy)

    # Write backup of the pre-edit content (re-derive by reading original file
    # from disk, since we haven't written app_src back yet).
    with open(APP_JS, "r", encoding="utf-8") as f:
        original = f.read()
    with open(APP_JS + ".bak-2gsyncfix-extend", "w", encoding="utf-8") as f:
        f.write(original)

    with open(APP_JS, "w", encoding="utf-8") as f:
        f.write(app_src)

    print("✅ Extended the 2G/poor-connection sync retry ladder durations in " + APP_JS)
    print("   Backup saved to " + APP_JS + ".bak-2gsyncfix-extend")
    print("")
    print("New worst-case foreground wait:")
    print("   2G/slow-2g       : ~221s (~3.7 min)")
    print("   3G/unknown/iOS   : ~148s (~2.5 min)")
    print("   4G               : 25s (single attempt)")
    print("")
    print("Next steps:")
    print("   bash setup-www.sh")
    print("   npx cap sync android")


if __name__ == "__main__":
    main()
