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

/** The header's account button: what it says, and which kind of button it is. */
export interface AccountAction {
  label: string;
  /**
   * Signing in is an invitation and needs its words; signing out is a utility you already know the
   * shape of, and a word for it would weigh as much as the app's own name beside it (ADR-064).
   */
  kind: 'sign-in' | 'sign-out';
}

/** The action the header offers, or `null` when there is none to offer. */
export function accountAction(state: AccountState): AccountAction | null {
  if (state === 'signed-in') return { label: 'Sign out', kind: 'sign-out' };
  if (state === 'signed-out') return { label: 'Sign in', kind: 'sign-in' };
  return null;
}
