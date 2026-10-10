import { useState } from 'react';
import type { SignInProvider } from '../lib/account';

interface AccountCardProps {
  email: string | null;
  provider: SignInProvider | null;
  /** How many songs the account holds, to say what deleting it takes with it. */
  songCount: number;
  onSignOut: () => void;
  /** Resolves true when the account is gone. */
  onDelete: () => Promise<boolean>;
  onClose: () => void;
}

/**
 * The signed-in account: who it is, signing out, and deleting it (ADR-105).
 *
 * Under the header, like the sign-in choice it replaces once someone is in. Deleting asks first,
 * in the card, naming what goes, and then the platform asks once more by signing in again: a
 * deletion that cannot be undone should need more than one tap from whoever holds the phone.
 */
export function AccountCard({
  email,
  provider,
  songCount,
  onSignOut,
  onDelete,
  onClose,
}: AccountCardProps) {
  const [step, setStep] = useState<'account' | 'confirm' | 'deleting'>('account');
  const via = provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : null;
  const songs = `${songCount} song${songCount === 1 ? '' : 's'}`;

  if (step === 'account') {
    return (
      <div className="choice-card" role="dialog" aria-label="Account">
        <p>
          Signed in{via ? ` with ${via}` : ''}
          {email ? (
            <>
              {' '}
              as <strong className="choice-card__who">{email}</strong>
            </>
          ) : null}
          .
        </p>
        <div className="choice-card__actions">
          <button type="button" className="button" onClick={onSignOut}>
            Sign out
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={() => setStep('confirm')}
          >
            Delete account
          </button>
          <button type="button" className="button choice-card__dismiss" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const deleting = step === 'deleting';
  return (
    <div className="choice-card" role="alertdialog" aria-label="Delete your account">
      <div>
        <strong>Delete your account?</strong>
        <p>
          This deletes your account and the {songs} in it, on every device, for good. Songs kept
          only on this device stay. {via ? `${via} will` : 'You will'} ask you to sign in once more
          to confirm.
        </p>
      </div>
      <div className="choice-card__actions">
        <button
          type="button"
          className="button button--danger"
          disabled={deleting}
          onClick={() => {
            setStep('deleting');
            void onDelete().then((gone) => {
              // Gone, the card goes with the account; otherwise the error says why, from here.
              if (!gone) setStep('confirm');
            });
          }}
        >
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
        <button
          type="button"
          className="button choice-card__dismiss"
          disabled={deleting}
          onClick={() => setStep('account')}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
