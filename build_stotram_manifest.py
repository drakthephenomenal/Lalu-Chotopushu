#!/usr/bin/env python3
"""Builds stotram-live/manifest.json from the folders under stotram-live/.

Layout:  stotram-live/<cat>/<slug>/
    lyrics.txt        required  (Bengali script; first paragraph = title)
    lyrics.hi.txt     optional  (Hindi / Devanagari version, same structure)
    meta.json         optional  {"name","sub","nameHi","subHi","paged","flat","order"}
    audio.mp3         optional  one full clip (flat stotrams)
    audio_1.mp3 ...   optional  one clip per verse page (paged stotrams)
  TIMED single clip: put ONE audio.mp3 and in meta.json add
    "paged": true, "highlight": true, "marks": [0, "0:14", "0:29.5", 45]
    = start time of each verse (seconds, or "m:ss"). The blue box follows the audio.
  Instead of audio.mp3 you can add  "youtube": "<link or video id>"  to meta.json
    (audio-only playback of that video; needs internet).
<cat> = rv | krishna | shiv | hanuman  (the section it appears in)
<slug> = letters, digits, - or _ only
"""
import os, re, json, hashlib

R = "stotram-live"
CATS = ["rv", "krishna", "shiv", "hanuman"]


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read().replace("\r\n", "\n")


def parse_marks(raw):
    """[0, "0:14", "1:02.5", 75] -> [0.0, 14.0, 62.5, 75.0]; bad input -> []"""
    out = []
    try:
        for x in raw:
            if isinstance(x, (int, float)):
                out.append(float(x))
            else:
                t = str(x).strip()
                sec = 0.0
                for part in t.split(":"):
                    sec = sec * 60 + float(part)
                out.append(sec)
    except Exception:
        return []
    return out


def parse_yt(raw):
    """YouTube link or 11-char id -> video id ('' if not recognised)"""
    t = str(raw or "").strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", t):
        return t
    mm = re.search(r"(?:youtu\.be/|[?&]v=|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})", t)
    return mm.group(1) if mm else ""


def count_verses(text):
    v = [b.strip() for b in re.split(r"\n{2,}", text) if b.strip()]
    if v and len(v[0]) < 100 and not re.search("[\u0964\u0965]", v[0]) and "\u09b6\u09cd\u09b2\u09cb\u0995" not in v[0]:
        v = v[1:]
    return len(v)


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
            yt = parse_yt(m.get("youtube", ""))
            if m.get("youtube") and not yt:
                print("warning: %s/%s has a youtube value I could not read" % (c, s))
            marks = parse_marks(m.get("marks", [])) if (yt or os.path.isfile(os.path.join(d, "audio.mp3"))) else []
            if marks:
                nv = count_verses(read(lp))
                if len(marks) != nv:
                    print("warning: %s/%s has %d marks but %d verses" % (c, s, len(marks), nv))
                if any(b < a for a, b in zip(marks, marks[1:])):
                    print("warning: %s/%s marks are not in increasing order" % (c, s))
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
                "hl": bool(m.get("highlight", False)),
                "hi": has_hi,
                "audio": os.path.isfile(os.path.join(d, "audio.mp3")),
                "pages": pages,
                "marks": marks,
                "yt": yt,
                "v": h.hexdigest()[:8],
            })

out.sort(key=lambda e: e["_o"])
for e in out:
    del e["_o"]
os.makedirs(R, exist_ok=True)
with open(R + "/manifest.json", "w", encoding="utf-8") as f:
    json.dump({"stotrams": out}, f, ensure_ascii=False, indent=2)
print(len(out), "stotram(s)")
