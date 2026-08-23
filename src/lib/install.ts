/**
 * Whether, and how, to offer installing the app (ADR-029).
 *
 * Browsers stopped prompting on their own: Chrome removed the automatic banner and now only fires
 * `beforeinstallprompt`, leaving it to the page to ask. iOS fires nothing at all — installing is a
 * manual step in the Share menu that the app can only describe.
 */

export type InstallAffordance =
  /** The browser handed us a prompt to fire. Offer a button. */
  | 'prompt'
  /** iOS: no API, so the best we can do is say where the button is. */
  | 'ios-share'
  /** Nothing useful to offer. */
  | 'none';

/** Whether this looks like iOS, where installing is a manual Share-menu step. */
export function isIos(userAgent: string): boolean {
  // iPadOS reports itself as a Mac; the touch points are what give it away, so callers that care
  // pass that in themselves. This is the plain case.
  return /iPhone|iPad|iPod/i.test(userAgent);
}

/**
 * What to show.
 *
 * Already running as an installed app means there is nothing to offer, whatever else is true —
 * that check comes first because a stale `beforeinstallprompt` would otherwise invite someone to
 * install what they are already using.
 */
export function installAffordance(input: {
  standalone: boolean;
  promptAvailable: boolean;
  ios: boolean;
}): InstallAffordance {
  if (input.standalone) return 'none';
  if (input.promptAvailable) return 'prompt';
  return input.ios ? 'ios-share' : 'none';
}
