#!/usr/bin/env python3
"""
apply_update_fixes.py  -  run from the repo root (the folder with app.js and index.html).

1. Update notifications: once per version, only counted after really shown, honest wording.
2. Auto-install waits for a 4 s pause in tapping (never restarts the app mid-tap).
3. "Refresh Now" gets its own card (reload icon), right below the Update card.
4. Web (PWA): Update card is hidden; Refresh says "Refresh now to update and clear caches".
5. Bumps app.js?v= in index.html so web users get the new file.

Safe to run twice. If anything is not found, NOTHING is changed.
"""
import os, re, sys

def read(p):
    return open(p, encoding='utf-8').read()

def write(p, t):
    open(p, 'w', encoding='utf-8').write(t)

if not (os.path.exists('app.js') and os.path.exists('index.html')):
    sys.exit('Run this from the repo root (app.js and index.html must be in this folder).')

def once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit('NOT FOUND (file changed?): %s (found %d times). Nothing was changed.' % (label, n))
    print('  ok:', label)
    return text.replace(old, new, 1)

s = read('app.js')
h = read('index.html')

# ---------------------------------------------------------------- A. update flow (app.js)
if 'rjUpdateNotifiedList' in s:
    print('update-flow fixes: already applied')
else:
    s = once(s, '''  try {
    const key = "rjUpdateNotified";
    if (!versionKey || localStorage.getItem(key) === String(versionKey)) return;
    localStorage.setItem(key, String(versionKey));
  } catch (_) {}
''', '''  const _LK = "rjUpdateNotifiedList";
  let _seen = [];
  try { _seen = JSON.parse(localStorage.getItem(_LK) || "[]"); if (!Array.isArray(_seen)) _seen = []; } catch (_) { _seen = []; }
  window._rjNotifyBusy = window._rjNotifyBusy || {};
  if (!versionKey || _seen.indexOf(String(versionKey)) >= 0 || window._rjNotifyBusy[versionKey]) return;
  window._rjNotifyBusy[versionKey] = true;
''', 'notify once per version')

    s = once(s, '''  if (!sent && typeof toast === "function") toast("⬆️ " + text);
}''', '''  if (!sent && typeof toast === "function") { toast("⬆️ " + text); sent = true; }
  if (sent) { try { let _cur = JSON.parse(localStorage.getItem(_LK) || "[]"); if (!Array.isArray(_cur)) _cur = []; _cur.push(String(versionKey)); localStorage.setItem(_LK, JSON.stringify(_cur.slice(-30))); } catch (_) {} }
  delete window._rjNotifyBusy[versionKey];
}''', 'record only after shown')

    s = once(s, '" — downloading it now 🙏"',
             '" 🙏 Tap Update App in Settings (or accept the Google prompt)."', 'notification wording')

    s = once(s, '''window._rjPlayUpd = window._rjPlayUpd || { downloaded: false, available: false, listener: false, lastCheck: 0 };''',
'''window._rjPlayUpd = window._rjPlayUpd || { downloaded: false, available: false, listener: false, lastCheck: 0 };
// last time the person touched the screen (used so the auto-install never restarts the app mid-tap)
window._rjLastTouch = Date.now();
["touchstart", "pointerdown", "keydown"].forEach(function (ev) {
  try { document.addEventListener(ev, function () { window._rjLastTouch = Date.now(); }, { passive: true, capture: true }); } catch (_e) {}
});''', 'touch tracker')

    s = once(s, '''  await new Promise((r) => setTimeout(r, 2500));   // let the save/sync flush''',
'''  await new Promise((r) => setTimeout(r, 2500));   // let the save/sync flush
  for (let i = 0; i < 90 && Date.now() - (window._rjLastTouch || 0) < 4000; i++) await new Promise((r) => setTimeout(r, 1000));   // wait for a 4 s pause in tapping (max 90 s)''', 'wait for idle before install')

    m = re.search(r'\./app\.js\?v=(\d+)', h)
    if m:
        h = h.replace(m.group(0), './app.js?v=%d' % (int(m.group(1)) + 1), 1)
        print('  ok: app.js?v ->', int(m.group(1)) + 1)

# ---------------------------------------------------------------- B. Refresh card (index.html)
if 'id="appRefreshCard"' in h:
    print('refresh-card layout: already applied')
else:
    m = re.search(r'[ \t]*<button id="appRefreshBtn".*?</button>\n', h, re.S)
    if not m:
        sys.exit('NOT FOUND: appRefreshBtn. Nothing was changed.')
    h = h.replace(m.group(0), '', 1)
    h = h.replace('<!-- Two SEPARATE buttons: Update Now (get the newest version) and Refresh (clear cache & reload). -->',
                  '<!-- Update App button (Refresh Now now has its own card below). -->', 1)

    anchor = '    <!-- ADMIN TOOLS (developers only)'
    card = '''  <!-- REFRESH NOW — its own card. App: clears local cache + reloads. Web (PWA): refresh = update + clear caches. -->
  <div class="sc" id="appRefreshCard" style="background:rgba(8,12,35,0.82);border:1px solid rgba(126,200,255,0.3);padding:14px 15px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#7ec8ff;line-height:1.2;">Refresh</div>
        <div id="appRefreshSub" style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:3px;">Clears the app's local cache and reloads 🙏</div>
      </div>
      <button id="appRefreshBtn" type="button" onclick="rjRefreshApp();" style="display:flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;min-height:44px;padding:8px 16px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;background:rgba(126,200,255,0.12);color:#7ec8ff;border:1px solid rgba(126,200,255,0.4);"><svg class="rj-reload-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>Refresh Now</button>
    </div>
  </div>
  <script>/* web (PWA): there is no separate "Update App" - refreshing IS the update */(function(){try{var n=window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();var u=document.getElementById("appUpdateCard"),s=document.getElementById("appRefreshSub");if(!n){if(u)u.style.display="none";if(s)s.textContent="Refresh now to update and clear caches \\ud83d\\ude4f";}}catch(e){}})();</script>

'''
    h = once(h, anchor, card + anchor, 'Refresh card placed above Admin Tools / Profile')

    old = 'statusEl.textContent = "New version available (" + remotePseudoVersion + ") — tap to refresh";'
    if s.count(old) == 1:
        s = s.replace(old, old + ' try { const _rs = document.getElementById("appRefreshSub"); if (_rs) _rs.textContent = "New version available (" + remotePseudoVersion + ") — refresh now to update and clear caches \\ud83d\\ude4f"; } catch (_) {}', 1)
        print('  ok: web "new version" hint')

# ---------------------------------------------------------------- write (only reached if every step above passed)
write('app.js', s)
write('index.html', h)
print('\nDONE - app.js and index.html updated.')
