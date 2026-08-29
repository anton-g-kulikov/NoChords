import { useEffect, useRef, useState } from 'react';
import { TEMPO_UNITS, type TempoUnit } from '../lib/tempo';
import { commitValue } from '../lib/numberField';

interface TempoFieldProps {
  value: number;
  unit: TempoUnit;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  onUnitChange: (unit: TempoUnit) => void;
  className?: string;
}

/**
 * Tempo: a number and the note it counts, side by side — `♩. = 60` (ADR-052).
 *
 * The unit sits with the number rather than anywhere else in the form, because the two are one
 * fact: neither half means anything on its own. `120` alone is a question, not a tempo.
 *
 * The value behaves like `NumberField` — the text being typed is the state, so the field can be
 * emptied mid-edit and only a usable number is ever committed (ADR-019).
 */
export function TempoField({
  value,
  unit,
  min,
  max,
  onCommit,
  onUnitChange,
  className = 'field field--tempo',
}: TempoFieldProps) {
  const [text, setText] = useState(() => String(value));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);

  return (
    <div className={className}>
      <span className="field__label">Tempo</span>
      <div className="tempo">
        <select
          className="field__input tempo__unit"
          value={unit}
          aria-label="Tempo unit"
          onChange={(event) => onUnitChange(event.target.value as TempoUnit)}
        >
          {TEMPO_UNITS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.symbol}
            </option>
          ))}
        </select>
        <input
          className="field__input tempo__value"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={text}
          aria-label="Tempo"
          onFocus={() => {
            editing.current = true;
          }}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            const committed = commitValue(raw, min, max);
            if (committed !== null) onCommit(committed);
          }}
          onBlur={() => {
            editing.current = false;
            setText(String(value));
          }}
        />
      </div>
    </div>
  );
}
