/// <reference types="@capacitor-firebase/authentication" />
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
  plugins: {
    /**
     * Native Google sign-in (ADR-101). The plugin only fetches Google's credential; the Firebase JS
     * SDK signs in with it, so the session lives where Firestore already looks for it.
     */
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
  experimental: {
    ios: {
      spm: {
        // Google's sign-in SDK and nothing else: the plugin links Facebook's by default.
        swiftToolsVersion: '6.1',
        packageTraits: { '@capacitor-firebase/authentication': ['Google'] },
        // Avoids a package identity collision with Firebase's own package (plugin issue #959).
        packageOptions: { '@capacitor-firebase/authentication': { symlink: true } },
      },
    },
  },
};

export default config;
