#!/usr/bin/env python3
"""
Ghost mode list — add presence as a third source, independent of
Community Board opt-in.

WHY: _fetchAllKnownUsers() only pulls from two collections: feedbacks
(only users who've submitted feedback) and leaderboard (only users
currently opted into Community Board). A user who has never submitted
feedback AND has opted out of (or never opted into) Community Board is
completely invisible to Ghost Mode — even though Ghost Mode is a
developer support tool, not a public listing, and should be able to
find any real user regardless of their leaderboard preference.
Confirmed live: turning off Community Board also removes a user from
Ghost Mode's list, for exactly this reason.

FIX: add the `presence` collection as a third source. It's written by
every signed-in user's heartbeat (independent of Community Board
opt-in entirely), so it naturally covers users who've opted out —
as long as their device has completed at least one successful sync.
(Note: a user whose sync is fully broken — no successful writes of
any kind — won't appear via presence either, since presence writes
require the same working connection. This fix solves the "opted out"
case specifically, not a fully broken sync case.)

USAGE (run from repo root, or from www/):
    python3 apply_ghost_list_presence_source_fix.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-ghostlist suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "presence collection as third ghost-list source"


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

    old_block = """  try {
    // 2. leaderboard collection — uid-keyed, has displayName + totalJap
    const lbSnap = await fbDb.collection('leaderboard').get();
    lbSnap.forEach(doc => {
      const d = doc.data();
      add(doc.id, {
        name:  byUid[doc.id]?.name  || d.displayName || '',
        email: byUid[doc.id]?.email || d.email       || '',
        jap:   d.totalJap || 0,
        source: byUid[doc.id] ? byUid[doc.id].source : 'leaderboard',
      });
    });
  } catch (_) {}

  // Sort: users with names first, then by name alpha"""

    new_block = """  try {
    // 2. leaderboard collection — uid-keyed, has displayName + totalJap
    const lbSnap = await fbDb.collection('leaderboard').get();
    lbSnap.forEach(doc => {
      const d = doc.data();
      add(doc.id, {
        name:  byUid[doc.id]?.name  || d.displayName || '',
        email: byUid[doc.id]?.email || d.email       || '',
        jap:   d.totalJap || 0,
        source: byUid[doc.id] ? byUid[doc.id].source : 'leaderboard',
      });
    });
  } catch (_) {}

  try {
    // 3. presence collection as third ghost-list source — written by every
    // signed-in user's heartbeat, INDEPENDENT of Community Board opt-in.
    // Fixes users who've opted out of the leaderboard (or never opted in)
    // and never submitted feedback becoming completely invisible to Ghost
    // Mode, which is a support tool and should find any real user.
    const presSnap = await fbDb.collection('presence').get();
    presSnap.forEach(doc => {
      const d = doc.data();
      add(doc.id, {
        name:  byUid[doc.id]?.name  || d.name  || '',
        email: byUid[doc.id]?.email || d.email || '',
        phone: byUid[doc.id]?.phone || d.phone || '',
        source: byUid[doc.id] ? byUid[doc.id].source : 'presence',
      });
    });
  } catch (_) {}

  // Sort: users with names first, then by name alpha"""

    if src.count(old_block) != 1:
        die(
            f"Expected exactly 1 occurrence of the _fetchAllKnownUsers leaderboard "
            f"block, found {src.count(old_block)} — app.js may already differ from "
            f"what this script expects. No changes made."
        )
    src = src.replace(old_block, new_block, 1)

    backup_path = path + ".bak-ghostlist"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Ghost list presence-source fix applied. Backup saved to {backup_path}")


if __name__ == "__main__":
    main()
