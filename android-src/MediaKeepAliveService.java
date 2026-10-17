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
                ? intent.getStringExtra("title") : "RadhaNaam SudhaRasam";
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
