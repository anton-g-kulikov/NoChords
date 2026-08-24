interface ImportPromptProps {
  localCount: number;
  /** Set when a previous attempt left songs behind (ADR-031). */
  error: { missingCount: number } | null;
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * Asked once, when signing in finds songs on the device and nothing in the account (ADR-022).
 *
 * A question rather than a default because both defaults are wrong for someone: uploading silently
 * is wrong on a borrowed phone, and ignoring silently looks like data loss to anyone who has been
 * using the app offline.
 */
export function ImportPrompt({ localCount, error, onAccept, onDismiss }: ImportPromptProps) {
  return (
    <div className="import-prompt" role="dialog" aria-label="Bring local songs to your account">
      <div>
        <strong>
          {localCount} song{localCount === 1 ? '' : 's'} on this device
        </strong>
        {error ? (
          <p className="import-prompt__error">
            {error.missingCount} did not reach your account. They are still on this device — nothing
            was lost. Try again?
          </p>
        ) : (
          <p>
            Your account is empty. Copy them up so they follow you to other devices? They stay on
            this device either way.
          </p>
        )}
      </div>
      <div className="import-prompt__actions">
        <button type="button" className="button button--primary" onClick={onAccept}>
          {error ? 'Try again' : 'Copy to my account'}
        </button>
        <button type="button" className="button" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
