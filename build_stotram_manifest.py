import hashlib,json,os,re
R="stotram-live";out=[]
for c in sorted(os.listdir(R)) if os.path.isdir(R) else []:
    for s in sorted(os.listdir(f"{R}/{c}")) if c in("rv","krishna","shiv","hanuman") and os.path.isdir(f"{R}/{c}") else []:
        d=f"{R}/{c}/{s}"
        if not os.path.isfile(d+"/lyrics.txt"): continue
        t=open(d+"/lyrics.txt",encoding="utf-8").read()
        m=json.load(open(d+"/meta.json",encoding="utf-8")) if os.path.isfile(d+"/meta.json") else {}
        a=os.path.isfile(d+"/audio.mp3")
        h=hashlib.md5(t.encode());h.update(json.dumps(m,sort_keys=True).encode())
        if a:h.update(str(os.path.getsize(d+"/audio.mp3")).encode())
        f=next((l.strip() for l in t.splitlines() if l.strip()),s)
        out.append({"id":"L_"+re.sub(r"[^A-Za-z0-9_-]","_",s),"cat":c,"dir":c+"/"+s,"name":m.get("name") or f,"sub":m.get("sub",""),"nameHi":m.get("nameHi",""),"subHi":m.get("subHi",""),"flat":bool(m.get("flat",False)),"audio":a,"v":h.hexdigest()[:8]})
os.makedirs(R,exist_ok=True)
json.dump({"stotrams":out},open(R+"/manifest.json","w",encoding="utf-8"),ensure_ascii=False,indent=2)
print(len(out),"stotram(s)")
