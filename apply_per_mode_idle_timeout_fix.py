#!/usr/bin/env python3
"""
Per-mode inactivity grace period fix — tapTimer()'s auto-pause currently
uses a single idleMs value shared by KV (trahimamMode) and HK
(gaudiyaMode): 15000ms (15s), with everything else (including Ram Vijay
Mantra / ramanandiMode) falling back to the 6000ms (6s) default.

This patch gives each mode its own distinct grace period, since natural
pauses between repetitions differ by mantra:
  - KV (trahimamMode):    20 seconds
  - HK (gaudiyaMode):     25 seconds
  - Ram Vijay Mantra (ramanandiMode): 10 seconds
  - Everything else (Radha, RV, SS, 28 Names): unchanged at 6 seconds

USAGE (run from repo root, or from www/):
    python3 apply_per_mode_idle_timeout_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-idletimeout suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "per-mode idle timeout fix"


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

    old_idle = """    // HK (gaudiyaMode) and KV (trahimamMode) chanting has longer natural
    // pauses between repetitions than the default Radha Naam, so they get
    // a longer idle grace period before auto-pausing.
    const idleMs = (this.S.gaudiyaMode || this.S.trahimamMode) ? 15000 : 6000;"""

    new_idle = """    // per-mode idle timeout fix — checks japMode directly (the single
    // source of truth for what's actively being tapped) rather than the
    // exclusive Settings-toggle booleans. This matters specifically for
    // KV, which has NO exclusive toggle at all — it's only ever reached
    // via japMode === "kv" — so checking trahimamMode (which is actually
    // SS, not KV, despite its name) never covered KV. HK and Ram Vijay
    // Mantra are checked the same way for consistency, since their
    // exclusive toggles already keep japMode in sync via switchJapMode().
    const idleMs = this.S.japMode === "kv" ? 20000
      : this.S.japMode === "hk" ? 25000
      : this.S.japMode === "ram" ? 10000
      : 6000;                                    // Radha, RV, SS, 28 Names (unchanged)"""

    if src.count(old_idle) != 1:
        die(
            f"Expected exactly 1 occurrence of the idleMs ternary in tapTimer(), "
            f"found {src.count(old_idle)} — app.js may already differ from what "
            f"this script expects. No changes made."
        )
    src = src.replace(old_idle, new_idle, 1)

    backup_path = path + ".bak-idletimeout"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Per-mode idle timeout fix applied (KV 20s, HK 25s, Ram Vijay Mantra 10s). Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
