/**
 * Google sign-in (ADR-022).
 *
 * Reports `available: false` when Firebase is not configured, so the UI leaves sign-in out
 * entirely rather than offering a button that cannot work. The SDK itself is fetched lazily
 * (ADR-023), so a signed-out visitor never downloads it.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  deleteAccountErrorMessage,
  signInErrorMessage,
  type SignInProvider,
} from '../lib/account';
import {
  deleteAccount as deleteRemoteAccount,
  isFirebaseConfigured,
  signInWith,
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
  /** Something that went right and is worth saying, such as an account deleted. */
  notice: string | null;
  signIn(provider: SignInProvider): Promise<void>;
  signOutNow(): Promise<void>;
  /** Deletes the account and its songs (ADR-105). Resolves true when it is gone. */
  deleteAccount(): Promise<boolean>;
}

export function useAuth(): AuthController {
  const available = isFirebaseConfigured();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(available);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const signIn = useCallback(async (provider: SignInProvider) => {
    setError(null);
    setNotice(null);
    try {
      await signInWith(provider);
    } catch (cause) {
      setError(signInErrorMessage((cause as { code?: string })?.code ?? '', provider));
    }
  }, []);

  const signOutNow = useCallback(async () => {
    try {
      await signOutRemote();
    } catch {
      setError('Could not sign out. Check your connection and try again.');
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      await deleteRemoteAccount();
      setNotice('Your account and its songs are deleted.');
      return true;
    } catch (cause) {
      setError(deleteAccountErrorMessage((cause as { code?: string })?.code ?? ''));
      return false;
    }
  }, []);

  return { available, user, loading, error, notice, signIn, signOutNow, deleteAccount };
}
