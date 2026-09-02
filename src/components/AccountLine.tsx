import { accountState } from '../lib/account';
import type { AuthController } from '../hooks/useAuth';

interface AccountLineProps {
  auth: AuthController;
}

/**
 * A line at the foot of the library saying where the songs are kept (ADR-064).
 *
 * Helper text and nothing more: signing in and out is the header's button, in both directions, so
 * this states a fact rather than carrying an action of its own. It says what signing in gets you
 * rather than what not signing in costs — "sign in to sync across devices" is an offer where
 * "songs are saved on this device only" was a complaint.
 *
 * When Firebase is not configured it says nothing at all: there is no offer to make, and stating
 * the limitation would be announcing a problem with no button (ADR-022).
 */
export function AccountLine({ auth }: AccountLineProps) {
  const state = accountState(auth.available, auth.loading, auth.user !== null);

  if (state === 'unavailable') return null;
  if (state === 'checking') return <p className="account">Checking sign-in…</p>;

  if (state === 'signed-in') {
    const name = auth.user?.displayName || auth.user?.email || 'your account';
    return <p className="account">Syncing to {name}</p>;
  }

  return <p className="account">Sign in to sync across devices</p>;
}
