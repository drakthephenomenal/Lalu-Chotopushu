import shutil

def patch(path, old, new, count=1):
    s = open(path, encoding='utf-8').read()
    if new in s:
        print(path, "already patched:", new[:40].strip()); return
    assert s.count(old) == count, (path, old[:50], s.count(old))
    shutil.copy(path, path + ".bak3")
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))
    print(path, "patched:", new[:40].strip())

# 1) Tip text: always pulsing glow
patch("index.html",
 '<div style="font-size:13.5px;font-weight:600;color:var(--tm,var(--td));text-align:center;margin:2px 0 12px;line-height:1.5;padding:0 4px">💡 Tip',
 '<div class="rjap-tip-glow" style="font-size:13.5px;font-weight:600;color:var(--tm,var(--td));text-align:center;margin:2px 0 12px;line-height:1.5;padding:8px 8px">💡 Tip')

# 2) Download Backup button: always pulsing glow
patch("index.html",
 '<button type="button" onclick="exportAllData()" class="premium-btn"',
 '<button type="button" onclick="exportAllData()" class="premium-btn rjap-dl-glow"')

# 3) Restore picker: allow .txt too (Android can only share the backup as .txt)
patch("index.html",
 '<input type="file" accept=".json" style="display:none" onchange="importAllData(this)">',
 '<input type="file" accept=".json,.txt,application/json,text/plain" style="display:none" onchange="importAllData(this)">')

# 4) CSS
css = open("style.css", encoding='utf-8').read()
if ".rjap-dl-glow" in css:
    print("style.css already patched")
else:
    shutil.copy("style.css", "style.css.bak3")
    css += '''

/* ── Always-on pulsing glow: backup tip + Download Backup button ── */
@keyframes rjapGoldPulse{
  0%,100%{box-shadow:0 0 6px rgba(255,215,0,0.30),0 0 14px rgba(255,215,0,0.15);}
  50%{box-shadow:0 0 16px rgba(255,215,0,0.85),0 0 32px rgba(255,215,0,0.45);}
}
@keyframes rjapTextPulse{
  0%,100%{text-shadow:0 0 3px rgba(255,215,0,0.25);}
  50%{text-shadow:0 0 10px rgba(255,215,0,0.95),0 0 18px rgba(255,215,0,0.5);}
}
.rjap-dl-glow{animation:rjapGoldPulse 1.8s ease-in-out infinite !important;
  border-color:rgba(255,215,0,0.75) !important;}
.rjap-tip-glow{border:1px solid rgba(255,215,0,0.45);border-radius:12px;
  animation:rjapGoldPulse 1.8s ease-in-out infinite,rjapTextPulse 1.8s ease-in-out infinite;}
'''
    open("style.css", 'w', encoding='utf-8').write(css)
    print("style.css patched")

# 5) Android Chrome/TWA share: also offer the file as .txt (text/plain), which
#    Chrome on Android accepts for file sharing. Tried after the .json variants.
patch("app.js",
 '''      new File([json], filename, { type: "text/plain" }),
    ];''',
 '''      new File([json], filename, { type: "text/plain" }),
      new File([json], filename.replace(/\\.json$/, "") + ".txt", { type: "text/plain" }),
    ];''')
