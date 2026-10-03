#!/usr/bin/env python3
"""Builds stotram-live/manifest.json from the folders under stotram-live/.

Layout:  stotram-live/<cat>/<slug>/
    lyrics.txt        required  (Bengali script; first paragraph = title)
    lyrics.hi.txt     optional  (Hindi / Devanagari version, same structure)
    meta.json         optional  {"name","sub","nameHi","subHi","paged","flat","order"}
    audio.mp3         optional  one full clip (flat stotrams)
    audio_1.mp3 ...   optional  one clip per verse page (paged stotrams)
<cat> = rv | krishna | shiv | hanuman  (the section it appears in)
<slug> = letters, digits, - or _ only
"""
import os, re, json, hashlib

R = "stotram-live"
CATS = ["rv", "krishna", "shiv", "hanuman"]


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read().replace("\r\n", "\n")


def first_line(text):
    for ln in text.split("\n"):
        ln = ln.strip()
        if ln:
            return ln
    return ""


out = []
if os.path.isdir(R):
    for c in sorted(x for x in os.listdir(R) if os.path.isdir(os.path.join(R, x))):
        if c not in CATS:
            print("warning: unknown category folder '%s' (expected one of %s)" % (c, ", ".join(CATS)))
        for s in sorted(os.listdir(os.path.join(R, c))):
            d = os.path.join(R, c, s)
            if not os.path.isdir(d):
                continue
            if not re.fullmatch(r"[A-Za-z0-9_-]+", s):
                print("skip %s/%s: folder name must use only letters, digits, - or _" % (c, s))
                continue
            lp = os.path.join(d, "lyrics.txt")
            if not os.path.isfile(lp):
                print("skip %s/%s: no lyrics.txt" % (c, s))
                continue
            m = {}
            mp = os.path.join(d, "meta.json")
            if os.path.isfile(mp):
                try:
                    m = json.loads(read(mp))
                except Exception as e:
                    print("warning: bad meta.json in %s/%s (%s) - ignored" % (c, s, e))
            files = sorted(os.listdir(d))
            hp = os.path.join(d, "lyrics.hi.txt")
            has_hi = os.path.isfile(hp)
            pages = sorted(int(mm.group(1)) for f in files for mm in [re.fullmatch(r"audio_(\d+)\.mp3", f)] if mm)
            h = hashlib.sha1()
            for f in files:
                fp = os.path.join(d, f)
                if os.path.isfile(fp):
                    h.update(f.encode("utf-8"))
                    with open(fp, "rb") as fh:
                        h.update(fh.read())
            out.append({
                "_o": (CATS.index(c) if c in CATS else 99, m.get("order", 100), s),
                "id": "L_%s_%s" % (c, s.replace("-", "_")),
                "cat": c,
                "dir": c + "/" + s,
                "name": m.get("name") or first_line(read(lp)) or s,
                "sub": m.get("sub", ""),
                "nameHi": m.get("nameHi") or (first_line(read(hp)) if has_hi else ""),
                "subHi": m.get("subHi", ""),
                "flat": bool(m.get("flat", False)),
                "paged": bool(m.get("paged", False)),
                "hi": has_hi,
                "audio": os.path.isfile(os.path.join(d, "audio.mp3")),
                "pages": pages,
                "v": h.hexdigest()[:8],
            })

out.sort(key=lambda e: e["_o"])
for e in out:
    del e["_o"]
os.makedirs(R, exist_ok=True)
with open(R + "/manifest.json", "w", encoding="utf-8") as f:
    json.dump({"stotrams": out}, f, ensure_ascii=False, indent=2)
print(len(out), "stotram(s)")
