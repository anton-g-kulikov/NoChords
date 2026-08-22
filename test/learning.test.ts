import { describe, expect, it } from 'vitest';
import {
  CONCEALMENT_STAGES,
  concealmentFor,
  collectChordOccurrences,
  createConcealment,
  occurrenceKey,
} from '../src/lib/learning';
import { parseInlineRow } from '../src/lib/inline';
import type { SongRow } from '../src/types/song';

function row(id: string, inline: string): SongRow {
  return { id, ...parseInlineRow(inline), beats: 4, pauseSeconds: 0 };
}

/** Ten chord occurrences spread over three rows. */
const tenChordRows: SongRow[] = [
  row('r1', '[C]la [G]la [Am]la [F]la'),
  row('r2', '[C]la [G]la [Am]la [F]la'),
  row('r3', '[Dm]la [G]la'),
];

describe('concealmentFor', () => {
  it('LN-01 maps playthroughs 0-5 onto the concealment table', () => {
    expect(CONCEALMENT_STAGES).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(concealmentFor(0)).toBe(0);
    expect(concealmentFor(1)).toBe(0.2);
    expect(concealmentFor(2)).toBe(0.4);
    expect(concealmentFor(3)).toBe(0.6);
    expect(concealmentFor(4)).toBe(0.8);
    expect(concealmentFor(5)).toBe(1);
  });

  it('LN-02 stays at 100% for playthrough counts above the table', () => {
    expect(concealmentFor(6)).toBe(1);
    expect(concealmentFor(42)).toBe(1);
  });

  it('treats negative counts as no concealment', () => {
    expect(concealmentFor(-1)).toBe(0);
  });
});

describe('collectChordOccurrences', () => {
  it('LN-03 collects one key per chord, addressed by row and position in the row', () => {
    const occurrences = collectChordOccurrences([row('r1', '[C]a [G]b'), row('r2', '[Am]c')]);
    expect(occurrences).toEqual(['r1:0', 'r1:1', 'r2:0']);
    expect(occurrenceKey('r1', 1)).toBe('r1:1');
  });

  it('LN-04 ignores rows with no chords', () => {
    const occurrences = collectChordOccurrences([
      row('r1', '[C]a'),
      row('r2', 'no chords here'),
      row('r3', ''),
      row('r4', '[G]b'),
    ]);
    expect(occurrences).toEqual(['r1:0', 'r4:0']);
  });

  it('counts repeated chord names as separate occurrences', () => {
    expect(collectChordOccurrences([row('r1', '[G]a [G]b [G]c')])).toHaveLength(3);
  });

  it('LN-10 only ever produces keys for real occurrences', () => {
    const occurrences = collectChordOccurrences(tenChordRows);
    expect(occurrences).toHaveLength(10);
    const concealed = createConcealment(tenChordRows, 3, 1234);
    for (const key of concealed) {
      expect(occurrences).toContain(key);
    }
  });
});

describe('createConcealment', () => {
  it('LN-05 conceals the right number of chords at each stage', () => {
    const sizes = [0, 1, 2, 3, 4, 5].map(
      (playthrough) => createConcealment(tenChordRows, playthrough, 7).size
    );
    expect(sizes).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('LN-06 conceals every occurrence at 100%', () => {
    const all = collectChordOccurrences(tenChordRows);
    const concealed = createConcealment(tenChordRows, 5, 99);
    expect(concealed.size).toBe(all.length);
    for (const key of all) {
      expect(concealed.has(key)).toBe(true);
    }
  });

  it('LN-07 conceals nothing at 0%', () => {
    expect(createConcealment(tenChordRows, 0, 99).size).toBe(0);
  });

  it('LN-08 is stable: the same playthrough seed always yields the same selection', () => {
    const first = createConcealment(tenChordRows, 2, 4242);
    // Re-deriving mid-playthrough (as a scroll re-render would) must not reshuffle.
    for (let i = 0; i < 20; i += 1) {
      const again = createConcealment(tenChordRows, 2, 4242);
      expect([...again].sort()).toEqual([...first].sort());
    }
  });

  it('LN-09 selects a different set for a different playthrough seed', () => {
    const selections = new Set(
      Array.from({ length: 12 }, (_, seed) =>
        [...createConcealment(tenChordRows, 2, seed)].sort().join(',')
      )
    );
    // Not every seed must differ, but the selection must genuinely depend on the seed.
    expect(selections.size).toBeGreaterThan(1);
  });

  it('LN-11 rounds to a whole number of chords for awkward counts', () => {
    const sevenChords = [row('r1', '[C]a [G]b [Am]c [F]d'), row('r2', '[Dm]e [G]f [C]g')];
    expect(collectChordOccurrences(sevenChords)).toHaveLength(7);
    const sizes = [0, 1, 2, 3, 4, 5].map(
      (playthrough) => createConcealment(sevenChords, playthrough, 3).size
    );
    // round(7 * [0, .2, .4, .6, .8, 1]) = [0, 1, 3, 4, 6, 7]
    expect(sizes).toEqual([0, 1, 3, 4, 6, 7]);
  });

  it('handles a song with no chords at all', () => {
    expect(createConcealment([row('r1', 'nothing')], 5, 1).size).toBe(0);
  });
});
