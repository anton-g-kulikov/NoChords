import { Moon, Sun, SunMoon } from 'lucide-react';
import { THEME_PREFERENCES, type ThemePreference } from '../lib/theme';

interface ThemeSwitchProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

const OPTIONS: Record<ThemePreference, { label: string; Icon: typeof Sun }> = {
  system: { label: 'Match the device', Icon: SunMoon },
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
};

/**
 * Three icons, one lit (ADR-067).
 *
 * All three showing rather than one button that cycles: a cycling button hides where it will go
 * next, and "system" is exactly the state nobody can guess from a sun or a moon alone.
 */
export function ThemeSwitch({ value, onChange }: ThemeSwitchProps) {
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Appearance">
      {THEME_PREFERENCES.map((option) => {
        const { label, Icon } = OPTIONS[option];
        const checked = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            className={checked ? 'theme-switch__option theme-switch__option--on' : 'theme-switch__option'}
            onClick={() => onChange(option)}
          >
            <Icon size={15} strokeWidth={1.75} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
