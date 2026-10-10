import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCKUP_PATHS, MARK_PATHS } from '../src/lib/mark';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('mark', () => {
  it('MK-01 every copy of the note is the one the installed icons are made from', () => {
    for (const name of [
      'public/icons/icon.svg',
      'public/icons/icon-maskable.svg',
      'public/icons/icon-apple.svg',
      // The landing page's favicon is the icon too.
      'site/icon.svg',
    ]) {
      const svg = read(name);
      for (const path of MARK_PATHS) expect(svg, name).toContain(`d="${path}"`);
    }
  });

  it('MK-02 every reference to an icon asks for the same version of it (ADR-075)', () => {
    // A home screen or an installed app only learns of a new drawing through a new URL, so the
    // version is bumped everywhere at once — or some surface keeps the old icon indefinitely.
    const refs = [read('index.html'), read('public/manifest.webmanifest'), read('vite.config.ts')]
      .join('\n')
      .match(/\/icons\/[\w.-]+(\?v=\d+)?/g);
    expect(refs?.length).toBeGreaterThanOrEqual(8);
    const versions = new Set(refs?.map((ref) => ref.split('?v=')[1] ?? 'none'));
    expect([...versions]).toHaveLength(1);
    expect(versions.has('none')).toBe(false);
  });

  it('MK-03 the lockup draws the lighter cut of the same brackets, wherever it appears (ADR-100)', () => {
    // The name in its brackets is set beside type, so its strokes are thinner than the icon's; the
    // app draws them from LOCKUP_PATHS, and the landing page carries its own copy inline.
    const page = read('site/index.html');
    for (const path of LOCKUP_PATHS) expect(page).toContain(`d="${path}"`);
    for (const path of MARK_PATHS) expect(page).not.toContain(`d="${path}"`);
  });
});
