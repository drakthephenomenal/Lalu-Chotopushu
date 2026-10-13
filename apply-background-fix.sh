#!/bin/bash
# Radha Naam Jap — screen-off / background playback fix (native Android + web)
# Run from the REPO ROOT in your Codespace:   bash apply-background-fix.sh
# Safe to run twice (it skips what is already applied).
set -e
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
[ -f app.js ] && [ -f build-android.sh ] || { echo "Run this from the repo root (app.js and build-android.sh must be here)."; exit 1; }

echo "── 1/4  Update repo from GitHub ─────────────────────────────"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --rebase --autostash || echo "  (git pull skipped/failed — continuing with the files you have)"
fi

echo "── 2/4  Native files (android-src/) ─────────────────────────"
mkdir -p android-src
cat > android-src/MediaKeepAliveService.java <<'EOF'
package app.vercel.radharadharadha.capacitor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Foreground "media playback" service. While it runs, Android keeps the app
 * process (and its audio) alive when the screen is off. Started / stopped from
 * JS through MediaKeepAlivePlugin whenever a stotram / pad is playing.
 */
public class MediaKeepAliveService extends Service {
    public static volatile boolean running = false;
    private static final String CHANNEL = "rj_media_playback";
    private PowerManager.WakeLock wl;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = (intent != null && intent.getStringExtra("title") != null)
                ? intent.getStringExtra("title") : "Radha Naam Jap";
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Background playback", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, piFlags);
        Notification.Builder b = (Build.VERSION.SDK_INT >= 26) ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        int icon = getResources().getIdentifier("ic_stat_notify", "drawable", getPackageName());
        if (icon == 0) icon = android.R.drawable.ic_media_play;
        b.setSmallIcon(icon).setContentTitle(title).setContentText("Playing in the background")
         .setContentIntent(pi).setOngoing(true).setCategory(Notification.CATEGORY_TRANSPORT);
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(7411, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(7411, n);
        }
        running = true;
        try {
            if (wl == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RadhaNaamJap:media");
                wl.setReferenceCounted(false);
            }
            if (!wl.isHeld()) wl.acquire(6 * 60 * 60 * 1000L);
        } catch (Exception e) { /* best effort */ }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception e) {}
        try { stopForeground(true); } catch (Exception e) {}
        super.onDestroy();
    }
}
EOF
cat > android-src/MediaKeepAlivePlugin.java <<'EOF'
package app.vercel.radharadharadha.capacitor;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS: Capacitor.Plugins.MediaKeepAlive.start({title}) / .stop() */
@CapacitorPlugin(name = "MediaKeepAlive")
public class MediaKeepAlivePlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), MediaKeepAliveService.class);
            i.putExtra("title", call.getString("title", "Radha Naam Jap"));
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
            else getContext().startService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), MediaKeepAliveService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
EOF
echo "  wrote MediaKeepAliveService.java + MediaKeepAlivePlugin.java"

echo "── 3/4  build-android.sh (manifest + MainActivity + copy files) ──"
python3 - <<'PYEOF'
import re
p = "build-android.sh"
s = open(p, encoding="utf-8", newline="").read()
if "MediaKeepAlivePlugin" in s:
    print("  already patched")
else:
    # (a) manifest step, placed right before step 8/9
    manifest_step = r'''echo "── 7.8/9  Patch AndroidManifest.xml (background playback service) ──"
python3 - << 'PYEOF2'
path = "android/app/src/main/AndroidManifest.xml"
c = open(path).read()
if "MediaKeepAliveService" in c:
    print("  already present")
else:
    perms = ""
    for pm in ["FOREGROUND_SERVICE", "FOREGROUND_SERVICE_MEDIA_PLAYBACK", "WAKE_LOCK", "POST_NOTIFICATIONS"]:
        if ("android.permission." + pm + '"') not in c:
            perms += '    <uses-permission android:name="android.permission.' + pm + '" />\n'
    if "<application" not in c or "</application>" not in c:
        raise SystemExit("AndroidManifest.xml structure unexpected")
    c = c.replace("<application", perms + "    <application", 1)
    svc = '        <service android:name=".MediaKeepAliveService" android:exported="false" android:foregroundServiceType="mediaPlayback" />\n    '
    c = c.replace("</application>", svc + "</application>", 1)
    open(path, "w").write(c)
    print("  added media-playback foreground service + permissions")
PYEOF2

'''
    anchor = 'echo "── 8/9  Patch MainActivity.java'
    assert s.count(anchor) == 1, "anchor 8/9 not found"
    s = s.replace(anchor, manifest_step + anchor, 1)

    # (b) copy the two new java files next to PowerPermissionsPlugin.java
    cp_old = 'echo "  installed PowerPermissionsPlugin.java"\n'
    assert s.count(cp_old) == 1, "PowerPermissions cp line not found"
    cp_new = cp_old + ('cp "android-src/MediaKeepAlivePlugin.java" "$MAIN_ACTIVITY_DIR/MediaKeepAlivePlugin.java"\n'
                       'cp "android-src/MediaKeepAliveService.java" "$MAIN_ACTIVITY_DIR/MediaKeepAliveService.java"\n'
                       'echo "  installed MediaKeepAlivePlugin.java + MediaKeepAliveService.java"\n')
    s = s.replace(cp_old, cp_new, 1)

    # (c) new MainActivity
    m = re.search(r'cat > "\$MAIN_ACTIVITY" << EOF\n.*?\nEOF\n', s, re.S)
    assert m, "MainActivity heredoc not found"
    new_main = '''cat > "$MAIN_ACTIVITY" << EOF
$PKG_LINE

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before super.onCreate().
        registerPlugin(PowerPermissionsPlugin.class);
        registerPlugin(MediaKeepAlivePlugin.class);
        super.onCreate(savedInstanceState);
        WebSettings st = this.bridge.getWebView().getSettings();
        st.setTextZoom(100);
        // Audio / video / YouTube may start by themselves (autoplay) without a fresh tap.
        st.setMediaPlaybackRequiresUserGesture(false);
    }

    // While audio is playing, do not let Android freeze the WebView when the screen turns off.
    private void keepWebViewAlive() {
        try {
            if (MediaKeepAliveService.running && this.bridge != null && this.bridge.getWebView() != null) {
                WebView w = this.bridge.getWebView();
                w.onResume();
                w.resumeTimers();
            }
        } catch (Exception e) { }
    }

    @Override
    public void onPause() {
        super.onPause();
        keepWebViewAlive();
    }

    @Override
    public void onStop() {
        super.onStop();
        keepWebViewAlive();
    }
}
EOF
'''
    s = s[:m.start()] + new_main + s[m.end():]
    open(p, "w", encoding="utf-8", newline="").write(s)
    print("  build-android.sh patched")
PYEOF
bash -n build-android.sh && echo "  build-android.sh syntax OK"

echo "── 4/4  Web files (app.js + sw.js) ──────────────────────────"
python3 - <<'PYEOF'
p = "app.js"
s = open(p, encoding="utf-8", newline="").read()
if "_rjKeepAlive" in s:
    print("  app.js already patched")
else:
    helper = r'''// ── Native keep-alive (Android foreground service) — keeps audio going with the screen off ──
var _rjKAOn = false, _rjKAWatch = 0, _rjKAStopT = 0;
function _rjAnyMediaPlaying() {
  try {
    if (typeof _hcjPlaying !== "undefined" && _hcjPlaying) return true;
    if (typeof _sap !== "undefined" && _sap && (_sap.state === 1 || _sap.state === 3)) return true;
  } catch (_e) {}
  return false;
}
function _rjKeepAlive(on) {
  try {
    var P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.MediaKeepAlive;
    if (!P) return;                                   // web / PWA: nothing to do
    clearTimeout(_rjKAStopT);
    if (on) {
      if (!_rjKAOn) {
        _rjKAOn = true;
        var t = document.getElementById("lmTitle");
        P.start({ title: (t && t.textContent) || "Radha Naam Jap" }).catch(function () { _rjKAOn = false; });
      }
      if (!_rjKAWatch) {
        _rjKAWatch = setInterval(function () {        // stop by itself once nothing is playing any more
          if (!_rjAnyMediaPlaying()) { _rjKeepAlive(false); }
        }, 20000);
      }
    } else {
      _rjKAStopT = setTimeout(function () {           // short delay: verse-to-verse gaps must not stop it
        if (_rjAnyMediaPlaying()) return;
        if (_rjKAOn) { _rjKAOn = false; try { P.stop().catch(function () {}); } catch (_e) {} }
        if (_rjKAWatch) { clearInterval(_rjKAWatch); _rjKAWatch = 0; }
      }, 12000);
    }
  } catch (_e) {}
}
'''
    a1 = "var _hcjMSInited = false;\n"
    assert s.count(a1) == 1, "anchor _hcjMSInited not found (is v174 applied?)"
    s = s.replace(a1, helper + a1, 1)
    a2 = "function _hcjMSUpdate(playing) {\n  try {\n"
    assert s.count(a2) == 1, "anchor _hcjMSUpdate not found"
    s = s.replace(a2, "function _hcjMSUpdate(playing) {\n  try { _rjKeepAlive(!!playing); } catch (_e) {}\n  try {\n", 1)
    a3 = "  const playing = _sap.state === 1 || _sap.state === 3;\n  u.play.textContent = playing ? '⏸' : '▶';"
    assert s.count(a3) == 1, "anchor _sapSync not found"
    s = s.replace(a3, "  const playing = _sap.state === 1 || _sap.state === 3;\n  try { _rjKeepAlive(playing); } catch (_e) {}\n  u.play.textContent = playing ? '⏸' : '▶';", 1)
    open(p, "w", encoding="utf-8", newline="").write(s)
    print("  app.js patched")
q = "sw.js"
w = open(q, encoding="utf-8", newline="").read()
import re
m = re.search(r"const CACHE = 'radha-jap-v(\d+)';", w)
assert m, "CACHE line not found"
if "// v%d: NATIVE BACKGROUND" % (int(m.group(1)) + 1) not in w and "NATIVE BACKGROUND" not in w:
    n = int(m.group(1)) + 1
    w = w.replace(m.group(0), "const CACHE = 'radha-jap-v%d';" % n, 1)
    i = w.index("// v%d:" % int(m.group(1))) if ("// v%d:" % int(m.group(1))) in w else w.index("// v3")
    w = w[:i] + "// v%d: NATIVE BACKGROUND PLAYBACK — Android foreground media service keeps stotram / pad audio playing with the screen off; WebView no longer needs a tap to autoplay.\n" % n + w[i:]
    open(q, "w", encoding="utf-8", newline="").write(w)
    print("  sw.js cache -> v%d" % n)
else:
    print("  sw.js already bumped")
PYEOF
node --check app.js && node --check sw.js && echo "  app.js / sw.js syntax OK"

echo
echo "DONE. Next:"
echo "  git add -A && git commit -m 'Background playback: native media service + autoplay' && git push"
echo "  then run your normal APK build (GitHub Actions 'Build APK' or: bash build-android.sh)"
