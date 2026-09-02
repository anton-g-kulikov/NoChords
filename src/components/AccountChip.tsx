import type { AuthController } from '../hooks/useAuth';

interface AccountChipProps {
  auth: AuthController;
}

/**
 * The account line, at the foot of the library (ADR-064).
 *
 * It says what signing in *gets* you rather than what not signing in costs you: "sign in to sync
 * across devices" is an offer, where "songs are saved on this device only" was a limitation
 * announced at the top of the screen before a single song. Same fact, and the one place it matters
 * is the moment you wonder whether these songs exist anywhere else — which is after reading them,
 * not before.
 *
 * When Firebase is not configured it says nothing at all: there is no offer to make, and stating
 * the limitation would be back to announcing a problem with no button (ADR-022).
 */
export function AccountChip({ auth }: AccountChipProps) {
  if (!auth.available) return null;

  if (auth.loading) {
    return <p className="account">Checking sign-in…</p>;
  }

  if (auth.user) {
    const name = auth.user.displayName || auth.user.email || 'your account';
    return (
      <p className="account">
        Syncing to {name}
        {' · '}
        <button type="button" className="account__action" onClick={() => void auth.signOutNow()}>
          Sign out
        </button>
      </p>
    );
  }

  return (
    <p className="account">
      <button type="button" className="account__action" onClick={() => void auth.signIn()}>
        Sign in to sync across devices
      </button>
    </p>
  );
}
