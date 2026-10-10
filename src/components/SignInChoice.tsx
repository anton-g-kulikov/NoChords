import type { SignInProvider } from '../lib/account';

interface SignInChoiceProps {
  /** In the order to offer them: Apple first where it is offered at all (ADR-103). */
  providers: SignInProvider[];
  onChoose: (provider: SignInProvider) => void;
  onDismiss: () => void;
}

/**
 * Which account to sign in with, asked under the header when there is more than one (ADR-103).
 *
 * A card in the library rather than a dialog over it, like the import offer: the app has no
 * overlays, and this is a question about the library it sits in. Each button is drawn the way its
 * owner's guidelines ask, so neither looks like the lesser choice.
 */
export function SignInChoice({ providers, onChoose, onDismiss }: SignInChoiceProps) {
  return (
    <div className="choice-card" role="dialog" aria-label="Sign in">
      <p>Signing in is optional. It keeps your songs in step across your devices.</p>
      <div className="choice-card__actions">
        {providers.map((provider) =>
          provider === 'apple' ? (
            <button
              key={provider}
              type="button"
              className="button signin-choice__button signin-choice__button--apple"
              onClick={() => onChoose(provider)}
            >
              {/* U+F8FF is the Apple logo in Apple's own fonts, which is where this is shown. */}
              <span className="signin-choice__apple-logo" aria-hidden>
                {''}
              </span>
              Sign in with Apple
            </button>
          ) : (
            <button
              key={provider}
              type="button"
              className="button signin-choice__button"
              onClick={() => onChoose(provider)}
            >
              <GoogleLogo />
              Sign in with Google
            </button>
          )
        )}
        <button type="button" className="button choice-card__dismiss" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

/** Google's "G", in its own four colours, as its sign-in branding asks. */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
