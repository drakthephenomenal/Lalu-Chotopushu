#!/usr/bin/env python3
"""
Fixes the layout problem in the lifetime breakdown display added by
apply_lifetime_breakdown.py: cramming "(R:324+RV:432+KV:20)" into the same
line as the total number fights for space against the "/ 13Cr" target text,
and will overflow/wrap badly once counts grow into the thousands or lakhs.

FIX: moves the breakdown onto its own dedicated sub-line below each row,
in smaller, lighter text that wraps naturally - same visual pattern the
app already uses elsewhere for secondary detail text. The main total line
stays short and clean regardless of how large the numbers get.

  Row 1:  776 / 13Cr
          R:324 · RV:432 · KV:20        <- new sub-line, smaller text

  Row 2:  7 malas Done
          R:3m · RV:4m · KV:0.19m       <- new sub-line, smaller text

REQUIRES apply_lifetime_breakdown.py to already be applied (this script
checks for its formatLifetimeBreakdown() method and stops with a clear
message if it's missing).

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_lifetime_breakdown_layout_fix.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js/index.html -> *.bak-breakdownlayout first.

After running:
    bash setup-www.sh
    npx cap sync android
    git add app.js www/app.js index.html www/index.html
    git commit -m "Move lifetime breakdown to its own sub-line for better layout"
    git push
"""
import os
import sys

APP_JS_FILES = ["app.js", os.path.join("www", "app.js")]
HTML_FILES = ["index.html", os.path.join("www", "index.html")]

MARKER = "lBreakdownDetail"

OLD_HTML = '''          <div style="display:flex;justify-content:space-between;margin-top:4px;">
            <div class="lbar-val" id="lbarDone">0</div>
            <div class="lbar-val" id="lbarTarget" style="color:var(--td)">/ —</div>
          </div>
          <div class="pd" id="lDet" style="margin-top:2px;">— malas</div>'''

NEW_HTML = '''          <div style="display:flex;justify-content:space-between;margin-top:4px;">
            <div class="lbar-val" id="lbarDone">0</div>
            <div class="lbar-val" id="lbarTarget" style="color:var(--td)">/ —</div>
          </div>
          <div class="pd" id="lBreakdownTotal" style="margin-top:1px;font-size:10px;color:var(--td);opacity:0.85;word-break:break-word;"></div>
          <div class="pd" id="lDet" style="margin-top:4px;">— malas</div>
          <div class="pd" id="lBreakdownDetail" style="margin-top:1px;font-size:10px;color:var(--td);opacity:0.85;word-break:break-word;"></div>'''

OLD_JS = '''    document.getElementById("lbarDone").textContent =
      fmtIN(tot) + " (" + this.formatLifetimeBreakdown(false) + ")";
    document.getElementById("lbarTarget").textContent =
      "/ " + (curLt ? fmtIN(curLt) : "—");
    document.getElementById("lDet").textContent =
      Math.floor(tot / ms) + " (" + this.formatLifetimeBreakdown(true) + ") Done";'''

NEW_JS = '''    document.getElementById("lbarDone").textContent = fmtIN(tot);
    document.getElementById("lbarTarget").textContent =
      "/ " + (curLt ? fmtIN(curLt) : "—");
    const lBreakdownTotalEl = document.getElementById("lBreakdownTotal");
    if (lBreakdownTotalEl) lBreakdownTotalEl.textContent = this.formatLifetimeBreakdown(false).replace(/\\+/g, " · ");
    document.getElementById("lDet").textContent = Math.floor(tot / ms) + " malas Done";
    const lBreakdownDetailEl = document.getElementById("lBreakdownDetail");
    if (lBreakdownDetailEl) lBreakdownDetailEl.textContent = this.formatLifetimeBreakdown(true).replace(/\\+/g, " · ");'''


def die(msg):
    print("ERROR: " + msg)
    sys.exit(1)


def apply_edit(src, old, new, label, filename):
    count = src.count(old)
    if count == 0:
        die(
            f"[{filename}] Anchor for '{label}' not found. This file may "
            "differ from the version this patch was written against - "
            "aborting without changing anything."
        )
    if count > 1:
        die(
            f"[{filename}] Anchor for '{label}' appears {count} times "
            "(expected exactly 1) - aborting without changing anything."
        )
    return src.replace(old, new, 1)


def main():
    print("Checking prerequisite (apply_lifetime_breakdown.py already applied):")
    for path in APP_JS_FILES:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                if "formatLifetimeBreakdown" not in f.read():
                    die(
                        f"{path} does not have formatLifetimeBreakdown() yet. "
                        "Run apply_lifetime_breakdown.py first."
                    )
    print("  confirmed present.")
    print("")

    print("Patching HTML (new sub-line elements):")
    any_applied = False
    for path in HTML_FILES:
        if not os.path.isfile(path):
            print(f"  {path}: not found - skipping.")
            continue
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()
        if MARKER in src:
            print(f"  {path}: already patched - skipping.")
            continue
        src = apply_edit(src, OLD_HTML, NEW_HTML, "add breakdown sub-line elements", path)
        with open(path + ".bak-breakdownlayout", "w", encoding="utf-8") as f:
            f.write(open(path, "r", encoding="utf-8").read())
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)
        print(f"  {path}: patched. Backup: {path}.bak-breakdownlayout")
        any_applied = True

    print("")
    print("Patching app.js (write into new sub-line elements):")
    for path in APP_JS_FILES:
        if not os.path.isfile(path):
            print(f"  {path}: not found - skipping.")
            continue
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()
        if MARKER in src:
            print(f"  {path}: already patched - skipping.")
            continue
        src = apply_edit(src, OLD_JS, NEW_JS, "write breakdown into sub-line elements", path)
        with open(path + ".bak-breakdownlayout", "w", encoding="utf-8") as f:
            f.write(open(path, "r", encoding="utf-8").read())
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)
        print(f"  {path}: patched. Backup: {path}.bak-breakdownlayout")
        any_applied = True

    print("")
    if any_applied:
        print("Next steps:")
        print("   bash setup-www.sh")
        print("   npx cap sync android")
        print("   git add app.js www/app.js index.html www/index.html")
        print('   git commit -m "Move lifetime breakdown to its own sub-line for better layout"')
        print("   git push")
    else:
        print("Nothing to do - already applied everywhere.")


if __name__ == "__main__":
    main()
