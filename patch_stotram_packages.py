#!/usr/bin/env python3
"""
patch_stotram_packages.py

Reorders STLIST entries in stotrams.js into three packages and tags
each entry with a `pkg` field:

  - Radha Vallabh Sampraday: hcj, rsn, svb, yms, hmg, nmb, blv, dkc, sfv, rks, rdc
  - Krishna Stotram:         nkc, gms, vs2, gg, ach
  - Shiv Stotram:            bss, ans, rds, sps
  - (unassigned):            hnc  -- Hanuman Chalisa was excluded from all
                              three groups per instructions; it's placed
                              last with no `pkg` tag. Edit NEW_ORDER below
                              if it should go somewhere specific.

Run from your repo root:
    python3 patch_stotram_packages.py

It searches a few likely locations for stotrams.js automatically.
Makes a .bak copy before writing.
"""
import re
import sys
from pathlib import Path

# id -> package name, or None to leave untagged
NEW_ORDER = [
    ("hcj", "Radha Vallabh Sampraday"),
    ("rsn", "Radha Vallabh Sampraday"),
    ("svb", "Radha Vallabh Sampraday"),
    ("yms", "Radha Vallabh Sampraday"),
    ("hmg", "Radha Vallabh Sampraday"),
    ("nmb", "Radha Vallabh Sampraday"),
    ("blv", "Radha Vallabh Sampraday"),
    ("dkc", "Radha Vallabh Sampraday"),
    ("sfv", "Radha Vallabh Sampraday"),
    ("rks", "Radha Vallabh Sampraday"),
    ("rdc", "Radha Vallabh Sampraday"),
    ("nkc", "Krishna Stotram"),
    ("gms", "Krishna Stotram"),
    ("vs2", "Krishna Stotram"),
    ("gg",  "Krishna Stotram"),
    ("ach", "Krishna Stotram"),
    ("bss", "Shiv Stotram"),
    ("ans", "Shiv Stotram"),
    ("rds", "Shiv Stotram"),
    ("sps", "Shiv Stotram"),
    ("hnc", None),  # TODO: confirm where Hanuman Chalisa should go
]

CANDIDATE_PATHS = [
    Path("stotrams.js"),
    Path("www/stotrams.js"),
    Path("assets/public/stotrams.js"),
    Path("android/app/src/main/assets/public/stotrams.js"),
]


def find_file():
    for p in CANDIDATE_PATHS:
        if p.exists():
            return p
    print("ERROR: could not find stotrams.js in any of:")
    for p in CANDIDATE_PATHS:
        print(f"  - {p}")
    print("Edit CANDIDATE_PATHS in this script to point at the right file.")
    sys.exit(1)


def main():
    target = find_file()
    text = target.read_text(encoding="utf-8")

    m = re.search(r"const STLIST\s*=\s*\[(.*?)\];", text, re.DOTALL)
    if not m:
        print("ERROR: could not locate 'const STLIST = [ ... ];' block.")
        sys.exit(1)

    body = m.group(1)

    # Each entry is one line: {id:'xxx',name:'...',sub:'...'}
    entry_re = re.compile(r"\{id:'(\w+)'.*?\}", re.DOTALL)
    entries = {}
    for em in entry_re.finditer(body):
        entries[em.group(1)] = em.group(0)

    order_ids = [oid for oid, _ in NEW_ORDER]
    missing = [oid for oid in order_ids if oid not in entries]
    if missing:
        print(f"ERROR: these ids from NEW_ORDER aren't in stotrams.js: {missing}")
        sys.exit(1)

    leftover_ids = [i for i in entries if i not in order_ids]
    if leftover_ids:
        print(f"WARNING: these ids exist in stotrams.js but aren't in NEW_ORDER "
              f"(they'll be appended at the end, untagged): {leftover_ids}")

    def with_pkg(entry_text, pkg):
        if pkg is None:
            return entry_text
        # insert ,pkg:'...' just before the final closing brace
        assert entry_text.rstrip().endswith("}")
        inner = entry_text.rstrip()[:-1].rstrip()
        return inner + f",pkg:'{pkg}'}}"

    new_lines = []
    for oid, pkg in NEW_ORDER:
        new_lines.append("  " + with_pkg(entries[oid], pkg))
    for oid in leftover_ids:
        new_lines.append("  " + entries[oid])

    new_body = "\n" + ",\n".join(new_lines) + "\n"
    new_block = "const STLIST = [" + new_body + "];"

    new_text = text[:m.start()] + new_block + text[m.end():]

    backup = target.with_suffix(target.suffix + ".bak")
    backup.write_text(text, encoding="utf-8")
    target.write_text(new_text, encoding="utf-8")

    print(f"Patched {target} (backup saved to {backup})")
    print(f"Reordered {len(order_ids)} entries into 3 packages.")
    if leftover_ids:
        print(f"Left {leftover_ids} untagged at the end — review manually.")


if __name__ == "__main__":
    main()
