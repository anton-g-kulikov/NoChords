/**
 * Puts the chosen scheme on the page (ADR-067).
 *
 * The stylesheet does the work: `data-theme` on the root overrides `prefers-color-scheme`, and its
 * absence lets the device decide. This hook only keeps that attribute, and the browser chrome's
 * colour, in step with the setting. The first paint is handled before React by the script in
 * `index.html`, so this never has to correct a flash — only follow a change.
 */
import { useEffect } from 'react';
import {
  THEME_COLOR,
  resolveTheme,
  themeAttribute,
  type Theme,
  type ThemePreference,
} from '../lib/theme';
import { isNative, setPageChrome } from '../lib/native';
import { accentAttribute, type AccentName } from '../lib/accent';

export function useTheme(preference: ThemePreference, accent: AccentName): void {
  // The second ink rides the same mechanism (ADR-072): an attribute the stylesheet answers, absent
  // for the default, and put on before first paint by `index.html`.
  useEffect(() => {
    const attribute = accentAttribute(accent);
    if (attribute) document.documentElement.dataset.accent = attribute;
    else delete document.documentElement.dataset.accent;
  }, [accent]);

  useEffect(() => {
    const root = document.documentElement;
    const attribute = themeAttribute(preference);
    if (attribute) root.dataset.theme = attribute;
    else delete root.dataset.theme;

    // One tag per scheme, each behind its own media query, so "system" needs no listener: the
    // browser picks the matching tag. A fixed choice paints both with the same colour.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      const scheme = meta.dataset.scheme as Theme | undefined;
      if (!scheme) continue;
      meta.content = THEME_COLOR[attribute ?? scheme];
    }
  }, [preference]);

  // The phone apps' shell has no `theme-color` to read, so it is told the resolved theme, and for
  // "system" told again whenever the device switches (ADR-108).
  useEffect(() => {
    if (!isNative()) return undefined;
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => setPageChrome(resolveTheme(preference, query?.matches === true));
    apply();
    if (preference !== 'system' || !query) return undefined;
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [preference]);
}
