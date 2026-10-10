package app.nochords;

import android.app.Activity;
import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the page set the colour behind it and the system bars' icons to match its theme (ADR-108).
 *
 * The window and the web view otherwise keep the platform's own background, which shows wherever
 * the page does not reach: behind the status bar and the navigation bar.
 */
@CapacitorPlugin(name = "PageChrome")
public class PageChromePlugin extends Plugin {

    /** {@code { color: "#rrggbb", dark: boolean }}: the page's background, and whether it is dark. */
    @PluginMethod
    public void setTheme(PluginCall call) {
        final int color;
        try {
            color = Color.parseColor(call.getString("color", ""));
        } catch (IllegalArgumentException e) {
            call.reject("color must be #rrggbb");
            return;
        }
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        final Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            window.getDecorView().setBackgroundColor(color);
            getBridge().getWebView().setBackgroundColor(color);
            // Dark icons on a light page, light icons on a dark one, in both bars.
            WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
            bars.setAppearanceLightStatusBars(!dark);
            bars.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
