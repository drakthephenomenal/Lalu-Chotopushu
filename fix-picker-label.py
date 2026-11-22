#!/usr/bin/env python3
"""fix-picker-label.py - run once from the repo root:  python3 fix-picker-label.py
Adds a small English caption "Select language" above every language picker
(Hit Chaurasi, Chaurasi folder, Phalastuti, Radha Sudha Nidhi).  Safe to run twice."""
import re, sys, os
if not os.path.exists('app.js'): sys.exit('app.js not found - run from the repo root')
s = open('app.js', encoding='utf-8').read()
if 'function hcjLang()' not in s: sys.exit('Run apply-hcj-langs.py first (language pickers are not in app.js yet).')

WRAP = r'''// Small universal caption above the language picker (English, so it reads the same in every language)
function _langPickWrap(selectHtml) {
  return '<div class="lang-pick-wrap" onclick="event.stopPropagation()" style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:3px">' +
    '<span style="font-size:10px;font-weight:600;letter-spacing:0.3px;line-height:1;color:rgba(255,215,0,0.72);font-family:system-ui,-apple-system,\'Segoe UI\',Roboto,sans-serif">Select language</span>' +
    selectHtml + '</div>';
}
'''

if '_langPickWrap' in s:
    print('already applied')
else:
    done = []
    for fn in ('_hcjLangPickerHtml', '_rsnLangPickerHtml'):
        a = s.find('function %s() {' % fn)
        if a < 0:
            if fn == '_hcjLangPickerHtml': sys.exit('PATTERN NOT FOUND: ' + fn)
            continue                      # rsn picker not applied yet: nothing to do for it
        b = s.find('\n}\n', a)
        body = s[a:b]
        nb = body.replace("return '<select", "return _langPickWrap('<select", 1)
        if nb == body or not nb.rstrip().endswith("'</select>';"): sys.exit('PATTERN NOT FOUND (shape of %s changed)' % fn)
        nb = nb.rstrip()[:-len("'</select>';")] + "'</select>');"
        s = s[:a] + nb + s[b:]
        done.append(fn)
    k = s.find('function _hcjLangPickerHtml() {')
    s = s[:k] + WRAP + s[k:]
    # cache-bust
    open('app.js', 'w', encoding='utf-8').write(s)
    h = open('index.html', encoding='utf-8').read()
    h = re.sub(r'app\.js\?v=(\d+)', lambda m: 'app.js?v=%d' % (int(m.group(1)) + 1), h, count=1)
    open('index.html', 'w', encoding='utf-8').write(h)
    print('patched:', ', '.join(done), '+ app.js version bump')
