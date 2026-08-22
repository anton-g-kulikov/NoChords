interface ImportPromptProps {
  localCount: number;
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
export function ImportPrompt({ localCount, onAccept, onDismiss }: ImportPromptProps) {
  return (
    <div className="import-prompt" role="dialog" aria-label="Bring local songs to your account">
      <div>
        <strong>
          {localCount} song{localCount === 1 ? '' : 's'} on this device
        </strong>
        <p>
          Your account is empty. Copy them up so they follow you to other devices? They stay on this
          device either way.
        </p>
      </div>
      <div className="import-prompt__actions">
        <button type="button" className="button button--primary" onClick={onAccept}>
          Copy to my account
        </button>
        <button type="button" className="button" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
