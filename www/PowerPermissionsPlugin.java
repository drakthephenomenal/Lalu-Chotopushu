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
import android.location.LocationManager;

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
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
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

    /**
     * Checks whether the phone's system-wide Location service (GPS) is
     * currently switched on — separate from the app's own location
     * *permission*, which can be granted while this is still off.
     */
    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        boolean enabled = false;
        if (lm != null) {
            try {
                enabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                        || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            } catch (Exception e) {
                enabled = false;
            }
        }
        JSObject ret = new JSObject();
        ret.put("value", enabled);
        call.resolve(ret);
    }

    /**
     * Opens Android's system Location settings screen directly, so the user
     * doesn't have to hunt for "Settings → Location" themselves. Same
     * simple-intent pattern as the battery/alarm methods above — reliable
     * across OEMs, no Play Services dependency, no activity-result wiring.
     */
    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity available");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            activity.startActivity(intent);
        } catch (Exception e) {
            call.reject("Location settings not available on this device", e);
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        boolean can = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            can = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject ret = new JSObject();
        ret.put("value", can);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestInstallPackagesPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Activity activity = getActivity();
            if (activity == null) {
                call.reject("No activity available");
                return;
            }
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                activity.startActivity(intent);
            } catch (Exception e) {
                call.reject("Install-permission settings not available on this device", e);
                return;
            }
        }
        call.resolve();
    }
}
