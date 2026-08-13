#!/usr/bin/env python3
"""
Sync ladder timing fix v3 — further increases per-attempt timeouts across
every connection tier in the Firestore cloud-push retry ladder
(_fbSyncLadderForConnection in app.js). Retry COUNTS are unchanged from v2
(5 tries on 2G/poor-wifi, 4 on 3G/unknown/iOS, 3 on 4G) — this just gives
each attempt more time before it's counted as timed out.

CHANGES (app.js, _fbSyncLadderForConnection):
  2G/slow-2G/poor-wifi : 30s→55s→90s→130s→180s   -> 45s→80s→120s→170s→220s
                          waits 5s/8s/12s/15s      -> 8s/12s/15s/20s
  3G/unknown/iOS        : 35s→60s→100s→150s        -> 50s→85s→130s→180s
                          waits 5s/8s/12s           -> 8s/12s/15s
  4G                    : 20s→40s→70s               -> 30s→55s→90s
                          waits 3s/5s                -> 5s/8s

  Worst-case total time before giving up: ~3.2min (4G), ~8.6min (3G),
  ~13.5min (2G/poor wifi). This runs as a background push (updates a sync
  status pill, does not block the UI) — a longer worst case trades a
  slower "give up" for a better chance of eventually landing the write on
  a genuinely bad connection.

USAGE (run from your repo root, or from www/):
    python3 apply_sync_ladder_timing_fix_v3.py

Works whether v1 (apply_sync_ladder_timing_fix.py), v2
(apply_sync_ladder_timing_fix_v2.py), or neither has been applied yet —
detects all three possible starting states.

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-syncladdertimingfixv3 suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "attempts: [30000, 55000, 90000], waits: [5000, 8000] };"


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

    old_original = '''  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return { attempts: [20000, 35000, 60000, 90000], waits: [3000, 5000, 8000] };
  }
  if (effectiveType === "4g") {
    return { attempts: [25000], waits: [] };
  }
  // "3g", unknown effectiveType, or no navigator.connection support (iOS).
  return { attempts: [25000, 45000, 70000], waits: [3000, 5000] };'''

    old_v1 = '''  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return { attempts: [30000, 55000, 90000, 130000], waits: [5000, 8000, 12000] };
  }
  if (effectiveType === "4g") {
    // Previously a single 25s attempt with no retry, on the assumption that
    // a fast connection wouldn't need one. That assumption doesn't hold —
    // a transient blip (tower handoff, brief backend hiccup) can fail a 4G
    // request just as easily as a slow one, and a fast connection is *more*
    // likely to succeed on a quick retry, not less. Now gets one retry.
    return { attempts: [20000, 40000], waits: [3000] };
  }
  // "3g", unknown effectiveType, or no navigator.connection support (iOS).
  return { attempts: [35000, 60000, 100000], waits: [5000, 8000] };'''

    old_v2 = '''  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    // Also covers congested/poor wifi — effectiveType measures actual
    // round-trip time and throughput, not radio type, so a bad wifi
    // connection lands here too, not just real 2G.
    return { attempts: [30000, 55000, 90000, 130000, 180000], waits: [5000, 8000, 12000, 15000] };
  }
  if (effectiveType === "4g") {
    // A fast connection can still hit a transient blip (tower handoff,
    // brief backend hiccup) — it's actually MORE likely to succeed on a
    // quick retry than a slow one, not less, so it gets multiple tries too.
    return { attempts: [20000, 40000, 70000], waits: [3000, 5000] };
  }
  // "3g", unknown effectiveType, or no navigator.connection support (iOS).
  return { attempts: [35000, 60000, 100000, 150000], waits: [5000, 8000, 12000] };'''

    new = '''  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    // Also covers congested/poor wifi — effectiveType measures actual
    // round-trip time and throughput, not radio type, so a bad wifi
    // connection lands here too, not just real 2G.
    return { attempts: [45000, 80000, 120000, 170000, 220000], waits: [8000, 12000, 15000, 20000] };
  }
  if (effectiveType === "4g") {
    // A fast connection can still hit a transient blip (tower handoff,
    // brief backend hiccup) — it's actually MORE likely to succeed on a
    // quick retry than a slow one, not less, so it gets multiple tries too.
    return { attempts: [30000, 55000, 90000], waits: [5000, 8000] };
  }
  // "3g", unknown effectiveType, or no navigator.connection support (iOS).
  return { attempts: [50000, 85000, 130000, 180000], waits: [8000, 12000, 15000] };'''

    if old_original in src:
        old = old_original
    elif old_v1 in src:
        old = old_v1
    elif old_v2 in src:
        old = old_v2
    else:
        die(
            f"[{path}] Anchor for '_fbSyncLadderForConnection body' not found. "
            "app.js may differ from what this patch expects — aborting without "
            "changing anything."
        )

    count = src.count(old)
    if count > 1:
        die(f"[{path}] Anchor appears {count} times (expected exactly 1) — aborting.")

    with open(path + ".bak-syncladdertimingfixv3", "w", encoding="utf-8") as f:
        f.write(src)
    print(f"Backed up {path} -> {path}.bak-syncladdertimingfixv3")

    src = src.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"[{path}] Patched: per-attempt timeouts increased across all tiers.")


if __name__ == "__main__":
    main()
