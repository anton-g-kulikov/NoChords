import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MARK_PATHS } from '../src/lib/mark';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('mark', () => {
  it('MK-01 every copy of the note is the one the installed icons are made from', () => {
    for (const name of [
      'public/icons/icon.svg',
      'public/icons/icon-maskable.svg',
      'public/icons/icon-apple.svg',
      // The landing page draws it too: its favicon, and the header mark inline.
      'site/icon.svg',
      'site/index.html',
    ]) {
      const svg = read(name);
      for (const path of MARK_PATHS) expect(svg, name).toContain(`d="${path}"`);
    }
  });
});
