#!/usr/bin/env python3
"""
apply_stotram_folder_navigation.py

Replaces the collapsible inline folder-sections UI (from the previous
patch) with a proper two-level navigation, as requested:

  - Stotram tab first shows 5 folder tiles (name + item count), NOT an
    always-expanded/collapsible flat list.
  - Tapping a folder navigates INTO it — shows only that folder's
    stotrams, with a "← ফোল্ডার তালিকা" back button at the top.
  - Tapping back returns to the folder-tile menu.

This is a straight replacement of renderSt()'s body — must be run
AFTER apply_ui_fixes_and_folders.py (it depends on STLIST already
having a `cat` field on every entry).

Run from the repo root:
    python3 apply_stotram_folder_navigation.py
"""
import sys

APP_JS = "app.js"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def must_replace(content, old, new, label):
    if old not in content:
        print(f"  ✗ ANCHOR NOT FOUND for: {label}")
        print("    (has apply_ui_fixes_and_folders.py been run on this file yet?")
        print("     — aborting)")
        sys.exit(1)
    if content.count(old) > 1:
        print(f"  ⚠ anchor for '{label}' appears more than once — replacing all occurrences")
    return content.replace(old, new)


app = read(APP_JS)

print("[1/1] Rewriting renderSt() for two-level folder navigation…")

old = """  const FOLDERS = [
    { key: 'rv',      title: 'রাধা বল্লভ সম্প্রদায়' },
    { key: 'krishna', title: 'কৃষ্ণ' },
    { key: 'shiv',    title: 'ভগবান শিব' },
    { key: 'bmg',     title: 'ব্রহ্মা মাধ্ব গৌড়ীয় সম্প্রদায়' },
    { key: 'hanuman', title: 'হনুমান জী মহারাজ' },
  ];
  window._stFolderCollapsed = window._stFolderCollapsed || {};

  const customItems = (App.S.customSt || []).map((x) => ({ ...x, custom: true }));
  const groups = FOLDERS.map((f) => ({
    ...f,
    items: STLIST.filter((s) => s.cat === f.key),
  }));
  if (customItems.length) {
    groups.push({ key: '__custom', title: 'আমার স্তোত্র', items: customItems });
  }

  const glowColors = ['#ffd700','#ffaa00','#ff6bff','#00e5ff','#7dff6b','#ff6b6b','#b388ff','#00ffcc','#ffd700','#ff9d00'];

  let idx = 0;
  groups.forEach((group) => {
    const folderHeader = document.createElement('div');
    folderHeader.className = 'st-folder-header';
    const collapsed = !!window._stFolderCollapsed[group.key];
    folderHeader.innerHTML =
      '<span class="st-folder-arrow' + (collapsed ? ' collapsed' : '') + '">▾</span>' +
      '<span class="st-folder-title">' + escHtml(group.title) + '</span>' +
      '<span class="st-folder-count">' + group.items.length + '</span>';
    const sectionEl = document.createElement('div');
    sectionEl.className = 'st-folder-section' + (collapsed ? ' collapsed' : '');
    folderHeader.addEventListener('click', () => {
      const nowCollapsed = !sectionEl.classList.contains('collapsed');
      sectionEl.classList.toggle('collapsed', nowCollapsed);
      folderHeader.querySelector('.st-folder-arrow').classList.toggle('collapsed', nowCollapsed);
      window._stFolderCollapsed[group.key] = nowCollapsed;
    });
    list.appendChild(folderHeader);
    list.appendChild(sectionEl);

    if (!group.items.length) {
      const empty = document.createElement('div');
      empty.className = 'st-folder-empty';
      empty.textContent = 'শীঘ্রই আসছে 🙏';
      sectionEl.appendChild(empty);
      return;
    }

  group.items.forEach((st) => {"""

new = """  const FOLDERS = [
    { key: 'rv',      title: 'রাধা বল্লভ সম্প্রদায়', icon: '🪷' },
    { key: 'krishna', title: 'কৃষ্ণ', icon: '🦚' },
    { key: 'shiv',    title: 'ভগবান শিব', icon: '🔱' },
    { key: 'bmg',     title: 'ব্রহ্মা মাধ্ব গৌড়ীয় সম্প্রদায়', icon: '🕉️' },
    { key: 'hanuman', title: 'হনুমান জী মহারাজ', icon: '🚩' },
  ];

  const customItems = (App.S.customSt || []).map((x) => ({ ...x, custom: true }));
  const groups = FOLDERS.map((f) => ({
    ...f,
    items: STLIST.filter((s) => s.cat === f.key),
  }));
  if (customItems.length) {
    groups.push({ key: '__custom', title: 'আমার স্তোত্র', icon: '📝', items: customItems });
  }

  const activeKey = window._stActiveFolder || null;

  // ── Level 1: folder menu (no active folder selected) ──
  if (!activeKey) {
    groups.forEach((group) => {
      const tile = document.createElement('div');
      tile.className = 'st-folder-tile';
      tile.innerHTML =
        '<span class="st-folder-tile-icon">' + group.icon + '</span>' +
        '<span class="st-folder-tile-title">' + escHtml(group.title) + '</span>' +
        '<span class="st-folder-tile-count">' + group.items.length + '</span>' +
        '<span class="st-folder-tile-arrow">›</span>';
      tile.addEventListener('click', () => {
        window._stActiveFolder = group.key;
        renderSt();
      });
      list.appendChild(tile);
    });
    return;
  }

  // ── Level 2: inside a folder — back button + its stotrams ──
  const group = groups.find((g) => g.key === activeKey);
  if (!group) {
    // Folder no longer exists (shouldn't happen) — bail back to menu.
    window._stActiveFolder = null;
    renderSt();
    return;
  }

  const backRow = document.createElement('div');
  backRow.className = 'st-back-row';
  backRow.innerHTML =
    '<button class="st-back-btn">← ফোল্ডার তালিকা</button>' +
    '<span class="st-back-title">' + escHtml(group.title) + '</span>';
  backRow.querySelector('.st-back-btn').addEventListener('click', () => {
    window._stActiveFolder = null;
    renderSt();
  });
  list.appendChild(backRow);

  if (!group.items.length) {
    const empty = document.createElement('div');
    empty.className = 'st-folder-empty';
    empty.textContent = 'শীঘ্রই আসছে 🙏';
    list.appendChild(empty);
    return;
  }

  const glowColors = ['#ffd700','#ffaa00','#ff6bff','#00e5ff','#7dff6b','#ff6b6b','#b388ff','#00ffcc','#ffd700','#ff9d00'];

  let idx = 0;
  group.items.forEach((st) => {"""

app = must_replace(app, old, new, "renderSt() FOLDERS + grouping + loop start")

old_tail = """    sectionEl.appendChild(c);
    idx++;
  });
  });
}"""
new_tail = """    list.appendChild(c);
    idx++;
  });
}"""
app = must_replace(app, old_tail, new_tail, "renderSt() tail (list.appendChild)")

write(APP_JS, app)
print("  ✓ renderSt() now shows a folder menu, with a back button inside each folder.")

# ─────────────────────────────────────────────────────────────────
# CSS: replace collapsible-header styles with tile/back-button styles
# ─────────────────────────────────────────────────────────────────
print("[2/2] Swapping collapsible-folder CSS for tile + back-button CSS…")
STYLE_STOTRAM_CSS = "style-stotram.css"
css = read(STYLE_STOTRAM_CSS)

old_css = """.st-folder-header{display:flex;align-items:center;gap:8px;padding:12px 6px 8px;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.st-folder-header:first-child{padding-top:2px;}
.st-folder-arrow{font-size:12px;color:#ffd700;transition:transform 0.2s ease;display:inline-block;}
.st-folder-arrow.collapsed{transform:rotate(-90deg);}
.st-folder-title{font-family:"Hind Siliguri",serif;font-size:15px;font-weight:700;color:#ffd700;letter-spacing:0.3px;flex:1;}
.st-folder-count{font-size:11px;color:rgba(255,215,0,0.55);background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);border-radius:999px;padding:1px 9px;}
.st-folder-section{display:block;overflow:hidden;}
.st-folder-section.collapsed{display:none;}
.st-folder-empty{font-family:"Hind Siliguri",serif;font-size:13px;color:rgba(255,215,0,0.45);text-align:center;padding:14px 0 18px;}"""

new_css = """.st-folder-tile{display:flex;align-items:center;gap:12px;padding:16px 14px;margin-bottom:10px;background:rgba(0,0,0,0.42);border:1px solid rgba(255,215,0,0.25);border-radius:14px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform 0.15s,border-color 0.15s;}
.st-folder-tile:active{transform:scale(0.98);border-color:rgba(255,215,0,0.55);}
.st-folder-tile-icon{font-size:22px;flex-shrink:0;}
.st-folder-tile-title{font-family:"Hind Siliguri",serif;font-size:15px;font-weight:700;color:#ffd700;letter-spacing:0.3px;flex:1;line-height:1.35;}
.st-folder-tile-count{font-size:11px;color:rgba(255,215,0,0.55);background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);border-radius:999px;padding:2px 9px;flex-shrink:0;}
.st-folder-tile-arrow{font-size:20px;color:rgba(255,215,0,0.45);flex-shrink:0;}
.st-back-row{display:flex;align-items:center;gap:10px;padding:2px 2px 14px;}
.st-back-btn{background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.30);color:#ffd700;font-family:"Hind Siliguri",serif;font-size:13px;font-weight:600;border-radius:10px;padding:8px 14px;cursor:pointer;-webkit-tap-highlight-color:transparent;flex-shrink:0;}
.st-back-btn:active{background:rgba(255,215,0,0.20);}
.st-back-title{font-family:"Hind Siliguri",serif;font-size:15px;font-weight:700;color:#ffd700;letter-spacing:0.3px;flex:1;text-align:right;}
.st-folder-empty{font-family:"Hind Siliguri",serif;font-size:13px;color:rgba(255,215,0,0.45);text-align:center;padding:14px 0 18px;}"""

css = must_replace(css, old_css, new_css, "folder CSS block")
write(STYLE_STOTRAM_CSS, css)
print("  ✓ CSS updated: folder tiles + back button, no collapse/expand styling.")

print("\nDone. Next: rebuild and test — tapping a folder tile should navigate in,")
print("and the back button should return to the folder menu (not a collapse toggle).")
