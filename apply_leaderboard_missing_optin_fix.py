#!/usr/bin/env python3
"""
Leaderboard Cloud Function fix — missing lbOptIn should NOT delete
the leaderboard entry.

WHY: syncLeaderboardOnMainDataWrite currently treats `!data.lbOptIn`
(false OR missing/undefined) as "opted out — delete the leaderboard
entry." This is too aggressive: a developer-restored backup (via Ghost
Mode) can easily be missing the lbOptIn field entirely — e.g. an old
export taken before that field existed, or a fullReplace restore that
doesn't happen to include it — which then gets silently read as an
explicit opt-out and deletes the user's leaderboard entry, even though
they never actually opted out. Confirmed to have happened live: a
restored user's leaderboard entry (and Ghost Mode listing, which
partially sources from the leaderboard collection) both disappeared
after a Ghost Mode restore, purely because the restored backup lacked
this field.

FIX: only delete the leaderboard entry when lbOptIn is EXPLICITLY
false. A missing/undefined field is now treated as "unknown — leave
whatever leaderboard entry already exists alone" instead of "opted
out." Someone who genuinely opts out (lbOptIn explicitly set to false
by their own toggle) is unaffected — their entry still gets removed
exactly as before.

This is a SERVER-SIDE fix — no client app version dependency. It takes
effect for every user's writes immediately upon redeploy, regardless
of what app version they're running.

USAGE (run from wherever functions/index.js lives, e.g. repo root):
    python3 apply_leaderboard_missing_optin_fix.py
Then redeploy:
    firebase deploy --only functions:syncLeaderboardOnMainDataWrite

Safe to re-run: detects if already applied and exits without touching
files again. Backs up functions/index.js with a .bak-optinfix suffix.
"""
import os
import sys

TARGET = "functions/index.js"
MARKER = "missing lbOptIn treated as unknown, not opted-out"


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def find_file():
    for candidate in (TARGET, os.path.join("..", TARGET), "index.js"):
        if os.path.isfile(candidate):
            return candidate
    die(f"Could not find {TARGET} (or index.js) in the current directory or .. — run this from your repo root (where the functions/ folder lives).")


def main():
    path = find_file()
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        print(f"[{path}] Already applied — nothing to do.")
        return

    old_check = """    // Mirrors the client: opted out (or never opted in) → no leaderboard entry.
    if (!data.lbOptIn) {
      await db.collection("leaderboard").doc(uid).delete().catch(() => {});
      return null;
    }"""

    new_check = """    // missing lbOptIn treated as unknown, not opted-out — only an EXPLICIT
    // lbOptIn === false deletes the leaderboard entry. A missing/undefined
    // field (e.g. an older backup restored via Ghost Mode that predates
    // this field) used to be silently treated as an opt-out and delete
    // the user's entry even though they never actually opted out.
    if (data.lbOptIn === false) {
      await db.collection("leaderboard").doc(uid).delete().catch(() => {});
      return null;
    }
    // If lbOptIn is missing/undefined entirely and no leaderboard entry
    // exists yet, there's nothing meaningful to compute — skip silently
    // rather than creating an entry for someone who never opted in.
    if (!data.lbOptIn) {
      const existing = await db.collection("leaderboard").doc(uid).get();
      if (!existing.exists) return null;
    }"""

    # Also handles the alternate wording used in the v1-style (functions/admin
    # classic SDK) version appended to an existing functions/index.js, if that
    # variant is what's actually deployed instead of the v2 modular one.
    old_check_v1 = """    if (!data.lbOptIn) {
      await admin.firestore().collection("leaderboard").doc(uid).delete().catch(() => {});
      return null;
    }"""

    new_check_v1 = """    // missing lbOptIn treated as unknown, not opted-out — only an EXPLICIT
    // lbOptIn === false deletes the leaderboard entry. A missing/undefined
    // field (e.g. an older backup restored via Ghost Mode that predates
    // this field) used to be silently treated as an opt-out and delete
    // the user's entry even though they never actually opted out.
    if (data.lbOptIn === false) {
      await admin.firestore().collection("leaderboard").doc(uid).delete().catch(() => {});
      return null;
    }
    // If lbOptIn is missing/undefined entirely and no leaderboard entry
    // exists yet, there's nothing meaningful to compute — skip silently
    // rather than creating an entry for someone who never opted in.
    if (!data.lbOptIn) {
      const existing = await admin.firestore().collection("leaderboard").doc(uid).get();
      if (!existing.exists) return null;
    }"""

    count_v2 = src.count(old_check)
    count_v1 = src.count(old_check_v1)

    if count_v2 == 1:
        src = src.replace(old_check, new_check, 1)
    elif count_v1 == 1:
        src = src.replace(old_check_v1, new_check_v1, 1)
    else:
        die(
            f"Could not find the lbOptIn delete check in either expected form "
            f"(v2 modular: {count_v2} matches, v1 classic: {count_v1} matches) — "
            f"the deployed function's source may already differ from what this "
            f"script expects. No changes made."
        )

    backup_path = path + ".bak-optinfix"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] lbOptIn fix applied. Backup saved to {backup_path}")
    print("Now redeploy: firebase deploy --only functions:syncLeaderboardOnMainDataWrite")


if __name__ == "__main__":
    main()
