import { describe, expect, it } from 'vitest';
import {
  LEARNING_LEVELS,
  MAX_LEVEL,
  collectChordOccurrences,
  createConcealment,
  firstChordOccurrences,
  levelFor,
  occurrenceKey,
  ruleFor,
  sectionsOf,
} from '../src/lib/learning';
import { parseInlineRow } from '../src/lib/inline';
import type { SongRow } from '../src/types/song';

function row(id: string, inline: string): SongRow {
  return { id, ...parseInlineRow(inline) };
}

/** Ten chord occurrences spread over three rows. */
const tenChordRows: SongRow[] = [
  row('r1', '[C]la [G]la [Am]la [F]la'),
  row('r2', '[C]la [G]la [Am]la [F]la'),
  row('r3', '[Dm]la [G]la'),
];

/** A verse and a chorus, then both again — the shape the first level is built around. */
const verseChorusVerse: SongRow[] = [
  row('v1a', '[C]la [G]la [Am]la [F]la'),
  row('v1b', '[C]la [G]la [Am]la [F]la'),
  row('gap1', ''),
  row('c1', '[Dm]la [G]la'),
  row('gap2', ''),
  row('v2a', '[C]la [G]la [Am]la [F]la'),
  row('v2b', '[C]la [G]la [Am]la [F]la'),
  row('gap3', ''),
  row('c2', '[Dm]la [G]la'),
];

describe('levels', () => {
  it('LN-01 advances a level per playthrough and then saturates', () => {
    expect(MAX_LEVEL).toBe(3);
    expect([0, 1, 2].map(levelFor)).toEqual([1, 2, 3]);
  });

  it('LN-02 stays at the last level for counts beyond it', () => {
    expect(levelFor(3)).toBe(3);
    expect(levelFor(42)).toBe(3);
    // Songs carrying a count from the six-stage table land on the last level, not off the end.
    expect(levelFor(5)).toBe(3);
  });

  it('treats negative counts as the first level', () => {
    expect(levelFor(-1)).toBe(1);
  });

  it('LN-15 keeps opening chords until the last level (ADR-013)', () => {
    expect(LEARNING_LEVELS.map((rule) => rule.concealFirst)).toEqual([false, false, true]);
    expect(ruleFor(1).fresh).toBe(0);
    expect(ruleFor(2).fresh).toBe(0.5);
    expect(ruleFor(3).fresh).toBe(0.8);
    // Out-of-range levels clamp rather than crash.
    expect(ruleFor(0)).toBe(ruleFor(1));
    expect(ruleFor(9)).toBe(ruleFor(3));
  });
});

describe('sectionsOf', () => {
  it('LN-16 splits the song at its blank lines', () => {
    const sections = sectionsOf(verseChorusVerse);
    expect(sections.map((section) => section.map((r) => r.id))).toEqual([
      ['v1a', 'v1b'],
      ['c1'],
      ['v2a', 'v2b'],
      ['c2'],
    ]);
  });

  it('LN-17 is one section when the song has no blank lines', () => {
    expect(sectionsOf(tenChordRows)).toHaveLength(1);
  });

  it('LN-18 drops passages with no chords in them', () => {
    const spoken = [row('s1', 'just words'), row('gap', ''), row('s2', '[C]and a chord')];
    expect(sectionsOf(spoken).map((section) => section.map((r) => r.id))).toEqual([['s2']]);
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
  it('LN-05 shows the first verse and chorus whole, and thins their repeats (ADR-058)', () => {
    const concealed = createConcealment(verseChorusVerse, 0, 7);

    // Nothing at all is hidden in the music the first time it is played.
    for (const key of collectChordOccurrences([...verseChorusVerse].slice(0, 4))) {
      expect(concealed.has(key)).toBe(false);
    }
    // The repeat loses about a sixth of its chords: round(8 x 0.15) = 1 in the verse, and the
    // two-chord chorus rounds down to none.
    expect(concealed.size).toBe(1);
    expect([...concealed].every((key) => key.startsWith('v2'))).toBe(true);
  });

  it('LN-06 blurs every section evenly at the second and third levels', () => {
    // Level 2 wants half of each section: 4 of the verse's 8, 1 of the chorus's 2, twice over.
    expect(createConcealment(verseChorusVerse, 1, 7).size).toBe(10);
    // Level 3 wants 80%: 6 and 2, twice over, with opening chords now eligible.
    expect(createConcealment(verseChorusVerse, 2, 7).size).toBe(16);
  });

  it('LN-07 conceals nothing at the first level when nothing repeats', () => {
    expect(createConcealment(tenChordRows, 0, 99).size).toBe(0);
  });

  it('LN-19 counts a share against a song of one section', () => {
    // 10 chords over 3 rows: 3 openings are protected, leaving 7 eligible.
    expect(createConcealment(tenChordRows, 1, 7).size).toBe(5);
    expect(createConcealment(tenChordRows, 2, 7).size).toBe(8);
  });

  it('LN-12 never conceals the first chord of a line below the last level', () => {
    const firsts = firstChordOccurrences(tenChordRows);
    expect([...firsts].sort()).toEqual(['r1:0', 'r2:0', 'r3:0']);

    for (const playthrough of [0, 1]) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const concealed = createConcealment(tenChordRows, playthrough, seed);
        for (const first of firsts) {
          expect(concealed.has(first)).toBe(false);
        }
      }
    }
  });

  it('LN-13 puts the opening chords in the pool at the last level', () => {
    const openings = [...firstChordOccurrences(tenChordRows)];
    const hit = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      const concealed = createConcealment(tenChordRows, 2, seed);
      for (const key of openings) if (concealed.has(key)) hit.add(key);
    }
    // Eligible, not guaranteed: 80% leaves two chords showing, and which two is the seed's business.
    expect(hit.size).toBe(openings.length);
  });

  it('LN-14 caps the selection at the eligible chords rather than overshooting', () => {
    // Every line has exactly two chords, so half are protected and half is all there is.
    const pairs = [row('a', '[C]x [G]y'), row('b', '[C]x [G]y'), row('c', '[C]x [G]y')];
    expect(collectChordOccurrences(pairs)).toHaveLength(6);
    expect(createConcealment(pairs, 1, 5).size).toBe(3);
    expect(createConcealment(pairs, 2, 5).size).toBe(5);
  });

  it('LN-08 is stable: the same playthrough seed always yields the same selection', () => {
    const first = createConcealment(verseChorusVerse, 1, 4242);
    // Re-deriving mid-playthrough (as a scroll re-render would) must not reshuffle.
    for (let i = 0; i < 20; i += 1) {
      const again = createConcealment(verseChorusVerse, 1, 4242);
      expect([...again].sort()).toEqual([...first].sort());
    }
  });

  it('LN-09 selects a different set for a different playthrough seed', () => {
    const selections = new Set(
      Array.from({ length: 12 }, (_, seed) =>
        [...createConcealment(tenChordRows, 1, seed)].sort().join(',')
      )
    );
    // Not every seed must differ, but the selection must genuinely depend on the seed.
    expect(selections.size).toBeGreaterThan(1);
  });

  it('LN-20 does not blur two identical verses identically', () => {
    const sameTwice = new Set<boolean>();
    for (let seed = 0; seed < 12; seed += 1) {
      const concealed = createConcealment(verseChorusVerse, 1, seed);
      const first = [...concealed].filter((k) => k.startsWith('v1')).map((k) => k.slice(3));
      const second = [...concealed].filter((k) => k.startsWith('v2')).map((k) => k.slice(3));
      sameTwice.add(String(first.sort()) === String(second.sort()));
    }
    // At least one seed must place them differently, or the section seed is doing nothing.
    expect(sameTwice.has(false)).toBe(true);
  });

  it('LN-11 rounds to a whole number of chords for awkward counts', () => {
    const sevenChords = [row('r1', '[C]a [G]b [Am]c [F]d'), row('r2', '[Dm]e [G]f [C]g')];
    expect(collectChordOccurrences(sevenChords)).toHaveLength(7);
    // round(7 x 0.5) = 4, and round(7 x 0.8) = 6.
    expect(createConcealment(sevenChords, 1, 3).size).toBe(4);
    expect(createConcealment(sevenChords, 2, 3).size).toBe(6);
  });

  it('handles a song with no chords at all', () => {
    expect(createConcealment([row('r1', 'nothing')], 5, 1).size).toBe(0);
  });
});
