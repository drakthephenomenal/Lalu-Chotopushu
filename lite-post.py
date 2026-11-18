import os, json, sys
site = sys.argv[1]
try:
    from PIL import Image
    for f, m in [("www/bhagavadik-bank.png",1024),("www/radha-coin.png",512),("www/icon-512.png",512)]:
        if os.path.exists(f):
            im = Image.open(f); im.thumbnail((m, m), Image.LANCZOS); im.save(f, optimize=True)
except Exception as e:
    print("LITE: image shrink skipped:", e)
dirs = [l.strip() for l in open(".lite-dirs.txt", encoding="utf-8") if l.strip()]
js = open("lite-shim.js", encoding="utf-8").read().replace("__B__", site).replace("__D__", json.dumps(dirs))
p = "www/index.html"
h = open(p, encoding="utf-8").read()
h2 = h.replace("<head>", "<head>\n<script>" + js + "</script>", 1)
assert h2 != h, "no <head> found"
open(p, "w", encoding="utf-8").write(h2)
print("LITE: online-image shim added for", len(dirs), "folders")
