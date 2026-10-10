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

/** The accounts someone can sign in with. */
export type SignInProvider = 'apple' | 'google';

/**
 * Which sign-ins to offer on this platform, in the order to offer them (ADR-103).
 *
 * The iOS app offers Apple first: App Review requires it beside Google (guideline 4.8), and Apple's
 * guidelines ask for it to be no less prominent. Elsewhere Apple's sign-in needs a Services ID that
 * is not set up yet, so Google is the only one. With one choice, Sign in goes straight to it.
 */
export function signInProviders(platform: 'ios' | 'android' | 'web'): SignInProvider[] {
  return platform === 'ios' ? ['apple', 'google'] : ['google'];
}

/**
 * What to say when signing in failed, or `null` when there is nothing to say.
 *
 * Backing out is a choice, not a failure worth reporting. On the web that is a closed popup; in the
 * apps the native cancel arrives dressed as one (`firebaseClient.ts`).
 */
export function signInErrorMessage(code: string, provider: SignInProvider): string | null {
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (code === 'auth/popup-blocked') {
    return 'The sign-in window was blocked. Allow pop-ups for this site and try again.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    // One account per email address: an Apple sign-in whose email already belongs to a Google
    // account cannot open it, and the other way round (ADR-103).
    const other = provider === 'apple' ? 'Google' : 'Apple';
    return `That email already has an account through ${other}. Sign in with ${other} instead.`;
  }
  if (provider === 'apple') {
    // Apple gives one error, 1000, for most of what can go wrong, and the usual cause is a phone
    // with no Apple Account signed in: closing iOS's own "sign in to your Apple Account" prompt
    // ends here too.
    return (
      'Sign in with Apple did not finish. Check that this iPhone is signed in to an Apple Account ' +
      'and online, then try again.'
    );
  }
  return 'Sign-in failed. Check your connection and try again.';
}
