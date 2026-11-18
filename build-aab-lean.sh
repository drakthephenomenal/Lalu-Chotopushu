#!/bin/bash
# build-aab-lean.sh — Play Store AAB that
#   • BUNDLES offline audio: Hit Chaurasi (original + Ankit + pad 52 Shuvam) and Radha Sudha Nidhi (original)
#   • does NOT bundle photos: they load live from the website (like deities/), when the app is open and online
#   • does NOT touch/resize any image
# Run from the repo root in Codespace:   bash build-aab-lean.sh
set -e
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "── 1/5 Check the audio that will be bundled ────────────────────"
cnt() { [ -d audio ] && find audio -maxdepth 1 -type f -regextype posix-extended -regex "$1" | wc -l || echo 0; }
N_HCJ=$(cnt '.*/hcj_[0-9]+\.mp3')
N_ANK=$(cnt '.*/hcj_ankit_[0-9]+\.mp3')
N_SHU=$(cnt '.*/hcj_shuvam_52\.mp3')
N_RSN=$(cnt '.*/rsn_([0-9]+|c)\.mp3')
echo "  Hit Chaurasi original : $N_HCJ files"
echo "  Hit Chaurasi Ankit    : $N_ANK files"
echo "  Pad 52 Shuvam         : $N_SHU file (hcj_shuvam_52.mp3)"
echo "  Radha Sudha Nidhi     : $N_RSN files (rsn_<n>.mp3 + rsn_c.mp3)"
if [ $((N_HCJ + N_ANK + N_RSN)) -eq 0 ] && [ -z "$ALLOW_NO_AUDIO" ]; then
  echo "❌ No hcj_*/rsn_* files found in ./audio — is the audio/ folder in this repo/Codespace?"
  echo "   Put those mp3 files in ./audio and run again (or ALLOW_NO_AUDIO=1 to build without them)."
  exit 1
fi

echo "── 2/5 Patch the project (one time, safe to re-run) ────────────"
python3 - <<'PY'
import re, os

# ---------- (a) native-only shim: unbundled photos load from the website ----------
shim = r"""/* native-online-media.js
   Android app only (no effect on the website): photos that are NOT packed into the app are
   loaded live from the website instead. Works when the app is open and online. */
(function () {
  try {
    var native = false;
    try { native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) {}
    if (!native) native = (location.protocol === 'https:' && location.hostname === 'localhost' && !location.port && /Android/i.test(navigator.userAgent));
    if (!native) return;
    var BASE = 'https://radharadharadha.vercel.app/';
    var RE = /^(?:\.\/)?((?:(?:sampraday|gurudev|hitju_maharaj|radha_vallabh|rashikan)|(?:iskcon|ramanuj|vallabh|nimbark|ramanandi|haridashi|gopeshwar)_[a-z_]+)\/.+|bhagavadik-bank\.png(?:\?.*)?)$/i;
    function fix(u) {
      if (typeof u !== 'string' || !u) return u;
      var p = u, o = location.origin + '/';
      if (p.indexOf(o) === 0) p = p.slice(o.length);
      var m = RE.exec(p);
      return m ? BASE + m[1] : u;
    }
    var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set: function (v) { d.set.call(this, fix(v)); }
      });
    }
    var sa = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) {
      if (this instanceof HTMLImageElement && String(n).toLowerCase() === 'src') v = fix(v);
      return sa.call(this, n, v);
    };
    function fixEl(el) {
      if (!el || el.nodeType !== 1) return;
      if (el.tagName === 'IMG') {
        var s = el.getAttribute('src'), n = fix(s);
        if (n !== s) sa.call(el, 'src', n);
      }
      if (el.querySelectorAll) {
        var l = el.querySelectorAll('img');
        for (var i = 0; i < l.length; i++) {
          var s2 = l[i].getAttribute('src'), n2 = fix(s2);
          if (n2 !== s2) sa.call(l[i], 'src', n2);
        }
      }
    }
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'attributes') fixEl(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) fixEl(m.addedNodes[j]);
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    document.addEventListener('DOMContentLoaded', function () { fixEl(document.documentElement); });
  } catch (e) {}
})();
"""
open('native-online-media.js', 'w', encoding='utf-8').write(shim)

# ---------- (b) index.html: load the shim first; bump app.js version ----------
h = open('index.html', encoding='utf-8').read()
if 'native-online-media.js' not in h:
    assert h.count('<head>') >= 1
    h = h.replace('<head>', '<head>\n<script src="./native-online-media.js?v=1"></script>', 1)
    m = re.search(r'\./app\.js\?v=(\d+)', h)
    assert m, 'app.js?v= not found'
    h = h.replace(m.group(0), './app.js?v=%d' % (int(m.group(1)) + 1), 1)
    open('index.html', 'w', encoding='utf-8').write(h)
    sw = open('sw.js', encoding='utf-8').read()
    m = re.search(r"radha-jap-v(\d+)", sw)
    assert m, 'sw.js cache name not found'
    sw = sw.replace(m.group(0), 'radha-jap-v%d' % (int(m.group(1)) + 1), 1)
    open('sw.js', 'w', encoding='utf-8').write(sw)
    print('  index.html + sw.js updated')
else:
    print('  index.html already has the shim')

# ---------- (c) app.js: keep the chosen audio LOCAL in the installed app ----------
a = open('app.js', encoding='utf-8').read()
old = 'return m ? base + "/" + m[1] : u;'
new = 'return (m && !/^audio\\/(?:hcj_\\d+|hcj_ankit_\\d+|hcj_shuvam_52|rsn_\\d+|rsn_c)\\.mp3(?:\\?.*)?$/.test(m[1])) ? base + "/" + m[1] : u; // bundled offline audio stays local'
if new in a:
    print('  app.js already patched')
else:
    assert a.count(old) == 1, 'audio rewrite line not found exactly once in app.js'
    open('app.js', 'w', encoding='utf-8').write(a.replace(old, new))
    print('  app.js patched (bundled audio stays local)')

# ---------- (d) setup-www.sh: what goes into the app ----------
s = open('setup-www.sh', encoding='utf-8').read()
# remove leftovers of the earlier image-shrinking script, if it was ever applied
s = re.sub(r'\n# AAB-SIZE-TRIM: shrink images.*?\nfi\n', '\n', s, flags=re.S)
s = re.sub(r"\n  # AAB-SIZE-TRIM: never loaded by the app\n(?:  --exclude='[^\n]*'\n)+", '\n', s)
s = re.sub(r"  # >>> AAB-LEAN.*?  # <<< AAB-LEAN\n", '', s, flags=re.S)

block = """  # >>> AAB-LEAN (managed by build-aab-lean.sh)
  # Offline audio kept INSIDE the app: Hit Chaurasi (original + Ankit + pad 52 Shuvam) and Radha Sudha Nidhi (original)
  --include='/audio/'
  --include='/audio/hcj_[0-9]*.mp3'
  --include='/audio/hcj_ankit_[0-9]*.mp3'
  --include='/audio/hcj_shuvam_52.mp3'
  --include='/audio/rsn_[0-9]*.mp3'
  --include='/audio/rsn_c.mp3'
  --exclude='/audio/*'
  # Photos NOT packed: the app loads them live from the website (see native-online-media.js)
  --exclude='/sampraday'
  --exclude='/gurudev'
  --exclude='/hitju_maharaj'
  --exclude='/radha_vallabh'
  --exclude='/rashikan'
  --exclude='/iskcon_*'
  --exclude='/ramanuj_*'
  --exclude='/vallabh_*'
  --exclude='/nimbark_*'
  --exclude='/ramanandi_*'
  --exclude='/haridashi_*'
  --exclude='/gopeshwar_*'
  --exclude='/bhagavadik-bank.png'
  # Never loaded by the app
  --exclude='*.zip'
  --exclude='gg_batch_*.txt'
  --exclude='rasik_serial_70.json'
  --exclude='Radha_Sudha_Nidhi_Hindi_clean_lyrics.txt'
  --exclude='/resources'
  # <<< AAB-LEAN
"""
if "  --exclude='/audio'\n" in s:
    s = s.replace("  --exclude='/audio'\n", block, 1)
else:
    assert "  --exclude='stotram-live'\n" in s, 'anchor not found in setup-www.sh'
    s = s.replace("  --exclude='stotram-live'\n", block + "  --exclude='stotram-live'\n", 1)

assert 'rsync -a --delete' in s
if 'rm -rf www\nmkdir -p www' not in s:
    assert '\nmkdir -p www\n' in s
    s = s.replace('\nmkdir -p www\n', '\nrm -rf www      # always start from a clean copy\nmkdir -p www\n', 1)
s = re.sub(r'^rm -rf www/deities www/audio', 'rm -rf www/deities', s, flags=re.M)
open('setup-www.sh', 'w', encoding='utf-8').write(s)
print('  setup-www.sh patched')
PY
bash -n setup-www.sh
node --check native-online-media.js 2>/dev/null || true

if [ -n "$DRY" ]; then echo "DRY run: patches done, build skipped."; exit 0; fi

echo "── 3/5 Build (APK for testing + AAB for Play) ──────────────────"
bash build-android.sh

echo "── 4/5 Check the result ────────────────────────────────────────"
AAB=android/app/build/outputs/bundle/release/app-release.aab
[ -f "$AAB" ] || { echo "❌ AAB not found — see errors above"; exit 1; }
cp "$AAB" RadhaNaamJap-play.aab
grep -qxF '*.aab' .gitignore || echo '*.aab' >> .gitignore
echo "  audio files inside the AAB : $(unzip -l "$AAB" | grep -c 'assets/public/audio/.*\.mp3')"
echo "  photo-folder files inside  : $(unzip -l "$AAB" | grep -Ec 'assets/public/(sampraday|deities|rashikan|gurudev|iskcon_|ramanuj_|vallabh_|nimbark_|ramanandi_|haridashi_|gopeshwar_)') (should be 0)"
echo "  web assets bundled         : $(du -sh www | cut -f1)"
ls -lh RadhaNaamJap-play.aab | awk '{print "  AAB size                   : " $5}'
echo "  versionCode                : $(cat .app-version)"

echo "── 5/5 Commit + push ───────────────────────────────────────────"
git add setup-www.sh app.js index.html sw.js native-online-media.js .gitignore .app-version
git commit -m "Lean AAB: bundle Hit Chaurasi + Radha Sudha Nidhi audio, load photos online (v$(cat .app-version))" || true
git push origin main || echo "(push skipped)"
echo "✅ Test android/app/build/outputs/apk/release/app-release.apk on your phone first,"
echo "   then upload RadhaNaamJap-play.aab (repo root) to Play Console."
