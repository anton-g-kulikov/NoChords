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

function bridge(): { isNativePlatform?: () => boolean; getPlatform?: () => string } | undefined {
  return (globalThis as { Capacitor?: ReturnType<typeof bridge> }).Capacitor;
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
