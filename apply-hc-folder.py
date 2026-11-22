#!/usr/bin/env python3
"""apply-hc-folder.py - run once from the repo root (needs hcp-langs.js next to it, and apply-hcj-langs.py already applied):
    python3 apply-hc-folder.py
Adds the language picker to the "Sri Hit Chaurasi Ji & Phalastuti" folder card (top-right) and to the Phalastuti card.
One language choice covers the folder, Chaurasi and Phalastuti.  Phalastuti is added in English, Gujarati, Odia,
Punjabi, Telugu (no translation).  Patches app.js, index.html, sw.js.  Safe to run twice."""
import os, re, sys

for p in ('app.js', 'index.html', 'sw.js', 'hcp-langs.js'):
    if not os.path.exists(p): sys.exit('missing file: %s  (run from the repo root)' % p)
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s): open(p, 'w', encoding='utf-8').write(s)

s = rd('app.js')
if 'function hcjLang()' not in s:
    sys.exit('Run apply-hcj-langs.py first (the Hit Chaurasi language picker must be in app.js).')

HELPERS = r'''// ── Hit Chaurasi folder card + Phalastuti card: follow the same language picker as Hit Chaurasi Ji (HCP text: hcp-langs.js -> window.HCP_EXTRA) ──
const HC_FOLDER_UI = {
  en: { name: 'Sri Hit Chaurasi Ji and Phalstuti', sub: 'Sri Hit Chaurasi Ji and the fruits of its recitation' },
  gu: { name: 'શ્રી હિત ચૌરાસી જૂ અને ફલસ્તુતિ', sub: 'શ્રી હિત ચૌરાસી જૂ અને પાઠની ફલસ્તુતિ' },
  or: { name: 'ଶ୍ରୀ ହିତ ଚୌରାସୀ ଜୂ ଓ ଫଳସ୍ତୁତି', sub: 'ଶ୍ରୀ ହିତ ଚୌରାସୀ ଜୂ ଓ ପାଠର ଫଳସ୍ତୁତି' },
  pa: { name: 'ਸ਼੍ਰੀ ਹਿਤ ਚੌਰਾਸੀ ਜੂ ਅਤੇ ਫਲਸਤੁਤਿ', sub: 'ਸ਼੍ਰੀ ਹਿਤ ਚੌਰਾਸੀ ਜੂ ਅਤੇ ਪਾਠ ਦੀ ਫਲਸਤੁਤਿ' },
  te: { name: 'శ్రీ హిత చౌరాసీ జూ మరియు ఫలస్తుతి', sub: 'శ్రీ హిత చౌరాసీ జూ మరియు పాఠ ఫలస్తుతి' },
};
const HCP_UI = {
  en: { name: 'Sri Hit Chaurasi Ji – Phalstuti', sub: 'Fruits of reciting, and the raag count' },
  gu: { name: 'શ્રી હિત ચૌરાસી જૂ – ફલસ્તુતિ', sub: 'પાઠનું ફળ અને રાગ સંખ્યા' },
  or: { name: 'ଶ୍ରୀ ହିତ ଚୌରାସୀ ଜୂ – ଫଳସ୍ତୁତି', sub: 'ପାଠର ଫଳ ଓ ରାଗ ସଂଖ୍ୟା' },
  pa: { name: 'ਸ਼੍ਰੀ ਹਿਤ ਚੌਰਾਸੀ ਜੂ – ਫਲਸਤੁਤਿ', sub: 'ਪਾਠ ਦਾ ਫਲ ਅਤੇ ਰਾਗ ਸੰਖਿਆ' },
  te: { name: 'శ్రీ హిత చౌరాసీ జూ – ఫలస్తుతి', sub: 'పాఠ ఫలం మరియు రాగ సంఖ్య' },
};
function _hcFolderName(t) {
  const l = hcjLang();
  if (HC_FOLDER_UI[l]) return HC_FOLDER_UI[l].name;
  return l === 'hi' ? t.hi : t.bn;
}
'''

def rep(s, old, new, label):
    if new in s: print('  already applied:', label); return s
    if s.count(old) < 1: sys.exit('PATTERN NOT FOUND (app.js): %s - the file changed, send me the file' % label)
    print('  patched:', label); return s.replace(old, new, 1)

def rep_re(s, pat, fn, label, marker):
    if marker in s: print('  already applied:', label); return s
    s2, n = re.subn(pat, fn, s, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND (app.js): %s - the file changed, send me the file' % label)
    print('  patched:', label); return s2

print('app.js')
if 'const HC_FOLDER_UI' not in s:
    s = s.replace('function stName(st) {\n', HELPERS + "function stName(st) {\n  if (st && st.id === 'hcp') { const l = hcjLang(); if (HCP_UI[l]) return HCP_UI[l].name; return (l === \"hi\" && st.nameHi) ? st.nameHi : st.name; }\n", 1)
    s = s.replace('function stSub(st) {\n', "function stSub(st) {\n  if (st && st.id === 'hcp') { const l = hcjLang(); if (HCP_UI[l]) return HCP_UI[l].sub; return (l === \"hi\" && st.subHi) ? st.subHi : (st.sub || \"\"); }\n", 1)
    print('  patched: helpers + Phalastuti name/subtitle')
else: print('  already applied: helpers + Phalastuti name/subtitle')

# Phalastuti card follows the picker
s = rep_re(s, r"\(st\.id === 'hcj'\) \? hcjLang\(\)", lambda m: "(st.id === 'hcj' || st.id === 'hcp') ? hcjLang()", 'card: Phalastuti uses the Hit Chaurasi language', "(st.id === 'hcj' || st.id === 'hcp') ? hcjLang()")
s = rep_re(s, r"\(_hcjL && (HCJ_UI|_stUiMap)\[_hcjL\]\) \? (HCJ_UI|_stUiMap)\[_hcjL\]\.req",
           lambda m: "(_hcjL && " + m.group(1) + "[_hcjL] && st.id !== 'hcp') ? " + m.group(2) + "[_hcjL].req", "card: no badge on Phalastuti card", "&& st.id !== 'hcp') ?")
s = rep(s, "    if (st.id === 'hcj') headerRight = _hcjLangPickerHtml();", "    if (st.id === 'hcj' || st.id === 'hcp') headerRight = _hcjLangPickerHtml();", 'card: language picker on the Phalastuti card')
s = rep(s, "  if (id === 'hcj') {   // Hit Chaurasi Ji follows its own language picker",
  "  if (id === 'hcp') {   // Phalastuti follows the Hit Chaurasi language picker\n"
  "    const _pl = hcjLang();\n"
  "    if (HCJ_UI[_pl] && typeof HCP_EXTRA !== 'undefined' && HCP_EXTRA[_pl]) return HCP_EXTRA[_pl];\n"
  "    if (_pl === 'hi' && typeof LYRICS_HI !== 'undefined' && LYRICS_HI.hcp) return LYRICS_HI.hcp;\n"
  "    if (_pl === 'bn' && LYRICS.hcp) return LYRICS.hcp;\n"
  "  }\n"
  "  if (id === 'hcj') {   // Hit Chaurasi Ji follows its own language picker", 'reader: Phalastuti text by chosen language')

# folder card
s = rep(s, "      const _hiF = secLang('sv') === 'hi';\n",
  "      const _hcF = (fd.folder === 'hc') ? hcjLang() : null;\n      const _fUi = _hcF ? HC_FOLDER_UI[_hcF] : null;\n      const _hiF = _hcF ? _hcF === 'hi' : secLang('sv') === 'hi';\n", 'folder card: language of this folder')
s = rep(s, "      const reqF = _hiF ? fd.reqHi : fd.reqBn;", "      const reqF = _fUi ? HCJ_UI[_hcF].req : (_hiF ? fd.reqHi : fd.reqBn);", 'folder card: badge text')
s = rep(s, "      const subF = _hiF ? fd.subHi : fd.subBn;", "      const subF = _fUi ? _fUi.sub : (_hiF ? fd.subHi : fd.subBn);", 'folder card: subtitle')
s = rep(s, "escHtml(_hiF ? fd.hi : fd.bn)", "escHtml(_fUi ? _fUi.name : (_hiF ? fd.hi : fd.bn))", 'folder card: name')
s = rep(s,
  "            badgeF +\n          '</div>' +\n        '</div>' +\n        '<div class=\"st-row\" style=\"justify-content:flex-end\"><button class=\"st-open-btn\">' + (_hiF ? 'खोलें' : 'খুলুন') + '</button></div>';",
  "            badgeF +\n          '</div>' +\n          (_hcF ? _hcjLangPickerHtml() : '') +\n        '</div>' +\n        '<div class=\"st-row\" style=\"justify-content:flex-end\"><button class=\"st-open-btn\">' + (_fUi ? HCJ_UI[_hcF].open : (_hiF ? 'खोलें' : 'খুলুন')) + '</button></div>';",
  'folder card: language picker in the top-right box + Open button')
s = rep(s, "(secLang('sv') === 'hi' ? window._stRvSubTitle.hi : window._stRvSubTitle.bn)",
  "(window._stRvSub === 'hc' ? _hcFolderName(window._stRvSubTitle) : (secLang('sv') === 'hi' ? window._stRvSubTitle.hi : window._stRvSubTitle.bn))", 'folder back-bar title')
wr('app.js', s)

print('index.html')
h = rd('index.html')
if 'hcp-langs.js' not in h:
    h, n = re.subn(r'(<script src="\./hcj-langs\.js\?v=\d+"></script>)', r'\1\n    <script src="./hcp-langs.js?v=1"></script>', h, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND (index.html): hcj-langs.js script tag')
    h = re.sub(r'app\.js\?v=(\d+)', lambda m: 'app.js?v=%d' % (int(m.group(1)) + 1), h, count=1)
    wr('index.html', h); print('  patched: hcp-langs.js tag + app.js version bump')
else: print('  already applied')

print('sw.js')
w = rd('sw.js')
if "'./hcp-langs.js'" not in w:
    if "  './hcj-langs.js',\n" not in w: sys.exit('PATTERN NOT FOUND (sw.js): hcj-langs.js in precache list')
    w = w.replace("  './hcj-langs.js',\n", "  './hcj-langs.js',\n  './hcp-langs.js',\n", 1)
    w, n = re.subn(r"const CACHE = 'radha-jap-v(\d+)';", lambda m: "const CACHE = 'radha-jap-v%d';" % (int(m.group(1)) + 1), w, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND (sw.js): CACHE name')
    wr('sw.js', w); print('  patched: precache hcp-langs.js + cache name bump')
else: print('  already applied')
print('done')
