#!/usr/bin/env python3
"""
Firestore long-polling fix — adds experimentalAutoDetectLongPolling to
BOTH places Firestore gets initialized (the normal startup path in
fbInit, and the cache-rebuild path in window._fbRecoverPersistence).

WHY: Firestore's SDK defaults to a streaming connection (WebChannel over
HTTP/2) to talk to the server. That protocol is known to behave poorly
inside Android WebViews (which is what this Capacitor app runs in) — the
underlying WebView network stack often can't sustain it cleanly. The
typical symptom is exactly what's been reported: the FIRST read/write on
a session stalls or times out, and only a retry (which may negotiate the
connection differently) goes through — regardless of connection quality,
because it's a WebView protocol-support issue, not a bandwidth issue.
This affects ALL users on the platform, not just ones on bad networks —
which matches what's being seen.

experimentalAutoDetectLongPolling tells the SDK to detect when streaming
won't work well and transparently fall back to plain HTTP long-polling,
which WebViews handle far more reliably. This is Firestore's own
documented mitigation for exactly this class of environment (WebViews,
restrictive proxies, older network stacks). It's a connection-negotiation
setting only — it does not change any retry timing, payload, or data
behavior already in place from the sync diagnostics / leaderboard retry
patches, and is safe to combine with both.

MUST run before any other Firestore call on a given fbDb instance
(settings() has to be the very first thing called after
firebase.firestore()), so it's inserted immediately before each existing
enablePersistence() call, which is already first in both places.

USAGE (run from repo root, or from www/):
    python3 apply_firestore_long_polling_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-longpoll suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "experimentalAutoDetectLongPolling"


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

    # ── Site 1: normal startup path (fbInit) — 4-space indent ──
    old_init_1 = """    fbDb = firebase.firestore();
    fbDb.enablePersistence({ synchronizeTabs: false }).catch(() => {});"""

    new_init_1 = """    fbDb = firebase.firestore();
    // Firestore's default streaming connection (WebChannel) is unreliable
    // inside Android WebViews — this detects that and falls back to plain
    // HTTP long-polling automatically. Must be the first call on fbDb.
    fbDb.settings({ experimentalAutoDetectLongPolling: true });
    fbDb.enablePersistence({ synchronizeTabs: false }).catch(() => {});"""

    # ── Site 2: cache-rebuild path (_fbRecoverPersistence) — 8-space indent ──
    old_init_2 = """        fbDb = firebase.firestore();
        fbDb.enablePersistence({ synchronizeTabs: false }).catch(() => {});"""

    new_init_2 = """        fbDb = firebase.firestore();
        // Same long-polling fallback as the main init above — a rebuilt
        // fbDb instance needs it too, or a recovered cache would still hit
        // the same WebView streaming problem this whole recovery exists to
        // work around.
        fbDb.settings({ experimentalAutoDetectLongPolling: true });
        fbDb.enablePersistence({ synchronizeTabs: false }).catch(() => {});"""

    if src.count(old_init_1) != 1:
        die(
            f"Expected exactly 1 occurrence of the startup-path Firestore init "
            f"(4-space indent), found {src.count(old_init_1)} — app.js may already "
            f"differ from what this script expects. No changes made."
        )
    if src.count(old_init_2) != 1:
        die(
            f"Expected exactly 1 occurrence of the cache-rebuild-path Firestore init "
            f"(8-space indent), found {src.count(old_init_2)} — app.js may already "
            f"differ from what this script expects. No changes made."
        )

    src = src.replace(old_init_1, new_init_1, 1)
    src = src.replace(old_init_2, new_init_2, 1)

    backup_path = path + ".bak-longpoll"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Firestore long-polling fix applied to both init sites. Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
