import re, shutil

def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s):
    shutil.copy(p, p + ".bak2"); open(p, 'w', encoding='utf-8').write(s)

# ---------- index.html ----------
s = rd("index.html")
if 'id="settingsBellBtn"' in s:
    print("index.html already patched")
else:
    # 1) cut the horizontal Notifications card
    m = re.search(r'  <!-- Notification bell — inbox of past pushes, with an unread badge -->\n  <div class="sc".*?\n  </div>\n\n(?=  <!-- GPS Location)', s, re.S)
    assert m, "notif card not found"
    s = s.replace(m.group(0), "")

    # 2) cut the GPS card and re-insert it above the tutorial card
    g = re.search(r'  <!-- GPS Location — at the top for quick access -->\n  <div class="sc".*?\n  </div>\n\n(?=  <!-- SELECT YOUR SAMPRADAY -->)', s, re.S)
    assert g, "gps card not found"
    gps = g.group(0)
    s = s.replace(gps, "")
    t = "  <!-- Tutorial video — a single developer-provided link"
    assert s.count(t) == 1
    s = s.replace(t, gps + t)

    # 3) bell icon at the right corner of the Settings title row
    old = '''    <button class="ms-toggle-btn active" id="setLangBn" onclick="setStotramLang('bn')">বাংলা</button>
  </div>'''
    new = '''    <button class="ms-toggle-btn active" id="setLangBn" onclick="setStotramLang('bn')">বাংলা</button>
    <button type="button" id="settingsBellBtn" class="settings-bell-btn" onclick="rjapOpenNotifHistory()" aria-label="Notifications">🔔<span id="notifBellBadge" class="rjap-badge" style="display:none;"></span></button>
  </div>'''
    assert s.count(old) == 1
    s = s.replace(old, new)
    wr("index.html", s); print("index.html patched")

# ---------- style.css ----------
c = rd("style.css")
if ".settings-bell-btn" in c:
    print("style.css already patched")
else:
    c += '''
/* Settings: notification bell icon at the right corner of the title row */
.vt-row-settings{position:relative;}
.settings-bell-btn{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,215,0,0.3);background:rgba(8,12,35,0.82);color:#FFD700;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;}
.settings-bell-btn .rjap-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;font-size:10px;}
'''
    wr("style.css", c); print("style.css patched")
