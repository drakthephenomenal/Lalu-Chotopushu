import shutil

def patch(path, old, new, count=1):
    s = open(path, encoding='utf-8').read()
    if new in s:
        print(path, "already patched"); return
    assert s.count(old) == count, (path, s.count(old))
    shutil.copy(path, path + ".bak")
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))
    print(path, "patched")

# 1) Bigger, clearer tip
patch("index.html",
 '<div style="font-size:10.5px;color:var(--td);text-align:center;margin:-2px 0 10px;opacity:.9;line-height:1.4">💡 Tip: Please download backup daily after each session before leaving the app for safety.</div>',
 '<div style="font-size:13.5px;font-weight:600;color:var(--tm,var(--td));text-align:center;margin:2px 0 12px;line-height:1.5;padding:0 4px">💡 Tip: Please tap <b>Download Backup</b> every time after your Naam Jap, before leaving the app. Sometimes server or sync failure can erase your Naam Jap data — so safety first. 🙏</div>')

# 2) Android Chrome/PWA: canShare() rejects application/json files -> fell to download.
old = '''    const file = new File([json], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Radha Naam Jap Backup",
      });
    } else {
      // Browser can't share files — fall back to a normal download.
      await saveJsonFile(filename, json);
    }'''
new = '''    // Android Chrome's canShare() refuses "application/json" files (iOS/Safari
    // accepts them), which made Share silently turn into a download. Try the
    // JSON type first, then text/plain with the same .json name, then share
    // the backup as plain text so a share sheet still opens.
    const _variants = [
      new File([json], filename, { type: "application/json" }),
      new File([json], filename, { type: "text/plain" }),
    ];
    let _shared = false;
    if (navigator.canShare && navigator.share) {
      for (const f of _variants) {
        let ok = false;
        try { ok = navigator.canShare({ files: [f] }); } catch (_e) { ok = false; }
        if (!ok) continue;
        await navigator.share({ files: [f], title: "Radha Naam Jap Backup" });
        _shared = true;
        break;
      }
    }
    if (!_shared && navigator.share) {
      // Last resort before download: share the backup contents as text.
      await navigator.share({ title: "Radha Naam Jap Backup (" + filename + ")", text: json });
      _shared = true;
    }
    if (!_shared) {
      // Browser can't share at all (desktop) — normal download.
      await saveJsonFile(filename, json);
    }'''
patch("app.js", old, new)

# 3) bump SW cache so the fix reaches PWA users
patch("sw.js", "const CACHE = 'radha-jap-v239';", "const CACHE = 'radha-jap-v240';")
