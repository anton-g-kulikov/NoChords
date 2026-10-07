import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  THEME_COLOR,
  isThemePreference,
  resolveTheme,
  themeAttribute,
} from '../src/lib/theme';

describe('theme', () => {
  it('TH-01 "system" resolves to whatever the device asks for', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('TH-02 a fixed choice wins over the device, both ways', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('TH-03 "system" puts nothing on the page, so the stylesheet follows the device live', () => {
    expect(themeAttribute('system')).toBeNull();
    expect(themeAttribute('light')).toBe('light');
    expect(themeAttribute('dark')).toBe('dark');
  });

  it('TH-04 accepts only the three schemes', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(1)).toBe(false);
  });

  it('TH-05 the page paints the same chrome colours before React as after it', () => {
    // The pre-paint script and the tags cannot import the module, so they repeat its colours.
    const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
    for (const colour of Object.values(THEME_COLOR)) {
      expect(html.split(colour).length - 1).toBeGreaterThanOrEqual(2);
    }
  });
});
