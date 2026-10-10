import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACCENTS,
  ACCENT_NAMES,
  DEFAULT_ACCENT,
  accentAttribute,
  isAccentName,
  nextAccent,
} from '../src/lib/accent';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

/** WCAG relative luminance of an sRGB triplet. */
function luminance([r, g, b]: readonly number[]): number {
  const [R, G, B] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hex = (value: string) => [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));

describe('accent', () => {
  it('AC-01 eight inks, and tapping steps through every one and back to the first', () => {
    // Seven modes, then monochrome as the octave (ADR-110).
    expect(ACCENT_NAMES).toHaveLength(8);
    expect(ACCENT_NAMES[ACCENT_NAMES.length - 1]).toBe('mono');
    const seen = [DEFAULT_ACCENT];
    let current = DEFAULT_ACCENT;
    for (let step = 0; step < 7; step += 1) {
      current = nextAccent(current);
      seen.push(current);
    }
    expect(new Set(seen).size).toBe(8);
    expect(nextAccent(current)).toBe(DEFAULT_ACCENT);
  });

  it('AC-02 the default puts nothing on the page; any other ink names itself', () => {
    expect(accentAttribute('vermilion')).toBeNull();
    expect(accentAttribute('indigo')).toBe('indigo');
    expect(isAccentName('teal')).toBe(true);
    expect(isAccentName('chartreuse')).toBe(false);
    expect(isAccentName(undefined)).toBe(false);
  });

  it('AC-03 every ink reads as chord text in both schemes', () => {
    // The page and its lighter sheet, in each scheme.
    const paper = [hex('#f4efe6'), hex('#faf7f1')];
    const night = [hex('#15120e'), hex('#1c1814')];
    for (const name of ACCENT_NAMES) {
      const { light, dark } = ACCENTS[name];
      for (const ground of paper) expect(contrast(light, ground), name).toBeGreaterThanOrEqual(4.5);
      for (const ground of night) expect(contrast(dark, ground), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('AC-04 the stylesheet carries exactly the table, and the default as its fallback', () => {
    const css = read('src/styles.css');
    for (const name of ACCENT_NAMES) {
      const { light, dark } = ACCENTS[name];
      if (name === DEFAULT_ACCENT) {
        expect(css).toContain(`var(--ink-light, ${light.join(', ')})`);
        expect(css).toContain(`var(--ink-dark, ${dark.join(', ')})`);
        expect(css).not.toContain(`[data-accent='${name}']`);
        continue;
      }
      const rule = new RegExp(
        `:root\\[data-accent='${name}'\\] \\{\\s*--ink-light: ${light.join(', ')};\\s*--ink-dark: ${dark.join(', ')};\\s*\\}`
      );
      expect(css, name).toMatch(rule);
    }
  });

  it('AC-05 the pre-paint script puts only the app\'s own inks on the page, never the default (ADR-108)', () => {
    // The script runs before the app and reads storage directly, so it carries its own copy of the
    // list. It has to be the app's list exactly, less the default, which is the page with no
    // attribute at all.
    const listed = /var accents = \[([^\]]*)\]/.exec(read('index.html'))?.[1] ?? '';
    const names = [...listed.matchAll(/'([a-z]+)'/g)].map((match) => match[1]);
    expect(names).toEqual(ACCENT_NAMES.filter((name) => name !== DEFAULT_ACCENT));
  });
});
