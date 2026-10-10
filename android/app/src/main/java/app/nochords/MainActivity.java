package app.nochords;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Before super, so the bridge knows the plugin when the page loads (ADR-109).
        registerPlugin(PageChromePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
