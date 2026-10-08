import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MARK_FLAG, MARK_HEAD, MARK_STEM } from '../src/lib/mark';

const icon = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)), 'utf8');

describe('mark', () => {
  it('MK-01 the header draws the same note the installed icons are made from', () => {
    const { x, y, width, height, rx } = MARK_STEM;
    const stem = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}"/>`;
    for (const name of ['icon.svg', 'icon-maskable.svg', 'icon-apple.svg']) {
      const svg = icon(name);
      expect(svg, name).toContain(`d="${MARK_HEAD}"`);
      expect(svg, name).toContain(stem);
      expect(svg, name).toContain(`d="${MARK_FLAG}"`);
    }
  });
});
