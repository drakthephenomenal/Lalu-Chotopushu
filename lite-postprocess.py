#!/usr/bin/env python3
"""Lite build post-process. Run from repo root AFTER www/ exists. Touches www/ only."""
import os, re, sys, glob, shutil

W = 'www'
SITE = 'https://radharadharadha.vercel.app'
KEEP = ['hitju_maharaj', 'gurudev', 'radha_vallabh']          # main jap display (bundled)
KEEP_SAMPRADAY = ['tilaks', 'harivangshi']
REMOTE_PREFIX = ('ramanuj_', 'vallabh_', 'nimbark_', 'ramanandi_', 'haridashi_', 'gopeshwar_')
REMOTE_EXACT = ['rashikan']
DROP_FILES = ['lite-postprocess.py', 'build-apk-lite.sh', 'All source text.zip', 'og-image.png']
REMOTE_ROOT = []
DROP_DIRS = ['resources', 'audio', 'videos']

def size(p):
    t = 0
    for r, _, fs in os.walk(p):
        for f in fs: t += os.path.getsize(os.path.join(r, f))
    return t

before = size(W)

# 1. remove folders that will load online instead
removed = []
for name in sorted(os.listdir(W)):
    p = os.path.join(W, name)
    if os.path.isdir(p) and (name.startswith(REMOTE_PREFIX) or name in REMOTE_EXACT):
        removed.append(name); shutil.rmtree(p)
sp = os.path.join(W, 'sampraday')
if os.path.isdir(sp) and False:                              # (all sampraday folders kept)
    for name in sorted(os.listdir(sp)):
        if name not in KEEP_SAMPRADAY:
            removed.append('sampraday/' + name); shutil.rmtree(os.path.join(sp, name), ignore_errors=True)
for f in DROP_FILES:
    if os.path.exists(os.path.join(W, f)): os.remove(os.path.join(W, f)); removed.append(f)
for d in DROP_DIRS:
    if os.path.isdir(os.path.join(W, d)): shutil.rmtree(os.path.join(W, d)); removed.append(d)
print('removed from bundle:', ', '.join(removed))

# 2. (no image shrinking - 50 MB budget, originals kept at full quality)

KEEP = [d for d in os.listdir(W) if os.path.isdir(os.path.join(W, d))]   # every bundled folder loads locally

# 3. app.js: non-bundled image folders load from the website
p = os.path.join(W, 'app.js'); s = open(p, encoding='utf-8').read()
helper = ("const _RJ_LOCAL_IMG = new Set(%r);\n"
          "function _rjImgBase(folder) { return _RJ_LOCAL_IMG.has(folder) ? './' + folder + '/' : '%s/' + folder + '/'; }\n"
          "function _rjImgUrl(path) { const i = path.indexOf('/'); return i < 0 ? (%r.indexOf(path) >= 0 ? '%s/' + path : './' + path) : _rjImgBase(path.slice(0, i)) + path.slice(i + 1); }\n") % (KEEP, SITE, REMOTE_ROOT, SITE)
anchor = 'const RJAP_PWA_URL = "https://radharadharadha.vercel.app/";'
if anchor not in s: sys.exit('PATTERN NOT FOUND: RJAP_PWA_URL anchor (app.js changed?)')
s = s.replace(anchor, anchor + '\n' + helper, 1)
n = s.count('./${conf.folder}/')
if n < 3: sys.exit('PATTERN NOT FOUND: ./${conf.folder}/ (found %d, expected 3)' % n)
s = s.replace('./${conf.folder}/', '${_rjImgBase(conf.folder)}')
fb = "./${conf.fallback || (conf.folder + '/1.png')}"
if fb not in s: sys.exit('PATTERN NOT FOUND: conf.fallback path')
s = s.replace(fb, "${_rjImgUrl(conf.fallback || (conf.folder + '/1.png'))}")
print('app.js: %d folder paths now point online' % n)
open(p, 'w', encoding='utf-8').write(s)

# 4. sw.js: keep every photo that was loaded online, for offline use next time
p = os.path.join(W, 'sw.js'); s = open(p, encoding='utf-8').read()
old = "url.pathname.indexOf('/deities/') >= 0 && !url.search"
if old not in s: sys.exit('PATTERN NOT FOUND: sw.js remote photo rule (sw.js changed?)')
s = s.replace(old, "/^\\/(deities|rashikan|iskcon_|gopeshwar_|haridashi_|nimbark_|ramanandi_|ramanuj_|vallabh_)/.test(url.pathname) && !url.search", 1)
open(p, 'w', encoding='utf-8').write(s)

after = size(W)
print('www/: %.1f MB -> %.1f MB' % (before / 1048576, after / 1048576))

s = open('www/app.js', encoding='utf-8').read()
s2, n = re.subn(r"var _packed = /[^\n]*;", "var _packed = /(?!)/;   /* LITE: nothing packed */", s, count=1)
if n != 1: sys.exit('PATTERN NOT FOUND: var _packed (app.js changed?)')
open('www/app.js', 'w', encoding='utf-8').write(s2)
print('app.js: all audio streams from the website')

# 4b. native-online-media.js: redirect ONLY the folders that are not packed in Lite
src = 'native-online-media.js'
if os.path.exists(src):
    t = open(src, encoding='utf-8').read()
    new_re = "var RE = /^(?:[.][/])?((?:rashikan|(?:ramanuj|vallabh|nimbark|ramanandi|haridashi|gopeshwar)_[a-z_]+)[/].+)$/i;"
    t, n = re.subn(r"var RE = .*", lambda m: new_re, t, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND: var RE (native-online-media.js changed?)')
    open(os.path.join(W, 'native-online-media.js'), 'w', encoding='utf-8').write(t)
    print('native-online-media.js: only rashikan + the other sampraday folders load online')

# 5. safety check: everything Lite promises must really be inside www/
need = ['Panchojanno Shankya.mp3', 'bhagavadik-bank.png', 'sampraday/tilaks/gaudiya.png', 'sampraday/harivangshi/1.jpg',
        'radha_vallabh', 'hitju_maharaj', 'gurudev', 'iskcon_chaitanya', 'iskcon_acharya', 'iskcon_gurudev',
        'iskcon_gaudiya_bank', 'vendor/firebase-app-compat.js']
miss = [x for x in need if not os.path.exists(os.path.join(W, x))]
miss += [t for t in ('reminder_tone.mp3', 'push_tone.mp3', 'silent_tone.wav') if not os.path.exists(t)]
if miss:
    sys.exit('LITE check FAILED - missing: ' + ', '.join(miss))
print('LITE check OK: jap-display photos, bank photos, sampraday photos and icons, mala sound, notification tones, offline Firebase are all packed')
