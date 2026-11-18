#!/usr/bin/env python3
"""Lite build post-process. Run from repo root AFTER www/ exists. Touches www/ only."""
import os, re, sys, glob, shutil

W = 'www'
SITE = 'https://radharadharadha.vercel.app'
KEEP = ['hitju_maharaj', 'gurudev', 'radha_vallabh']          # main jap display (bundled)
KEEP_SAMPRADAY = ['tilaks', 'harivangshi']
REMOTE_PREFIX = ('iskcon_', 'gopeshwar_', 'haridashi_', 'nimbark_', 'ramanandi_', 'ramanuj_', 'vallabh_')
REMOTE_EXACT = []                                          # rashikan gallery stays bundled (50 MB budget)
DROP_FILES = ['lite-postprocess.py', 'build-apk-lite.sh', 'All source text.zip', 'og-image.png', 'bhagavadik-bank.png']
REMOTE_ROOT = ['bhagavadik-bank.png']
DROP_DIRS = ['resources']

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
if os.path.isdir(sp):
    for name in sorted(os.listdir(sp)):
        if name not in KEEP_SAMPRADAY:
            removed.append('sampraday/' + name); shutil.rmtree(os.path.join(sp, name), ignore_errors=True)
for f in DROP_FILES:
    if os.path.exists(os.path.join(W, f)): os.remove(os.path.join(W, f)); removed.append(f)
for d in DROP_DIRS:
    if os.path.isdir(os.path.join(W, d)): shutil.rmtree(os.path.join(W, d)); removed.append(d)
print('removed from bundle:', ', '.join(removed))

# 2. (no image shrinking - 50 MB budget, originals kept at full quality)

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
s = s.replace(old, "/^\\/(deities|iskcon_|gopeshwar_|haridashi_|nimbark_|ramanandi_|ramanuj_|vallabh_)/.test(url.pathname) && !url.search", 1)
open(p, 'w', encoding='utf-8').write(s)

after = size(W)
print('www/: %.1f MB -> %.1f MB' % (before / 1048576, after / 1048576))
