#!/usr/bin/env python3
"""apply-rsn-langs.py - run once from the repo root (needs rsn-langs.js next to it, and apply-hcj-langs.py already applied):
    python3 apply-rsn-langs.py
Adds a language picker to the Sri Radha Sudha Nidhi card (top-right): Bangla, Hindi (as now) + English,
Gujarati, Odia, Punjabi (shlokas only, no meaning).  Patches app.js, index.html, sw.js.  Safe to run twice."""
import os, re, sys

for p in ('app.js', 'index.html', 'sw.js', 'rsn-langs.js'):
    if not os.path.exists(p): sys.exit('missing file: %s  (run from the repo root)' % p)
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s): open(p, 'w', encoding='utf-8').write(s)

s = rd('app.js')
if 'function hcjLang()' not in s:
    sys.exit('Run apply-hcj-langs.py first (the Hit Chaurasi language picker must be in app.js).')

HELPERS = r'''// ── Radha Sudha Nidhi Ji: own reading language. Bangla + Hindi as before; English, Gujarati, Odia, Punjabi = shlokas only (rsn-langs.js -> window.RSN_EXTRA) ──
const RSN_LANGS = [
  { c: 'bn', n: 'বাংলা' }, { c: 'hi', n: 'हिन्दी' }, { c: 'en', n: 'English' },
  { c: 'gu', n: 'ગુજરાતી' }, { c: 'or', n: 'ଓଡ଼ିଆ' }, { c: 'pa', n: 'ਪੰਜਾਬੀ' },
];
const RSN_UI = {
  en: Object.assign({}, HCJ_UI.en, { name: 'Sri Radha Sudha Nidhi', req: '★ Must read — 5 pads daily',
        done: 'Today\'s 5 pads complete', part: (n, r) => n + '/5 read — ' + r + ' to go' }),
  gu: Object.assign({}, HCJ_UI.gu, { name: 'શ્રી રાધા સુધા નિધિ', req: '★ અનિવાર્ય — દરરોજ ૫ પદ',
        done: 'આજના ૫ પદ પૂર્ણ', part: (n, r) => n + '/૫ વાંચ્યા — હજી ' + r + ' બાકી' }),
  or: Object.assign({}, HCJ_UI.or, { name: 'ଶ୍ରୀ ରାଧା ସୁଧା ନିଧି', req: '★ ଅନିବାର୍ଯ୍ୟ — ପ୍ରତିଦିନ ୫ ପଦ',
        done: 'ଆଜିର ୫ ପଦ ସମ୍ପୂର୍ଣ୍ଣ', part: (n, r) => n + '/୫ ପଢ଼ା — ଆଉ ' + r + ' ବାକି' }),
  pa: Object.assign({}, HCJ_UI.pa, { name: 'ਸ਼੍ਰੀ ਰਾਧਾ ਸੁਧਾ ਨਿਧਿ', req: '★ ਲਾਜ਼ਮੀ — ਹਰ ਰੋਜ਼ ੫ ਪਦ',
        done: 'ਅੱਜ ਦੇ ੫ ਪਦ ਪੂਰੇ', part: (n, r) => n + '/੫ ਪੜ੍ਹੇ — ਹੋਰ ' + r + ' ਬਾਕੀ' }),
};
function rsnLang() {
  const o = App && App.S && App.S.secLang && App.S.secLang.rsn;
  if (RSN_LANGS.some((x) => x.c === o)) return o;
  return secLang('sv');
}
function setRsnLang(c) {
  if (!RSN_LANGS.some((x) => x.c === c) || !App || !App.S) return;
  if (!App.S.secLang || typeof App.S.secLang !== 'object') App.S.secLang = {};
  App.S.secLang.rsn = c;
  try { App.save(); } catch (_e) {}
  try { secLangPersistLocal(); } catch (_e) {}
  window._svVI = null;   // verse-search index is rebuilt in the new script
  try { renderSt(); } catch (_e) {}
  try { if (typeof _lcRefreshOpenLyrics === 'function') _lcRefreshOpenLyrics(); } catch (_e) {}
}
function _rsnLangPickerHtml() {
  const cur = rsnLang();
  return '<select class="hcj-lang-sel" aria-label="Language" onclick="event.stopPropagation()" onchange="setRsnLang(this.value)" ' +
    'style="flex-shrink:0;max-width:118px;min-height:38px;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,215,0,0.55);' +
    'background:rgba(255,215,0,0.10);color:#ffd700;font-size:13px;font-weight:700;font-family:\'Hind Siliguri\',sans-serif;color-scheme:dark">' +
    RSN_LANGS.map((x) => '<option value="' + x.c + '"' + (x.c === cur ? ' selected' : '') + '>' + x.n + '</option>').join('') +
    '</select>';
}
'''

def rep(s, old, new, label):
    if new in s: print('  already applied:', label); return s
    if s.count(old) < 1: sys.exit('PATTERN NOT FOUND (app.js): %s - the file changed, send me the file' % label)
    print('  patched:', label); return s.replace(old, new, 1)

print('app.js')
s = rep(s, "function stName(st) {\n  if (st && st.id === 'hcj') {",
  HELPERS + "function stName(st) {\n  if (st && st.id === 'rsn') { const l = rsnLang(); if (RSN_UI[l]) return RSN_UI[l].name; return (l === \"hi\" && st.nameHi) ? st.nameHi : st.name; }\n  if (st && st.id === 'hcj') {",
  'language helpers + card name')
s = rep(s, "function stSub(st) {\n  if (st && st.id === 'hcj') {",
  "function stSub(st) {\n  if (st && st.id === 'rsn') { const l = rsnLang(); if (RSN_UI[l]) return RSN_UI[l].sub; return (l === \"hi\" && st.subHi) ? st.subHi : (st.sub || \"\"); }\n  if (st && st.id === 'hcj') {",
  'card subtitle')
s = rep(s, "    const _hcjL = (st.id === 'hcj') ? hcjLang() : null;",
  "    const _hcjL = (st.id === 'hcj') ? hcjLang() : (st.id === 'rsn') ? rsnLang() : null;\n    const _stUiMap = (st.id === 'rsn') ? RSN_UI : HCJ_UI;",
  'card: language of this stotram')
s = rep(s, "    if (st.id === 'hcj') headerRight = _hcjLangPickerHtml();",
  "    if (st.id === 'hcj') headerRight = _hcjLangPickerHtml();\n    else if (st.id === 'rsn') headerRight = _rsnLangPickerHtml();",
  'card: language picker in the top-right box')
s = rep(s, "(_hcjL && HCJ_UI[_hcjL]) ? HCJ_UI[_hcjL].req", "(_hcjL && _stUiMap[_hcjL]) ? _stUiMap[_hcjL].req", 'card: required-reading badge')
s = rep(s, "((_hcjL && HCJ_UI[_hcjL]) ? HCJ_UI[_hcjL].open", "((_hcjL && _stUiMap[_hcjL]) ? _stUiMap[_hcjL].open", 'card: open button')
s = rep(s, "  if (id === 'hcj' && HCJ_UI[hcjLang()]) return false;",
  "  if (id === 'hcj' && HCJ_UI[hcjLang()]) return false;\n  if (id === 'rsn' && RSN_UI[rsnLang()]) return false;   // new languages: shlokas only, no meaning",
  'no translation button for the new languages')
s = rep(s, "  const _u = (id === 'hcj') ? HCJ_UI[hcjLang()] : null;",
  "  const _u = (id === 'hcj') ? HCJ_UI[hcjLang()] : (id === 'rsn') ? RSN_UI[rsnLang()] : null;\n  const _lg = (id === 'rsn') ? rsnLang() : hcjLang();",
  'daily-pad button: language')
s = rep(s, "_u.part(_hcjNum(n, hcjLang()), _hcjNum(need - n, hcjLang()))", "_u.part(_hcjNum(n, _lg), _hcjNum(need - n, _lg))", 'daily-pad button: numbers')
s = rep(s, "const hi = (id === 'hcj') ? hcjLang() === 'hi' : (",
  "const hi = (id === 'hcj') ? hcjLang() === 'hi' : (id === 'rsn') ? rsnLang() === 'hi' : (", 'daily-pad refresh follows chosen language')
s = rep(s, "  if (id === 'hcj') {   // Hit Chaurasi Ji follows its own language picker",
  "  if (id === 'rsn') {   // Radha Sudha Nidhi follows its own language picker\n"
  "    const _rl = rsnLang();\n"
  "    if (RSN_UI[_rl] && typeof RSN_EXTRA !== 'undefined' && RSN_EXTRA[_rl]) return RSN_EXTRA[_rl];\n"
  "    if (_rl === 'hi') { if (typeof LYRICS_HI !== 'undefined' && LYRICS_HI.rsn) return LYRICS_HI.rsn; if (_rsnHindiLyrics) return _rsnHindiLyrics; }\n"
  "    else if (_rl === 'bn') { const _full = _rsnBnFull(); if (_full) return _full; if (LYRICS.rsn) return LYRICS.rsn; }\n"
  "  }\n"
  "  if (id === 'hcj') {   // Hit Chaurasi Ji follows its own language picker",
  'reader text by chosen language')
s = rep(s, 'if (id === "rsn" && secLang(\'sv\') === "hi" && !_rsnHindiLyrics) {', 'if (id === "rsn" && rsnLang() === "hi" && !_rsnHindiLyrics) {', 'Hindi loader follows picker')
s = rep(s, 'if (id === "rsn" && secLang(\'sv\') !== "hi" && !_rsnHindiLyrics', 'if (id === "rsn" && rsnLang() === "bn" && !_rsnHindiLyrics', 'Bangla loader follows picker')
s = rep(s, "_HI_MEANING_IDS.indexOf(_currentStotramId) !== -1 && secLang('sv') === \"hi\";",
  "_HI_MEANING_IDS.indexOf(_currentStotramId) !== -1 && (_currentStotramId === 'rsn' ? rsnLang() : secLang('sv')) === \"hi\";",
  'Hindi meaning display follows picker')
# pad list label: understand the 'Shloka N:' header word of the new languages
k = s.find('const hm = lines[0] && lines[0].match(')
if k < 0: sys.exit('PATTERN NOT FOUND (app.js): pad list header regex')
old_hdr = '(?:শ্লোক|श्लोक)'
new_hdr = '(?:শ্লোক|श्लोक|Shloka|શ્લોક|ଶ୍ଲୋକ|ਸ਼ਲੋਕ)'
if new_hdr in s[k:k + 300]: print('  already applied: pad list header words')
else:
    j = s.find(old_hdr, k)
    if j < 0 or j - k > 200: sys.exit('PATTERN NOT FOUND (app.js): pad list header words')
    s = s[:j] + new_hdr + s[j + len(old_hdr):]; print('  patched: pad list header words')
wr('app.js', s)

print('index.html')
h = rd('index.html')
if 'rsn-langs.js' not in h:
    h, n = re.subn(r'(<script src="\./hcj-langs\.js\?v=\d+"></script>)', r'\1\n    <script src="./rsn-langs.js?v=1"></script>', h, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND (index.html): hcj-langs.js script tag')
    h = re.sub(r'app\.js\?v=(\d+)', lambda m: 'app.js?v=%d' % (int(m.group(1)) + 1), h, count=1)
    wr('index.html', h); print('  patched: rsn-langs.js tag + app.js version bump')
else: print('  already applied')

print('sw.js')
w = rd('sw.js')
if "'./rsn-langs.js'" not in w:
    if "  './hcj-langs.js',\n" not in w: sys.exit('PATTERN NOT FOUND (sw.js): hcj-langs.js in precache list')
    w = w.replace("  './hcj-langs.js',\n", "  './hcj-langs.js',\n  './rsn-langs.js',\n", 1)
    w, n = re.subn(r"const CACHE = 'radha-jap-v(\d+)';", lambda m: "const CACHE = 'radha-jap-v%d';" % (int(m.group(1)) + 1), w, count=1)
    if n != 1: sys.exit('PATTERN NOT FOUND (sw.js): CACHE name')
    wr('sw.js', w); print('  patched: precache rsn-langs.js + cache name bump')
else: print('  already applied')
print('done')
