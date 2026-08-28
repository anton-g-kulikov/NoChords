import { semitonesBetween, transposeKey } from '../lib/keys';

interface KeyStepperProps {
  value: string;
  originalKey: string;
  onChange: (key: string) => void;
}

/**
 * Transposing, as a move up or down rather than a choice from a list (ADR-034).
 *
 * A list invites picking A when the song is in Am, which is not a transposition but a change of
 * mode — and one the chords cannot survive. Minus and plus can only ever move by a semitone, so
 * the mode comes along and the offer to break it is never made.
 */
export function KeyStepper({ value, originalKey, onChange }: KeyStepperProps) {
  const steps = semitonesBetween(originalKey, value);

  return (
    <div className="field field--narrow">
      <span className="field__label">
        Key{steps === 0 ? ' (original)' : ` (${steps > 0 ? '+' : ''}${steps})`}
      </span>
      <div className="stepper">
        <button
          type="button"
          className="stepper__button"
          aria-label="Transpose down a semitone"
          onClick={() => onChange(transposeKey(value, -1))}
        >
          −
        </button>
        <span className="stepper__value" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="stepper__button"
          aria-label="Transpose up a semitone"
          onClick={() => onChange(transposeKey(value, 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}
