import { NumberInput } from './NumberInput';

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
 * A labelled number input. The editing behaviour is `NumberInput`'s (ADR-019).
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
  return (
    <label className={className}>
      <span className="field__label">{label}</span>
      <NumberInput
        value={value}
        min={min}
        max={max}
        step={step}
        onCommit={onCommit}
        aria-label={label}
      />
    </label>
  );
}
