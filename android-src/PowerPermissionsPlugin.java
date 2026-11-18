package app.vercel.radharadharadha.capacitor;

import android.app.Activity;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Exposes the two OS-level "reliable reminders" permissions —
 * SCHEDULE_EXACT_ALARM and battery-optimization exemption — to JS so they
 * can be requested on demand (from Settings → Preferences → Reliable
 * Reminders) instead of automatically on first launch.
 *
 * Neither permission is auto-granted by Android; the user must approve each
 * one via its own system dialog. This plugin only opens that dialog when
 * explicitly called from app.js — it never fires on its own.
 */
@CapacitorPlugin(name = "PowerPermissions")
public class PowerPermissionsPlugin extends Plugin {

    private boolean hasManifestPermission(String perm) {
        try {
            android.content.pm.PackageInfo pi = getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS);
            if (pi.requestedPermissions != null) {
                for (String p : pi.requestedPermissions) if (perm.equals(p)) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        boolean ignored = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignored = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("value", ignored);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Activity activity = getActivity();
            if (activity == null) {
                call.reject("No activity available");
                return;
            }
            try {
                // Direct "Allow app to always run in the background?" box (one tap, no hunting through
                // lists) — only possible when the manifest declares REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                // (added by build-android.sh). Without it, fall back to the battery-optimization list.
                Intent intent;
                if (hasManifestPermission("android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS")) {
                    intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                } else {
                    intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                }
                activity.startActivity(intent);
            } catch (Exception e) {
                // Some OEM builds (MIUI/ColorOS/etc.) don't expose this dialog.
                call.reject("Battery optimization settings not available on this device", e);
                return;
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        boolean can = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            can = am != null && am.canScheduleExactAlarms();
        }
        JSObject ret = new JSObject();
        ret.put("value", can);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Activity activity = getActivity();
            if (activity == null) {
                call.reject("No activity available");
                return;
            }
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                activity.startActivity(intent);
            } catch (Exception e) {
                call.reject("Exact alarm settings not available on this device", e);
                return;
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity available");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            activity.startActivity(intent);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + getContext().getPackageName()));
                activity.startActivity(fallback);
            } catch (Exception e2) {
                call.reject("Notification settings not available on this device", e2);
                return;
            }
        }
        call.resolve();
    }
}
