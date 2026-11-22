#!/usr/bin/env python3
"""apply-hcj-langs.py - run once from the repo root (needs hcj-langs.js next to it):
    python3 apply-hcj-langs.py
Adds a language picker to the Sri Hit Chaurasi Ji card (top-right) with
Bangla, Hindi, English, Gujarati, Odia, Punjabi, Telugu.  The 5 new languages show the pads
without translation.  Patches app.js, index.html, sw.js.  Safe to run twice."""
import os, re, sys

def need(path):
    if not os.path.exists(path): sys.exit('missing file: ' + path + '  (run from the repo root)')
need('app.js'); need('index.html'); need('sw.js'); need('hcj-langs.js')

def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s): open(p, 'w', encoding='utf-8').write(s)

HELPERS = r'''// ── Hit Chaurasi Ji: its own reading language (Bangla, Hindi + English, Gujarati, Odia, Punjabi, Telugu without translation) ──
// Text for the 5 extra languages lives in hcj-langs.js (window.HCJ_EXTRA). Choice is kept in App.S.secLang.hcj.
const HCJ_LANGS = [
  { c: 'bn', n: 'বাংলা' }, { c: 'hi', n: 'हिन्दी' }, { c: 'en', n: 'English' },
  { c: 'gu', n: 'ગુજરાતી' }, { c: 'or', n: 'ଓଡ଼ିଆ' }, { c: 'pa', n: 'ਪੰਜਾਬੀ' }, { c: 'te', n: 'తెలుగు' },
];
const HCJ_UI = {
  en: { dig: '0123456789', name: 'Sri Hit Chaurasi Ji', sub: 'Composed by Sri Hit Harivansh Chandra Ju Mahaprabhu',
        req: '★ Must read — 12 pads daily (without meaning)', open: 'Open', none: 'Not read yet today',
        done: 'Today\'s 12 pads complete', part: (n, r) => n + '/12 read — ' + r + ' to go' },
  gu: { dig: '૦૧૨૩૪૫૬૭૮૯', name: 'શ્રી હિત ચૌરાસી જૂ', sub: 'શ્રી હિત હરિવંશ ચંદ્ર જૂ મહાપ્રભુ રચિત',
        req: '★ અનિવાર્ય — દરરોજ ૧૨ પદ (અર્થ વગર)', open: 'ખોલો', none: 'આજે હજી વાંચ્યું નથી',
        done: 'આજના ૧૨ પદ પૂર્ણ', part: (n, r) => n + '/૧૨ વાંચ્યા — હજી ' + r + ' બાકી' },
  or: { dig: '୦୧୨୩୪୫୬୭୮୯', name: 'ଶ୍ରୀ ହିତ ଚୌରାସୀ ଜୂ', sub: 'ଶ୍ରୀ ହିତ ହରିବଂଶ ଚନ୍ଦ୍ର ଜୂ ମହାପ୍ରଭୁ ରଚିତ',
        req: '★ ଅନିବାର୍ଯ୍ୟ — ପ୍ରତିଦିନ ୧୨ ପଦ (ଅର୍ଥ ବିନା)', open: 'ଖୋଲନ୍ତୁ', none: 'ଆଜି ଏପର୍ଯ୍ୟନ୍ତ ପଢ଼ାଯାଇନାହିଁ',
        done: 'ଆଜିର ୧୨ ପଦ ସମ୍ପୂର୍ଣ୍ଣ', part: (n, r) => n + '/୧୨ ପଢ଼ା — ଆଉ ' + r + ' ବାକି' },
  pa: { dig: '੦੧੨੩੪੫੬੭੮੯', name: 'ਸ਼੍ਰੀ ਹਿਤ ਚੌਰਾਸੀ ਜੂ', sub: 'ਸ਼੍ਰੀ ਹਿਤ ਹਰਿਵੰਸ਼ ਚੰਦ੍ਰ ਜੂ ਮਹਾਪ੍ਰਭੂ ਰਚਿਤ',
        req: '★ ਲਾਜ਼ਮੀ — ਹਰ ਰੋਜ਼ ੧੨ ਪਦ (ਅਰਥ ਤੋਂ ਬਿਨਾਂ)', open: 'ਖੋਲ੍ਹੋ', none: 'ਅੱਜ ਹਾਲੇ ਨਹੀਂ ਪੜ੍ਹਿਆ',
        done: 'ਅੱਜ ਦੇ ੧੨ ਪਦ ਪੂਰੇ', part: (n, r) => n + '/੧੨ ਪੜ੍ਹੇ — ਹੋਰ ' + r + ' ਬਾਕੀ' },
  te: { dig: '౦౧౨౩౪౫౬౭౮౯', name: 'శ్రీ హిత చౌరాసీ జూ', sub: 'శ్రీ హిత హరివంశ చంద్ర జూ మహాప్రభు రచన',
        req: '★ తప్పనిసరి — రోజుకు ౧౨ పదాలు (అర్థం లేకుండా)', open: 'తెరవండి', none: 'ఈ రోజు ఇంకా చదవలేదు',
        done: 'ఈ రోజు ౧౨ పదాలు పూర్తి', part: (n, r) => n + '/౧౨ చదివారు — ఇంకా ' + r + ' మిగిలాయి' },
};
function hcjLang() {
  const o = App && App.S && App.S.secLang && App.S.secLang.hcj;
  if (HCJ_LANGS.some((x) => x.c === o)) return o;
  return secLang('sv');
}
function _hcjNum(n, l) {
  const d = (HCJ_UI[l] || {}).dig;
  return d ? String(n).replace(/\d/g, (x) => d[x]) : String(n);
}
function setHcjLang(c) {
  if (!HCJ_LANGS.some((x) => x.c === c) || !App || !App.S) return;
  if (!App.S.secLang || typeof App.S.secLang !== 'object') App.S.secLang = {};
  App.S.secLang.hcj = c;
  try { App.save(); } catch (_e) {}
  try { secLangPersistLocal(); } catch (_e) {}
  window._svVI = null;   // verse-search index is rebuilt in the new script
  try { renderSt(); } catch (_e) {}
  try { if (typeof _lcRefreshOpenLyrics === 'function') _lcRefreshOpenLyrics(); } catch (_e) {}
}
function _hcjLangPickerHtml() {
  const cur = hcjLang();
  return '<select class="hcj-lang-sel" aria-label="Language" onclick="event.stopPropagation()" onchange="setHcjLang(this.value)" ' +
    'style="flex-shrink:0;max-width:118px;min-height:38px;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,215,0,0.55);' +
    'background:rgba(255,215,0,0.10);color:#ffd700;font-size:13px;font-weight:700;font-family:\'Hind Siliguri\',sans-serif;color-scheme:dark">' +
    HCJ_LANGS.map((x) => '<option value="' + x.c + '"' + (x.c === cur ? ' selected' : '') + '>' + x.n + '</option>').join('') +
    '</select>';
}
'''

def patch(path, pairs):
    s = rd(path); print(path)
    for old, new, label in pairs:
        if new in s: print('  already applied:', label); continue
        if s.count(old) < 1: sys.exit('PATTERN NOT FOUND (%s): %s - the file changed, send me the file' % (path, label))
        s = s.replace(old, new, 1); print('  patched:', label)
    wr(path, s)

# --- app.js (all anchors are single, exact strings) ---
s = rd('app.js')
if 'function hcjLang()' not in s:
    # open-button text: the first one after the card's _stHi line
    k = s.find("const _stHi = secLang('sv') === 'hi';")
    j = s.find("(_stHi ? 'खोलें' : 'খুলুন')", k)
    if k < 0 or j < 0: sys.exit('PATTERN NOT FOUND (app.js): card open button')
    s = s[:j] + "((_hcjL && HCJ_UI[_hcjL]) ? HCJ_UI[_hcjL].open : (_stHi ? 'खोलें' : 'খুলুন'))" + s[j + len("(_stHi ? 'खोलें' : 'খুলুন')"):]
    wr('app.js', s)
patch('app.js', [
 ('function stName(st) {\n  return (secLang(\'sv\') === "hi" && st.nameHi) ? st.nameHi : st.name;\n}\nfunction stSub(st) {\n  return (secLang(\'sv\') === "hi" && st.subHi) ? st.subHi : (st.sub || "");\n}',
  HELPERS + 'function stName(st) {\n  if (st && st.id === \'hcj\') { const l = hcjLang(); if (HCJ_UI[l]) return HCJ_UI[l].name; return (l === "hi" && st.nameHi) ? st.nameHi : st.name; }\n  return (secLang(\'sv\') === "hi" && st.nameHi) ? st.nameHi : st.name;\n}\nfunction stSub(st) {\n  if (st && st.id === \'hcj\') { const l = hcjLang(); if (HCJ_UI[l]) return HCJ_UI[l].sub; return (l === "hi" && st.subHi) ? st.subHi : (st.sub || ""); }\n  return (secLang(\'sv\') === "hi" && st.subHi) ? st.subHi : (st.sub || "");\n}',
  'language helpers + card name/sub'),
 ("const _stHi = secLang('sv') === 'hi';",
  "const _hcjL = (st.id === 'hcj') ? hcjLang() : null;\n    const _stHi = _hcjL ? _hcjL === 'hi' : secLang('sv') === 'hi';\n    if (st.id === 'hcj') headerRight = _hcjLangPickerHtml();",
  'card: language picker in the top-right box'),
 ("const _reqTxt = _stHi ? st.reqHi : st.reqBn;",
  "const _reqTxt = (_hcjL && HCJ_UI[_hcjL]) ? HCJ_UI[_hcjL].req : (_stHi ? st.reqHi : st.reqBn);",
  'card: required-reading badge text'),
 ("function getEffectiveLyrics(id) {\n",
  "function getEffectiveLyrics(id) {\n  if (id === 'hcj') {   // Hit Chaurasi Ji follows its own language picker\n    const _hl = hcjLang();\n    if (HCJ_UI[_hl] && typeof HCJ_EXTRA !== 'undefined' && HCJ_EXTRA[_hl]) return HCJ_EXTRA[_hl];\n    if (_hl === 'hi' && typeof LYRICS_HI !== 'undefined' && LYRICS_HI.hcj) return LYRICS_HI.hcj;\n    if (_hl === 'bn' && LYRICS.hcj) return LYRICS.hcj;\n  }\n",
  'reader text by chosen language'),
 ("function _hasTranslationSt(id) {\n  if (TRANSLATION_IDS.includes(id)) return true;",
  "function _hasTranslationSt(id) {\n  if (id === 'hcj' && HCJ_UI[hcjLang()]) return false;   // new languages: verses only, no translation\n  if (TRANSLATION_IDS.includes(id)) return true;",
  'no translation button for the new languages'),
 ("  const n = _stPadKeys(id).length;\n  let icon, txt, col, bd, bg;",
  "  const n = _stPadKeys(id).length;\n  const _u = (id === 'hcj') ? HCJ_UI[hcjLang()] : null;\n  let icon, txt, col, bd, bg;",
  'daily-pad button: language'),
 ("  return '<div id=\"strd' + id + '\" class=\"st-read-status\"",
  "  if (_u) { txt = n >= need ? _u.done : (n > 0 ? _u.part(_hcjNum(n, hcjLang()), _hcjNum(need - n, hcjLang())) : _u.none); }\n  return '<div id=\"strd' + id + '\" class=\"st-read-status\"",
  'daily-pad button: text'),
 ("  const hi = (typeof secLang === 'function') && secLang('sv') === 'hi';\n  el.outerHTML",
  "  const hi = (id === 'hcj') ? hcjLang() === 'hi' : ((typeof secLang === 'function') && secLang('sv') === 'hi');\n  el.outerHTML",
  'daily-pad refresh follows chosen language'),
])

# --- index.html: load hcj-langs.js, bump app.js cache-bust ---
s = rd('index.html')
if 'hcj-langs.js' not in s:
    s, n = re.subn(r'(<script src="\./stotrams\.js\?v=\d+"></script>)', r'\1\n    <script src="./hcj-langs.js?v=1"></script>', s, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND (index.html): stotrams.js script tag')
    s, n = re.subn(r'app\.js\?v=(\d+)', lambda m: 'app.js?v=%d' % (int(m.group(1)) + 1), s, count=1)
    wr('index.html', s); print('index.html\n  patched: hcj-langs.js tag + app.js version bump')
else: print('index.html\n  already applied')

# --- sw.js: cache hcj-langs.js for offline, bump cache name ---
s = rd('sw.js')
if "'./hcj-langs.js'" not in s:
    if "  './stotrams.js',\n" not in s: sys.exit('PATTERN NOT FOUND (sw.js): stotrams.js in precache list')
    s = s.replace("  './stotrams.js',\n", "  './stotrams.js',\n  './hcj-langs.js',\n", 1)
    s, n = re.subn(r"const CACHE = 'radha-jap-v(\d+)';", lambda m: "const CACHE = 'radha-jap-v%d';" % (int(m.group(1)) + 1), s, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND (sw.js): CACHE name')
    wr('sw.js', s); print('sw.js\n  patched: precache hcj-langs.js + cache name bump')
else: print('sw.js\n  already applied')
print('done')
