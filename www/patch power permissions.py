import sys

path = "android-src/PowerPermissionsPlugin.java"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

anchor = '''    @PluginMethod
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
}'''

replacement = '''    @PluginMethod
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

    // Added for the Update App feature: lets the Settings screen check
    // whether this app can install APKs, and jump straight to the exact
    // OS screen to grant it if not -- instead of the person having to hunt
    // for "Install unknown apps" / "Other permissions" manually, which
    // varies by manufacturer (stock Android vs MIUI etc.) and is easy to
    // give up looking for.
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
}'''

if anchor not in src:
    print("ERROR: anchor not found -- PowerPermissionsPlugin.java may differ from what was shown in screenshots.")
    sys.exit(1)

src = src.replace(anchor, replacement, 1)
with open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("PowerPermissionsPlugin.java patched successfully.")
