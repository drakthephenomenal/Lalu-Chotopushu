package app.vercel.radharadharadha.capacitor;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS = "radha_jap_prefs";
    private static final String KEY_BATTERY_PROMPTED = "battery_optim_prompted";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        this.bridge.getWebView().getSettings().setTextZoom(100);
        requestExactAlarmPermissionIfNeeded();
        // Battery optimization is intentionally NOT requested here. Firing a
        // second startActivity() immediately after the exact-alarm one (still
        // in onCreate, before the user has even seen the first screen) makes
        // Android collapse it into the generic battery-settings LIST screen
        // instead of the direct "Allow to ignore battery optimizations?"
        // dialog with a one-tap Allow button. Requesting it from onResume()
        // instead means it only fires once you're back from the first
        // screen, so the real dialog shows up correctly.
    }

    @Override
    protected void onResume() {
        super.onResume();
        requestBatteryOptimizationExemptionIfNeeded();
    }

    // Android 12+ (API 31+) requires the user to manually grant exact-alarm
    // scheduling — it is never auto-granted. Without it, the Brahma Muhurta /
    // Sandhya Kal one-shot reminders silently become inexact and can be
    // deferred for hours by Doze, only firing once the device is next used.
    // This surfaces the OS's own permission screen so the user can allow it
    // in one tap; if they decline, reminders will still fire, just not
    // reliably at the exact minute.
    private void requestExactAlarmPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null && !am.canScheduleExactAlarms()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    // Some OEM builds don't expose this settings screen — ignore.
                }
            }
        }
    }

    // Even with exact-alarm permission granted, many OEM battery managers
    // (Xiaomi/MIUI, Vivo, Oppo, Realme and similar) will still delay or kill
    // scheduled alarms unless the app is explicitly exempted from battery
    // optimization. This app is distributed as a direct APK (not via Play
    // Store), so there's no store-policy restriction on asking directly —
    // this shows the standard Android "allow to ignore battery
    // optimizations" dialog in one tap. Only asked once (tracked via
    // SharedPreferences) so it doesn't reprompt on every app resume —
    // whether the user allows or denies, we respect that choice afterward
    // and the in-app settings screen still explains the manual steps.
    private void requestBatteryOptimizationExemptionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (prefs.getBoolean(KEY_BATTERY_PROMPTED, false)) return;

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            } catch (Exception e) {
                // Some OEM builds don't expose this dialog — ignore; the
                // in-app settings screen still explains the manual steps.
            }
        }
        prefs.edit().putBoolean(KEY_BATTERY_PROMPTED, true).apply();
    }
}
