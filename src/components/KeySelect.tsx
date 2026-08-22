import { MAJOR_KEYS, MINOR_KEYS } from '../lib/keys';

interface KeySelectProps {
  value: string;
  onChange: (key: string) => void;
  label: string;
  /** Marked as "(original)" in the list, when choosing a display key. */
  originalKey?: string;
}

export function KeySelect({ value, onChange, label, originalKey }: KeySelectProps) {
  const suffix = (key: string) => (key === originalKey ? ' (original)' : '');

  return (
    <label className="field field--narrow">
      <span className="field__label">{label}</span>
      <select
        className="field__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <optgroup label="Major">
          {MAJOR_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
              {suffix(key)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Minor">
          {MINOR_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
              {suffix(key)}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
