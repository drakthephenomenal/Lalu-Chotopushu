package app.vercel.radharadharadha.capacitor;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.res.Resources;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.RemoteMessage;

import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;

import java.util.List;
import java.util.Map;

/**
 * Shows server alerts that arrive as DATA-ONLY messages (data.rjapShow == "1") with the same look as the
 * app's own notifications: mono small icon + orange accent + the colour logo as large icon.
 *
 * - App closed / in background: this service builds and shows the notification.
 * - App open (foreground): the message is handed to the Capacitor Firebase Messaging plugin as before,
 *   so the in-app popup + 🔔 list work exactly as they did.
 * - Every other message (broadcasts, per-user pushes that still carry a "notification" block) goes
 *   straight to the plugin's own handler, untouched.
 */
public class RjapMessagingService extends MessagingService {
    private static final String CHANNEL_ID = "rjap_reminders_v2";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> d = message.getData();
        if (d == null || !"1".equals(d.get("rjapShow")) || isAppInForeground()) {
            super.onMessageReceived(message);
            return;
        }
        try {
            show(d);
        } catch (Exception e) {
            super.onMessageReceived(message);   // never lose the alert: fall back to the plugin
        }
    }

    private boolean isAppInForeground() {
        try {
            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
            if (procs == null) return false;
            String pkg = getPackageName();
            for (ActivityManager.RunningAppProcessInfo p : procs) {
                if (pkg.equals(p.processName)) {
                    return p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    private void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;   // the app already created it
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reminders & announcements", NotificationManager.IMPORTANCE_HIGH);
        int tone = ctx.getResources().getIdentifier("reminder_tone", "raw", ctx.getPackageName());
        if (tone != 0) {
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            ch.setSound(Uri.parse("android.resource://" + ctx.getPackageName() + "/" + tone), aa);
        }
        nm.createNotificationChannel(ch);
    }

    private void show(Map<String, String> d) {
        Context ctx = getApplicationContext();
        String title = d.get("title");
        String body = d.get("body");
        String pid = d.get("pid");
        if (title == null || title.isEmpty()) title = "RadhaNaam SudhaRasam";
        if (body == null) body = "";

        ensureChannel(ctx);

        Resources r = ctx.getResources();
        String pkg = ctx.getPackageName();
        int small = r.getIdentifier("ic_notify_color", "drawable", pkg);
        if (small == 0) small = ctx.getApplicationInfo().icon;
        int large = r.getIdentifier("ic_large_notify", "drawable", pkg);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(small)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE);

        if (large != 0) {
            Bitmap bm = BitmapFactory.decodeResource(r, large);
            if (bm != null) b.setLargeIcon(bm);
        }

        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(pkg);
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            b.setContentIntent(PendingIntent.getActivity(ctx, 0, open, flags));
        }

        String tag = (pid != null && !pid.isEmpty()) ? "s:" + pid : "rjap";   // same push never shows twice
        NotificationManagerCompat.from(ctx).notify(tag, tag.hashCode(), b.build());
    }
}
