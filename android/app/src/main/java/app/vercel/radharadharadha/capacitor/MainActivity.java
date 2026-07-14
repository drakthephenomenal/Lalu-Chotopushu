package app.vercel.radharadharadha.capacitor;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before super.onCreate().
        registerPlugin(PowerPermissionsPlugin.class);
        super.onCreate(savedInstanceState);
        this.bridge.getWebView().getSettings().setTextZoom(100);

        // NOTE: Exact-alarm scheduling (ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
        // and battery-optimization exemption (ACTION_REQUEST_IGNORE_BATTERY_
        // OPTIMIZATIONS) are intentionally NOT requested here anymore. Firing
        // system permission dialogs before the user has even seen the app is
        // a jarring first-run experience. Both are now user-initiated from
        // inside the app -- Settings -> Preferences -> "Reliable Reminders" --
        // via the PowerPermissions plugin (see PowerPermissionsPlugin.java
        // and the 'exactAlarm' / 'batteryOptim' cases in app.js's tgs()).
        // If the user never opens that screen, reminders still work -- they
        // just may be delayed a little by Doze/OEM battery managers, exactly
        // as before this app requested the exemptions.
    }
}
