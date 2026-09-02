/**
 * What the library should say and offer about the account (ADR-064).
 *
 * One reading of the auth controller, so the header's button and the footer's line cannot disagree
 * about it — which they did: signed in, the header offered nothing and the footer quietly carried
 * the only way out.
 */

export type AccountState =
  /** Firebase is not configured: there is no account to have, and nothing to say about one. */
  | 'unavailable'
  /** The sign-in check has not answered yet. */
  | 'checking'
  | 'signed-in'
  | 'signed-out';

export function accountState(
  available: boolean,
  loading: boolean,
  signedIn: boolean
): AccountState {
  if (!available) return 'unavailable';
  if (loading) return 'checking';
  return signedIn ? 'signed-in' : 'signed-out';
}

/** The label for the header's account button, or `null` when there is no action to offer. */
export function accountActionLabel(state: AccountState): string | null {
  if (state === 'signed-in') return 'Sign out';
  if (state === 'signed-out') return 'Sign in';
  return null;
}
