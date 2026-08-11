#!/usr/bin/env python3
"""
Adds a per-category breakdown to the main Jap screen's LIFETIME card:

  Row 1 (was):  776 / 13Cr
  Row 1 (now):  776 (R:324+RV:432+KV:20) / 13Cr

  Row 2 (was):  7 malas done
  Row 2 (now):  7 (R:3m+RV:4m+KV:0.19m) Done

The category ORDER changes based on the currently active jap mode - the
active mode's category always appears first:
  Radha mode (default): R:...+RV:...+KV:...
  RV mode:               RV:...+R:...+KV:...
  KV mode:               KV:...+R:...+RV:...
Any other active mode (HK/SS/Ram, which track separately and aren't part
of this combined R+RV+KV lifetime total) falls back to the default
R+RV+KV order, unchanged from before.

USAGE (run from your repo root, e.g. ~/Lalu-Chotopushu):
    python3 apply_lifetime_breakdown.py

Safe to re-run: detects if already applied and exits without touching
your files again. Backs up app.js -> app.js.bak-lifetimebreakdown first.

After running:
    bash setup-www.sh
    npx cap sync android
    git add app.js www/app.js
    git commit -m "Add per-category breakdown to lifetime jap display"
    git push
"""
import os
import sys

APP_JS_FILES = ["app.js", os.path.join("www", "app.js")]
MARKER = "getLifetimeTargetBreakdown"

OLD_METHOD = '''  getLifetimeTargetTotal() {
    const radhaTotal = Math.max(
      0,
      Object.values(this.S.history || {}).reduce((a, b) => a + b, 0) -
        (this.S.nameJapDeduct || 0),
    );
    const rvTotal = Math.max(
      0,
      Object.values(this.S.historyRV || {}).reduce((a, b) => a + b, 0) -
        (this.S.nameJapDeductRV || 0),
    );
    const kvTotal = Math.max(
      0,
      Object.values(this.S.historyKV || {}).reduce((a, b) => a + b, 0) -
        (this.S.nameJapDeductKV || 0),
    );
    return radhaTotal + rvTotal + kvTotal;
  },'''

NEW_METHOD = '''  getLifetimeTargetTotal() {
    return this.getLifetimeTargetBreakdown().total;
  },

  // -- Per-category breakdown of the combined R+RV+KV lifetime total --
  // (HK/SS/Ram track separately and are intentionally not part of this
  // combined total, same as before this method existed.)
  getLifetimeTargetBreakdown() {
    const radhaTotal = Math.max(
      0,
      Object.values(this.S.history || {}).reduce((a, b) => a + b, 0) -
        (this.S.nameJapDeduct || 0),
    );
    const rvTotal = Math.max(
      0,
      Object.values(this.S.historyRV || {}).reduce((a, b) => a + b, 0) -
        (this.S.nameJapDeductRV || 0),
    );
    const kvTotal = Math.max(
      0,
      Object.values(this.S.historyKV || {}).reduce((a, b) => a + b, 0) -
        (this.S.nameJapDeductKV || 0),
    );
    return {
      radha: radhaTotal,
      rv: rvTotal,
      kv: kvTotal,
      total: radhaTotal + rvTotal + kvTotal,
    };
  },

  // -- Format the breakdown as "R:324+RV:432+KV:20"-style text, with the
  // currently active jap mode's category listed first. `perMala` divides
  // each category's count by mala size and shows up to 2 decimals (for
  // the "malas done" row); otherwise shows the raw counts (total row).
  formatLifetimeBreakdown(perMala) {
    const b = this.getLifetimeTargetBreakdown();
    const ms = this.S.ms || 108;
    const parts = {
      R: perMala ? (b.radha / ms).toFixed(2).replace(/\\.00$/, "") + "m" : fmtIN(b.radha),
      RV: perMala ? (b.rv / ms).toFixed(2).replace(/\\.00$/, "") + "m" : fmtIN(b.rv),
      KV: perMala ? (b.kv / ms).toFixed(2).replace(/\\.00$/, "") + "m" : fmtIN(b.kv),
    };
    let order = ["R", "RV", "KV"];
    if (this.S.japMode === "rv") order = ["RV", "R", "KV"];
    else if (this.S.japMode === "kv") order = ["KV", "R", "RV"];
    return order.map((k) => k + ":" + parts[k]).join("+");
  },'''

OLD_DISPLAY = '''    document.getElementById("lbarDone").textContent = fmtIN(tot);
    document.getElementById("lbarTarget").textContent =
      "/ " + (curLt ? fmtIN(curLt) : "—");
    document.getElementById("lDet").textContent =
      Math.floor(tot / ms) + " malas done";'''

NEW_DISPLAY = '''    document.getElementById("lbarDone").textContent =
      fmtIN(tot) + " (" + this.formatLifetimeBreakdown(false) + ")";
    document.getElementById("lbarTarget").textContent =
      "/ " + (curLt ? fmtIN(curLt) : "—");
    document.getElementById("lDet").textContent =
      Math.floor(tot / ms) + " (" + this.formatLifetimeBreakdown(true) + ") Done";'''


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
    print("Patching lifetime jap breakdown display:")
    any_applied = False
    for path in APP_JS_FILES:
        if not os.path.isfile(path):
            print(f"  {path}: not found - skipping.")
            continue

        with open(path, "r", encoding="utf-8") as f:
            src = f.read()

        if MARKER in src:
            print(f"  {path}: already patched - skipping.")
            continue

        src = apply_edit(src, OLD_METHOD, NEW_METHOD, "add breakdown methods", path)
        src = apply_edit(src, OLD_DISPLAY, NEW_DISPLAY, "use breakdown in display", path)

        with open(path + ".bak-lifetimebreakdown", "w", encoding="utf-8") as f:
            f.write(open(path, "r", encoding="utf-8").read())

        with open(path, "w", encoding="utf-8") as f:
            f.write(src)

        print(f"  {path}: patched. Backup: {path}.bak-lifetimebreakdown")
        any_applied = True

    print("")
    if any_applied:
        print("Next steps:")
        print("   bash setup-www.sh")
        print("   npx cap sync android")
        print("   git add app.js www/app.js")
        print('   git commit -m "Add per-category breakdown to lifetime jap display"')
        print("   git push")
    else:
        print("Nothing to do - already applied everywhere.")


if __name__ == "__main__":
    main()
