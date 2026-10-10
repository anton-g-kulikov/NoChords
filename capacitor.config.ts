import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native shells for iOS and Android.
 *
 * Both load the same `dist` the website serves: `npm run build` first, then `npx cap sync` copies
 * it into `ios/` and `android/`. The app id is the reverse of nochords.app, and it is permanent
 * once a build reaches either store.
 */
const config: CapacitorConfig = {
  appId: 'app.nochords',
  appName: 'NoChords',
  webDir: 'dist',
};

export default config;
