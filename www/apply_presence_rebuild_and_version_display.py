#!/usr/bin/env python3
"""
Presence heartbeat rebuild + per-user version/last-synced in ghost list.

WHY: the presence heartbeat WRITE (the thing responsible for the green
"online" dot, and now also the third ghost-list source added earlier
today) does not exist anywhere in this codebase — only the READ does.
This means the green dot feature has been non-functional going
forward; the presence docs visible in Firestore are leftover from
before, not actively maintained. This patch rebuilds it as a simple,
best-effort write (matching this codebase's current no-retry-ladder
philosophy — no fbCloudPushWithRetryLadder dependency, since that
infrastructure was intentionally removed).

While rebuilding it, this also stamps the actual RUNNING app version
(read at runtime via the already-installed @capacitor/app plugin's
getInfo(), NOT hardcoded — hardcoding would drift out of sync with
build-android.sh's auto-bumped versionCode/versionName immediately)
into the same write, plus reuses the existing lastSeen timestamp as
"last synced". Both flow into the ghost mode list's existing presence
source, so the developer can see each user's real running version and
last-active time directly in the picker — the "per-user version +
last-synced timestamp" feature requested.

USAGE (run from repo root, or from www/):
    python3 apply_presence_rebuild_and_version_display.py

Safe to re-run: detects if already applied and exits without touching
files again. Backs up app.js with a .bak-presencev2 suffix first.
"""
import os
import sys

APP_JS = "app.js"
MARKER = "presence heartbeat rebuild + version stamp"


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

    # ── 1. App version reader — cached once, read via Capacitor App plugin
    # at runtime rather than hardcoded, so it always matches the actual
    # running build regardless of build-android.sh's auto-bumped version. ──
    old_channel_const = 'const RJAP_NOTIF_CHANNEL_ID = "rjap_reminders_v2";'

    new_channel_const = '''const RJAP_NOTIF_CHANNEL_ID = "rjap_reminders_v2";

// presence heartbeat rebuild + version stamp — cached once per session.
// Read at runtime via @capacitor/app (already installed) rather than
// hardcoded, so it always reflects the actual running build instead of
// drifting out of sync with build-android.sh's auto-bumped version.
let _rjapAppVersion = "web";
async function _rjapDetectAppVersion() {
  try {
    if (_lcIsNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      const info = await window.Capacitor.Plugins.App.getInfo();
      _rjapAppVersion = (info && info.version) ? "1.0." + (info.build || info.version) : "native";
    }
  } catch (e) {}
}

async function _writePresenceHeartbeat(user) {
  if (!user || !fbDb) return;
  try {
    await fbDb.collection("presence").doc(user.uid).set({
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      phone: user.phoneNumber || "",
      appVersion: _rjapAppVersion,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn("Presence heartbeat failed:", e && e.message ? e.message : e);
  }
}'''

    if src.count(old_channel_const) != 1:
        die(
            f"Expected exactly 1 occurrence of the RJAP_NOTIF_CHANNEL_ID constant, "
            f"found {src.count(old_channel_const)} — app.js may already differ from "
            f"what this script expects. No changes made."
        )
    src = src.replace(old_channel_const, new_channel_const, 1)

    # ── 2. Call the heartbeat (and detect version once) right after login's fbAutoSync() ──
    old_hook = """          // Direct cloud pull — overwrites local cache with authoritative Firebase data
          await fbAutoSync();
          // Merge in any permanent-ledger gifts recorded on other devices.
          pullPermanentGiftLedger();"""

    new_hook = """          // Direct cloud pull — overwrites local cache with authoritative Firebase data
          await fbAutoSync();
          // presence heartbeat rebuild + version stamp — fires on every
          // login/refresh, independent of Community Board opt-in, so the
          // developer can see who's active (and on what version) in Ghost
          // Mode even for users who've opted out of the leaderboard.
          await _rjapDetectAppVersion();
          _writePresenceHeartbeat(user);
          // Merge in any permanent-ledger gifts recorded on other devices.
          pullPermanentGiftLedger();"""

    if src.count(old_hook) != 1:
        die(
            f"Expected exactly 1 occurrence of the post-fbAutoSync login hook, "
            f"found {src.count(old_hook)} — app.js may already differ from what "
            f"this script expects. No changes made (version reader + heartbeat "
            f"function above were still added)."
        )
    src = src.replace(old_hook, new_hook, 1)

    # ── 3. Ghost list: capture appVersion + lastSeen from the presence source ──
    old_presence_read = """    const presSnap = await fbDb.collection('presence').get();
    presSnap.forEach(doc => {
      const d = doc.data();
      add(doc.id, {
        name:  byUid[doc.id]?.name  || d.name  || '',
        email: byUid[doc.id]?.email || d.email || '',
        phone: byUid[doc.id]?.phone || d.phone || '',
        source: byUid[doc.id] ? byUid[doc.id].source : 'presence',
      });
    });"""

    new_presence_read = """    const presSnap = await fbDb.collection('presence').get();
    presSnap.forEach(doc => {
      const d = doc.data();
      add(doc.id, {
        name:  byUid[doc.id]?.name  || d.name  || '',
        email: byUid[doc.id]?.email || d.email || '',
        phone: byUid[doc.id]?.phone || d.phone || '',
        appVersion: d.appVersion || '',
        lastSeen: d.lastSeen || null,
        source: byUid[doc.id] ? byUid[doc.id].source : 'presence',
      });
    });"""

    if src.count(old_presence_read) != 1:
        die(
            f"Expected exactly 1 occurrence of the ghost-list presence read block, "
            f"found {src.count(old_presence_read)} — app.js may already differ from "
            f"what this script expects. No changes made to the ghost list display "
            f"(heartbeat rebuild above was still applied)."
        )
    src = src.replace(old_presence_read, new_presence_read, 1)

    # ── 4. Ghost list rendering: actually display appVersion + lastSeen per row ──
    old_render = """    const label   = u.name  || u.email || '(no name)';
    const sublabel = u.email && u.name ? u.email : (u.phone || '');
    const japStr  = u.jap ? ' · ' + _lbFmtJap(u.jap) + ' jap' : '';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,215,0,0.18);background:rgba(255,215,0,0.03);cursor:pointer;transition:background 0.15s;';
    row.onmouseenter = () => { row.style.background = 'rgba(255,215,0,0.09)'; };
    row.onmouseleave = () => { row.style.background = 'rgba(255,215,0,0.03)'; };
    row.innerHTML = `
      <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,215,0,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">👤</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#FFD700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escHtmlG(label)}${japStr}</div>
        ${sublabel ? `<div style="font-size:11px;color:rgba(255,255,255,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escHtmlG(sublabel)}</div>` : ''}
        <div style="font-size:10px;color:rgba(255,215,0,0.28);margin-top:1px;font-family:monospace;">${u.uid}</div>
      </div>
      <div style="font-size:20px;flex-shrink:0;color:rgba(255,215,0,0.5);">›</div>`;"""

    new_render = """    const label   = u.name  || u.email || '(no name)';
    const sublabel = u.email && u.name ? u.email : (u.phone || '');
    const japStr  = u.jap ? ' · ' + _lbFmtJap(u.jap) + ' jap' : '';
    // per-user version + last-synced display — relative time so it stays
    // readable without needing a live clock ("2h ago" instead of a raw
    // timestamp that goes stale-looking the moment you glance away).
    let metaStr = '';
    if (u.appVersion) metaStr += 'v' + _escHtmlG(u.appVersion);
    if (u.lastSeen && typeof u.lastSeen.toDate === 'function') {
      const ms = Date.now() - u.lastSeen.toDate().getTime();
      const mins = Math.floor(ms / 60000);
      const rel = mins < 1 ? 'just now'
        : mins < 60 ? mins + 'm ago'
        : mins < 1440 ? Math.floor(mins / 60) + 'h ago'
        : Math.floor(mins / 1440) + 'd ago';
      metaStr += (metaStr ? ' · ' : '') + rel;
    }
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,215,0,0.18);background:rgba(255,215,0,0.03);cursor:pointer;transition:background 0.15s;';
    row.onmouseenter = () => { row.style.background = 'rgba(255,215,0,0.09)'; };
    row.onmouseleave = () => { row.style.background = 'rgba(255,215,0,0.03)'; };
    row.innerHTML = `
      <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,215,0,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">👤</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#FFD700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escHtmlG(label)}${japStr}</div>
        ${sublabel ? `<div style="font-size:11px;color:rgba(255,255,255,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escHtmlG(sublabel)}</div>` : ''}
        <div style="font-size:10px;color:rgba(255,215,0,0.28);margin-top:1px;font-family:monospace;">${u.uid}</div>
        ${metaStr ? `<div style="font-size:10px;color:rgba(150,200,255,0.55);margin-top:2px;">${metaStr}</div>` : ''}
      </div>
      <div style="font-size:20px;flex-shrink:0;color:rgba(255,215,0,0.5);">›</div>`;"""

    if src.count(old_render) != 1:
        die(
            f"Expected exactly 1 occurrence of the _renderGhostList row-building "
            f"block, found {src.count(old_render)} — app.js may already differ from "
            f"what this script expects. No changes made to the display (heartbeat "
            f"rebuild and data plumbing above were still applied)."
        )
    src = src.replace(old_render, new_render, 1)

    backup_path = path + ".bak-presencev2"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(open(path, "r", encoding="utf-8").read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"[{path}] Presence heartbeat rebuilt + version/last-synced now flowing into ghost list data. Backup saved to {backup_path}")
    print("NOTE: the ghost list UI rendering itself (_renderGhostList) may need a")
    print("small follow-up tweak to actually DISPLAY appVersion/lastSeen per row —")
    print("the data is now present on each user object, ready to show.")


if __name__ == "__main__":
    main()
