import { MAX_TEMPO, MIN_TEMPO } from '../lib/playback';
import { NumberField } from './NumberField';

interface TempoFieldProps {
  value: number;
  onChange: (tempo: number) => void;
}

/**
 * The tempo, as one control used in both modes (ADR-039).
 *
 * It was a number field while editing and a slider while playing, over different ranges — a song
 * written at 30bpm met a slider that began at 40, showed it pinned at the minimum, and moved it on
 * the first drag. One control, one range, and both ways of setting it: drag to find a tempo, type
 * to name one.
 */
export function TempoField({ value, onChange }: TempoFieldProps) {
  return (
    <div className="tempo-field">
      <NumberField
        label="Tempo (bpm)"
        value={value}
        min={MIN_TEMPO}
        max={MAX_TEMPO}
        onCommit={onChange}
      />
      <input
        className="field__range tempo-field__range"
        type="range"
        min={MIN_TEMPO}
        max={MAX_TEMPO}
        value={value}
        aria-label="Tempo in beats per minute"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
