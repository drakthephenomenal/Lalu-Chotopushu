#!/usr/bin/env python3
"""
Force long-polling fix — upgrades experimentalAutoDetectLongPolling to
experimentalForceLongPolling at both Firestore init sites.

WHY: apply_firestore_long_polling_fix.py's auto-detect setting runs a
quick test to decide whether streaming will work before falling back.
On the kind of aggressive network-level filtering suspected for users
whose wifi syncs rarely (~1/100) while mobile data works reliably —
common with certain ISPs that filter Google API traffic specifically,
even though general browsing/calls/messaging on the same network are
unaffected — there's a real chance that DETECTION step itself silently
fails or times out, meaning affected users may never actually get the
long-polling fallback that's supposed to help them.

Forcing long-polling unconditionally skips the risky detection step
entirely. Trade-off: a small, fixed extra latency cost even on networks
where streaming would have worked fine (long-polling is slightly less
efficient than a genuine streaming connection) — but for a userbase
this affected, that fixed cost is well worth it.

USAGE (run from repo root, or from www/):
    python3 apply_force_long_polling_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-forcepoll suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "experimentalForceLongPolling"


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def find_file(name):
    for candidate in (name, os.path.join("www", name), os.path.join("..", name)):
        if os.path.isfile(candidate):
            return candidate
    die(f"Could not find {name} in the current directory, ./www, or .. — run this from your repo root or www/.")


def main():
    path = find_file(APP_JS)
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        print(f"[{path}] Already applied — nothing to do.")
        return

    old_setting = "fbDb.settings({ experimentalAutoDetectLongPolling: true });"
    new_setting = (
        "fbDb.settings({ experimentalForceLongPolling: true }); "
        "// forced, not auto-detected — see apply_force_long_polling_fix.py"
    )

    count = src.count(old_setting)
    if count != 2:
        die(
            f"Expected exactly 2 occurrences of the auto-detect long-polling setting "
            f"(startup + cache-rebuild init sites), found {count} — app.js may already "
            f"differ from what this script expects. No changes made."
        )
    src = src.replace(old_setting, new_setting)

    backup_path = path + ".bak-forcepoll"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Force long-polling fix applied to both init sites. Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
