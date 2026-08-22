import { useEffect, useRef, useState } from 'react';
import { commitValue } from '../lib/numberField';

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (value: number) => void;
  className?: string;
}

/**
 * A number input that can be emptied.
 *
 * The text being typed is the state and the committed number is derived from it (ADR-019) — the
 * same shape as the song text area. While the field has focus nothing rewrites its contents, so
 * clearing it to type a different number of digits works. Leaving it empty restores the last
 * committed value rather than storing a blank.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
  className = 'field field--narrow',
}: NumberFieldProps) {
  const [text, setText] = useState(() => String(value));
  const editing = useRef(false);

  // Take outside changes — the tempo slider, opening another song — but never mid-edit.
  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);

  return (
    <label className={className}>
      <span className="field__label">{label}</span>
      <input
        className="field__input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={text}
        aria-label={label}
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
          // Empty or out of range on the way out: show what actually took effect.
          setText(String(value));
        }}
      />
    </label>
  );
}
