import { THEME_COLOR, type Theme } from './theme';

/**
 * Whether the app is running inside its iOS or Android shell rather than in a browser.
 *
 * The shells load the same build the website serves (see `capacitor.config.ts`), so the few things
 * that only make sense on the web — offering to install, a service worker — ask this first.
 *
 * It reads the bridge the shell injects before the page runs instead of importing
 * `@capacitor/core`, which would put 3kB in front of every web visitor to answer a question whose
 * answer for them is always no (ADR-023).
 */
export function isNative(): boolean {
  return bridge()?.isNativePlatform?.() === true;
}

/** Which shell this is, or `web` in a browser. Read from the same bridge, for the same reason. */
export function nativePlatform(): 'ios' | 'android' | 'web' {
  if (!isNative()) return 'web';
  const platform = bridge()?.getPlatform?.();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

/**
 * Tells the shell which theme the page is in, so the colour behind the web view and the system
 * bars' text match it (ADR-108). Native-only: on the web the `theme-color` tags do this job.
 *
 * Without it the shell shows its own background wherever the page does not reach. On iOS 27 that
 * is a white strip under the status bar, in either theme.
 */
export function setPageChrome(theme: Theme): void {
  if (!isNative()) return;
  // Straight through the bridge: `Capacitor.Plugins` is only filled in by `@capacitor/core`'s
  // `registerPlugin`, which the web build deliberately does not load (ADR-099).
  void bridge()
    ?.nativePromise?.('PageChrome', 'setTheme', {
      color: THEME_COLOR[theme],
      dark: theme === 'dark',
    })
    // An older shell without the plugin keeps its own background; nothing worse than before.
    ?.catch(() => {});
}

interface Bridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  nativePromise?: (plugin: string, method: string, options: object) => Promise<unknown>;
}

function bridge(): Bridge | undefined {
  return (globalThis as { Capacitor?: Bridge }).Capacitor;
}

/**
 * Whether a native sign-in failed because the person backed out of it.
 *
 * The plugin reports a cancel as a failure, with only the platform's own words to tell them apart:
 * "The user canceled the sign-in flow." from Google on iOS, "Authorization canceled." or "activity
 * is cancelled by the user." on Android, and from Apple only its error number, `AuthorizationError
 * error 1001`. Backing out is a choice, not something to apologise for.
 */
export function isCancelledSignIn(cause: unknown): boolean {
  const message = (cause as { message?: unknown } | null)?.message;
  return typeof message === 'string' && /cancel|AuthorizationError error 1001\b/i.test(message);
}
