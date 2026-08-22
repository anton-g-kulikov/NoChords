import type { AuthController } from '../hooks/useAuth';

interface AuthBarProps {
  auth: AuthController;
  storedIn: 'local' | 'cloud';
}

/**
 * Sign-in, and a plain statement of where songs are being kept.
 *
 * Renders nothing when Firebase is not configured (ADR-022) — offering a button that cannot work
 * is worse than not offering one.
 */
export function AuthBar({ auth, storedIn }: AuthBarProps) {
  if (!auth.available) return null;

  return (
    <div className="authbar">
      {auth.loading ? (
        <span className="authbar__status">Checking sign-in…</span>
      ) : auth.user ? (
        <>
          <span className="authbar__status">
            {auth.user.displayName || auth.user.email || 'Signed in'} · songs sync to your account
          </span>
          <button type="button" className="button" onClick={() => void auth.signOutNow()}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <span className="authbar__status">
            {storedIn === 'local' ? 'Songs are saved on this device only' : ''}
          </span>
          <button type="button" className="button" onClick={() => void auth.signIn()}>
            Sign in with Google
          </button>
        </>
      )}
      {auth.error && <p className="authbar__error">{auth.error}</p>}
    </div>
  );
}
