/**
 * Google sign-in (ADR-022).
 *
 * Reports `available: false` when Firebase is not configured, so the UI leaves sign-in out
 * entirely rather than offering a button that cannot work. The SDK itself is fetched lazily
 * (ADR-023), so a signed-out visitor never downloads it.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  isFirebaseConfigured,
  signInWithGoogle,
  signOutNow as signOutRemote,
  watchAuth,
  type AuthUser,
} from '../lib/firebase';

export interface AuthController {
  available: boolean;
  user: AuthUser | null;
  /** True until the first sign-in state is known, so the UI does not flash "signed out". */
  loading: boolean;
  error: string | null;
  signIn(): Promise<void>;
  signOutNow(): Promise<void>;
}

export function useAuth(): AuthController {
  const available = isFirebaseConfigured();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(available);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return undefined;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void watchAuth((next) => {
      if (cancelled) return;
      setUser(next);
      setLoading(false);
    })
      .then((stop) => {
        if (cancelled) stop?.();
        else {
          unsubscribe = stop;
          if (!stop) setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [available]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      const code = (cause as { code?: string })?.code ?? '';
      // Closing the popup is a choice, not a failure worth reporting.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setError(
        code === 'auth/popup-blocked'
          ? 'The sign-in window was blocked. Allow pop-ups for this site and try again.'
          : 'Sign-in failed. Check your connection and try again.'
      );
    }
  }, []);

  const signOutNow = useCallback(async () => {
    try {
      await signOutRemote();
    } catch {
      setError('Could not sign out. Check your connection and try again.');
    }
  }, []);

  return { available, user, loading, error, signIn, signOutNow };
}
