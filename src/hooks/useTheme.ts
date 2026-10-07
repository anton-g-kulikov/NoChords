/**
 * Puts the chosen scheme on the page (ADR-067).
 *
 * The stylesheet does the work: `data-theme` on the root overrides `prefers-color-scheme`, and its
 * absence lets the device decide. This hook only keeps that attribute, and the browser chrome's
 * colour, in step with the setting. The first paint is handled before React by the script in
 * `index.html`, so this never has to correct a flash — only follow a change.
 */
import { useEffect } from 'react';
import { THEME_COLOR, themeAttribute, type Theme, type ThemePreference } from '../lib/theme';

export function useTheme(preference: ThemePreference): void {
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
}
