/**
 * Light and dark (ADR-067).
 *
 * The choice is a per-device preference like the metronome's volume: a phone on a music stand in a
 * dim room and a laptop at a desk at noon want different answers. "System" is the default and
 * follows the device, which is right for almost everyone; the other two are for the room the
 * device does not know about.
 *
 * Pure: what to apply is decided here, and the hook does the applying.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export const DEFAULT_THEME: ThemePreference = 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** The scheme on screen, given the preference and what the device currently asks for. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * What goes on the root element's `data-theme`.
 *
 * Nothing for "system": the stylesheet already answers `prefers-color-scheme` on its own, so the
 * page follows the device live without a listener — and without JavaScript at all on first paint.
 */
export function themeAttribute(preference: ThemePreference): Theme | null {
  return preference === 'system' ? null : preference;
}

/**
 * The browser chrome's colour for each scheme: the page background, so the status bar and the
 * page read as one surface. Kept in step with `--bg` in `styles.css` and the tags in `index.html`.
 */
export const THEME_COLOR: Record<Theme, string> = {
  light: '#f6f7fa',
  dark: '#12141a',
};
