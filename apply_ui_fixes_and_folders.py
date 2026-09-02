#!/usr/bin/env python3
"""
apply_ui_fixes_and_folders.py

Fixes:
  1. Asymmetrical sarga/section picker grid (long Bengali/Sanskrit lines
     overflowing instead of wrapping) — style-stotram.css
  2. Text-size (+/-) control invisible behind the lyric card
     (z-index too low) — style-stotram.css
  3. 108-bead mala ring not re-syncing to the Daily/Lifetime box layout
     when Gaudiya/Trahimam/Ramanandi mode is switched — app.js
  4. Reorganizes the Stotram tab into 5 ordered folders:
       1. রাধা বল্লভ সম্প্রদায় (Radha Vallabh Sampraday)
       2. কৃষ্ণ (Krishna)
       3. ভগবান শিব (Bhagwan Shiv)
       4. ব্রহ্মা মাধ্ব গৌড়ীয় সম্প্রদায় (Brahma Madhva Gaudiya Sampraday) — empty for now
       5. হনুমান জী মহারাজ (Hanuman ji Maharaj)
     — stotrams.js (adds `cat` + reorders) and app.js (renderSt grouping)

Run from the repo root:
    python3 apply_ui_fixes_and_folders.py
"""
import re
import sys

STOTRAMS_JS = "stotrams.js"
APP_JS = "app.js"
STYLE_STOTRAM_CSS = "style-stotram.css"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def must_replace(content, old, new, label):
    if old not in content:
        print(f"  ✗ ANCHOR NOT FOUND for: {label}")
        print("    (file may have changed since this patch was written — aborting)")
        sys.exit(1)
    if content.count(old) > 1:
        print(f"  ⚠ anchor for '{label}' appears more than once — replacing all occurrences")
    return content.replace(old, new)


# ─────────────────────────────────────────────────────────────────
# 1 & 4a. stotrams.js — STLIST: reorder into 5 categories, add `cat`
# ─────────────────────────────────────────────────────────────────
print("[1/4] Reorganizing STLIST into 5 folders (stotrams.js)…")
src = read(STOTRAMS_JS)

m = re.search(r"const STLIST = \[(.*?)\n\];\n", src, re.S)
if not m:
    print("  ✗ Could not locate STLIST array in stotrams.js — aborting.")
    sys.exit(1)
old_block = m.group(0)
body = m.group(1)

# Pull out every {id:'xxx', ...} object literal, keyed by id, verbatim
# (so no Bengali text is retyped — we only reorder + tag with `cat`).
items = {}
for obj_m in re.finditer(r"\{id:'(\w+)',.*?\}", body):
    items[obj_m.group(1)] = obj_m.group(0)

expected_ids = {
    "hcj", "rsn", "svb", "yms", "sfv", "hmg", "blv", "nmb", "dkc", "rks", "rdc",
    "gg", "nkc", "gms", "vs2", "ach",
    "sps", "bss", "ans", "rds",
    "hnc",
}
missing = expected_ids - set(items.keys())
if missing:
    print(f"  ✗ Expected stotram ids missing from STLIST: {sorted(missing)}")
    print("    (STLIST may have changed since this patch was written — aborting)")
    sys.exit(1)

FOLDERS = [
    ("rv", "রাধা বল্লভ সম্প্রদায়",
     ["hcj", "rsn", "svb", "yms", "sfv", "hmg", "blv", "nmb", "dkc", "rks", "rdc"]),
    ("krishna", "কৃষ্ণ",
     ["gg", "nkc", "gms", "vs2", "ach"]),
    ("shiv", "ভগবান শিব",
     ["sps", "bss", "ans", "rds"]),
    ("bmg", "ব্রহ্মা মাধ্ব গৌড়ীয় সম্প্রদায়",
     []),  # blank for now, per request
    ("hanuman", "হনুমান জী মহারাজ",
     ["hnc"]),
]

new_lines = []
for cat_key, _title, ids in FOLDERS:
    for sid in ids:
        obj = items[sid]
        # insert cat:'xxx' right after the id:'...' field
        tagged = re.sub(r"(\{id:'" + sid + r"',)", r"\1cat:'" + cat_key + r"',", obj, count=1)
        new_lines.append("  " + tagged)

new_block = "const STLIST = [\n" + ",\n".join(new_lines) + "\n];\n"
src = src.replace(old_block, new_block)
write(STOTRAMS_JS, src)
print(f"  ✓ STLIST rewritten: {len(items)} stotrams grouped into {len(FOLDERS)} folders.")

# ─────────────────────────────────────────────────────────────────
# 4b. app.js — renderSt(): group cards under folder headers
# ─────────────────────────────────────────────────────────────────
print("[2/4] Adding folder rendering to renderSt() (app.js)…")
app = read(APP_JS)

old_all_and_loop_start = """  const all = [
    ...STLIST,
    ...(App.S.customSt || []).map((x) => ({ ...x, custom: true })),
  ];

  const glowColors = ['#ffd700','#ffaa00','#ff6bff','#00e5ff','#7dff6b','#ff6b6b','#b388ff','#00ffcc','#ffd700','#ff9d00'];

  all.forEach((st, idx) => {"""

new_all_and_loop_start = """  const FOLDERS = [
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

app = must_replace(app, old_all_and_loop_start, new_all_and_loop_start,
                    "renderSt() all[] + forEach start")

old_append = """    list.appendChild(c);
  });
}"""
new_append = """    sectionEl.appendChild(c);
    idx++;
  });
  });
}"""
app = must_replace(app, old_append, new_append, "renderSt() list.appendChild(c) tail")

# renderSt()'s per-card animation vars used `idx` from the old flat forEach —
# with grouping, `idx` is now declared once above and incremented per card
# (see edits above), so the existing lines that read `idx` inside the loop
# keep working unchanged.

write(APP_JS, app)
print("  ✓ renderSt() now renders 5 ordered, collapsible folders.")

# ─────────────────────────────────────────────────────────────────
# 3. app.js — bead ring: always re-sync after mode-switch layout change
# ─────────────────────────────────────────────────────────────────
print("[3/4] Fixing 108-bead ring re-sync on mood switch (app.js)…")
old_bead = """  const moved = slot && card.parentElement !== slot;
  if (moved) slot.appendChild(card);
  // The bead ring (renderBeadFrame) sizes itself off beadFrameWrap's
  // measured rect. Moving the target card can resize that wrap (e.g.
  // Gaudiya mode makes it grid-column:1/-1), so re-render the ring
  // once the browser has reflowed the new layout, or it stays
  // distorted until the next window resize.
  if (moved && typeof renderBeadFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(() => renderBeadFrame()));
  }"""
new_bead = """  const moved = slot && card.parentElement !== slot;
  if (moved) slot.appendChild(card);
  // The bead ring (renderBeadFrame) sizes itself off beadFrameWrap's
  // measured rect. ANY mode switch (Gaudiya/Trahimam/Ramanandi) can
  // resize that wrap — not only when the 28-Names card actually moves
  // slot (e.g. box text/width can change even when the card stays put) —
  // so always re-render the ring once the browser has reflowed the new
  // layout, or it can stay distorted/misaligned until the next window
  // resize. (Previously gated on `moved`, which missed some mode
  // switches and caused the ring to not properly encircle the boxes.)
  if (typeof renderBeadFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(() => renderBeadFrame()));
  }"""
app = read(APP_JS)
app = must_replace(app, old_bead, new_bead, "_placeTarget28Card bead re-render gate")
write(APP_JS, app)
print("  ✓ Bead ring now always re-syncs after any mood/mode switch.")

# ─────────────────────────────────────────────────────────────────
# 2. style-stotram.css — sts-btn-name wrap fix + lyr-fs-ctrl z-index
# ─────────────────────────────────────────────────────────────────
print("[4/4] Fixing CSS: sarga-grid wrap + text-size button z-index…")
css = read(STYLE_STOTRAM_CSS)

old_btn_name = ".sts-btn-name { display: inline-block; }"
new_btn_name = (
    ".sts-btn-name { display: inline-block; overflow-wrap: break-word; "
    "word-break: break-word; }"
)
css = must_replace(css, old_btn_name, new_btn_name, ".sts-btn-name wrap fix")

old_z = "#lyr-fs-ctrl {\n  position:  absolute;\n  top:       calc(max(env(safe-area-inset-top), 10px) + 40px);\n  left:      12px;\n  z-index:   30;"
new_z = "#lyr-fs-ctrl {\n  position:  absolute;\n  top:       calc(max(env(safe-area-inset-top), 10px) + 40px);\n  left:      12px;\n  z-index:   60;"
css = must_replace(css, old_z, new_z, "#lyr-fs-ctrl z-index")

# Folder header / section styling for the new Stotram tab layout
folder_css = """

/* ── Stotram folders (5 categories) ── */
.st-folder-header{display:flex;align-items:center;gap:8px;padding:12px 6px 8px;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.st-folder-header:first-child{padding-top:2px;}
.st-folder-arrow{font-size:12px;color:#ffd700;transition:transform 0.2s ease;display:inline-block;}
.st-folder-arrow.collapsed{transform:rotate(-90deg);}
.st-folder-title{font-family:"Hind Siliguri",serif;font-size:15px;font-weight:700;color:#ffd700;letter-spacing:0.3px;flex:1;}
.st-folder-count{font-size:11px;color:rgba(255,215,0,0.55);background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);border-radius:999px;padding:1px 9px;}
.st-folder-section{display:block;overflow:hidden;}
.st-folder-section.collapsed{display:none;}
.st-folder-empty{font-family:"Hind Siliguri",serif;font-size:13px;color:rgba(255,215,0,0.45);text-align:center;padding:14px 0 18px;}
"""
if ".st-folder-header" not in css:
    css = css.rstrip("\n") + "\n" + folder_css
    print("  ✓ Folder-header CSS appended.")
else:
    print("  · Folder-header CSS already present, skipping.")

write(STYLE_STOTRAM_CSS, css)
print("  ✓ CSS fixes applied.")

print("\nAll patches applied successfully.")
print("Next: bash build-android.sh   (or setup-www.sh + your usual test flow)")
