#!/usr/bin/env python3
"""fix-boot-mode.py  -  run once from the repo root:  python3 fix-boot-mode.py
Fixes: on reopen (esp. offline) the app first paints Harivangshi (or another default sampraday)
and only shows the real saved mode after you navigate.
Cause: body classes (haridashi-mode, gaudiya-mode ...) were only applied after the slow async startup.
Fix:   remember them in a tiny localStorage key on every save, and apply them in index.html
       the instant <body> exists (before first paint). Safe to run twice."""
import sys

def patch(path, pairs):
    s = open(path, encoding='utf-8').read()
    for old, new, label in pairs:
        if new in s:
            print('  already applied:', label); continue
        if s.count(old) != 1:
            sys.exit('PATTERN NOT FOUND (%s): %s - file changed? send me the file' % (path, label))
        s = s.replace(old, new, 1); print('  patched:', label)
    open(path, 'w', encoding='utf-8').write(s)

HELPER = '''// Remember which sampraday/mode body classes are active, so index.html can apply them before first paint.
function _rjapBootSnap(uid) {
  try {
    const S = (typeof App !== "undefined" && App && App.S) || null;
    if (!S || !uid) return;
    const c = [];
    if (S.gaudiyaMode) c.push("gaudiya-mode");
    if (S.trahimamMode) c.push("trahimam-mode");
    if (S.ramanandiMode) c.push("ramanandi-mode");
    if (S.nimbarkMode) c.push("nimbark-mode");
    if (S.vallabhMode) c.push("vallabh-mode");
    if (isHaridashiActive()) c.push("haridashi-mode");
    if (typeof isRamanuj === "function" && isRamanuj()) c.push("ramanuj-branch");
    localStorage.setItem("rjap_bootClasses", JSON.stringify(c));
  } catch (_e) {}
}
function isHaridashiActive() {'''

print('app.js')
patch('app.js', [
 ('function isHaridashiActive() {', HELPER, 'boot snapshot helper'),
 ('    if (!this._uid) return;\n    this._purgeEmptyKeys(this.S);',
  '    if (!this._uid) return;\n    _rjapBootSnap(this._uid);\n    this._purgeEmptyKeys(this.S);', 'snapshot on every save'),
 ('''    ((App.S.historySS || {})[App.S.tk] || 0) / (App.S.ms || 108),
  );
  if (App.S.gaudiyaMode) document.body.classList.add("gaudiya-mode");''',
  '''    ((App.S.historySS || {})[App.S.tk] || 0) / (App.S.ms || 108),
  );
  // drop any boot-time classes that do not match the loaded account, then re-add the real ones below
  ["gaudiya-mode", "trahimam-mode", "ramanandi-mode", "nimbark-mode", "vallabh-mode"].forEach((c) => document.body.classList.remove(c));
  _rjapBootSnap(App._uid);
  if (App.S.gaudiyaMode) document.body.classList.add("gaudiya-mode");''', 'reconcile after load'),
])

print('index.html')
patch('index.html', [
 ('</head>\n<body>\n',
  '</head>\n<body>\n<script>/* boot-mode: apply last sampraday/mode classes before first paint */try{var _b=JSON.parse(localStorage.getItem("rjap_bootClasses")||"[]");for(var _i=0;_i<_b.length;_i++)document.body.classList.add(_b[_i]);}catch(e){}</script>\n',
  'early body classes'),
 ('<script src="./app.js?v=458"></script>', '<script src="./app.js?v=459"></script>', 'cache-bust app.js'),
])
print('done')
