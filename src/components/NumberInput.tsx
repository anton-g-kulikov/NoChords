import { useEffect, useRef, useState } from 'react';
import { commitValue } from '../lib/numberField';

interface NumberInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (value: number) => void;
  className?: string;
  'aria-label': string;
}

/**
 * A number input that can be emptied (ADR-019).
 *
 * The text being typed is the state and the committed number is derived from it, so clearing the
 * field to type a different number of digits works. A field whose value is only ever the committed
 * number cannot be cleared at all: the first backspace commits nothing, the value re-renders, and
 * the digit comes straight back — which is precisely how the count-in became impossible to change.
 *
 * Leaving it empty restores the last committed value rather than storing a blank.
 */
export function NumberInput({
  value,
  min,
  max,
  step,
  onCommit,
  className = 'field__input',
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const [text, setText] = useState(() => String(value));
  const editing = useRef(false);

  // Take outside changes — another song, a different default — but never mid-edit.
  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);

  return (
    <input
      className={className}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={text}
      aria-label={ariaLabel}
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
  );
}
