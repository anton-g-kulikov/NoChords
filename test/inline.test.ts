import { describe, expect, it } from 'vitest';
import { formatInlineRow, parseInlineRow } from '../src/lib/inline';

describe('parseInlineRow', () => {
  it('IN-01 separates chords from the lyric and records each chord position', () => {
    const parsed = parseInlineRow('[Dm]O, where are you [C]going? To [Dm]Scarborough Fair?');
    expect(parsed.lyrics).toBe('O, where are you going? To Scarborough Fair?');
    expect(parsed.chords).toEqual([
      { symbol: 'Dm', index: 0 },
      { symbol: 'C', index: 17 },
      { symbol: 'Dm', index: 27 },
    ]);
    // Each anchor must point at the character the chord is played over.
    expect(parsed.lyrics.slice(17, 22)).toBe('going');
    expect(parsed.lyrics.slice(27, 38)).toBe('Scarborough');
  });

  it('IN-02 produces one occurrence per chord, keeping the full lyric text', () => {
    // The fixture document names this exact line as the parsing acceptance test.
    const parsed = parseInlineRow("[G]I'd follow the ship that my [D]true love sails [G]in.");
    expect(parsed.chords).toHaveLength(3);
    expect(parsed.lyrics).toBe("I'd follow the ship that my true love sails in.");
    expect(parsed.chords.map((c) => c.symbol)).toEqual(['G', 'D', 'G']);
  });

  it('IN-03 handles a chord in the middle of a word', () => {
    const parsed = parseInlineRow('[Am]Great God, and [E]I for [Am]one.');
    expect(parsed.lyrics).toBe('Great God, and I for one.');
    expect(parsed.chords.map((c) => c.index)).toEqual([0, 15, 21]);

    const split = parseInlineRow('[G]And in the top rigging I[C]d there build my [G]nest');
    expect(split.lyrics).toBe('And in the top rigging Id there build my nest');
  });

  it('IN-04 returns anchors in ascending order', () => {
    const parsed = parseInlineRow('[Am]a[C]b[D]c[E]d');
    expect(parsed.chords.map((c) => c.index)).toEqual([0, 1, 2, 3]);
  });

  it('IN-05 treats a line with no brackets as pure lyrics', () => {
    const parsed = parseInlineRow('Just a plain lyric line');
    expect(parsed.lyrics).toBe('Just a plain lyric line');
    expect(parsed.chords).toEqual([]);
  });

  it('IN-06 supports a chord at the very end and an empty lyric', () => {
    expect(parseInlineRow('done[G]')).toEqual({
      lyrics: 'done',
      chords: [{ symbol: 'G', index: 4 }],
      beats: null,
      bars: null,
      meter: null,
    });
    expect(parseInlineRow('[Am][C]')).toEqual({
      lyrics: '',
      chords: [
        { symbol: 'Am', index: 0 },
        { symbol: 'C', index: 0 },
      ],
      beats: null,
      bars: null,
      meter: null,
    });
  });

  it('IN-07 ignores empty brackets and trims chord text', () => {
    expect(parseInlineRow('a[]b').chords).toEqual([]);
    expect(parseInlineRow('a[ G ]b').chords).toEqual([{ symbol: 'G', index: 1 }]);
  });

  it('IN-08 leaves an unclosed bracket as literal lyric text', () => {
    const parsed = parseInlineRow('a [not a chord');
    expect(parsed.lyrics).toBe('a [not a chord');
    expect(parsed.chords).toEqual([]);
  });

  it('IN-09 keeps a chord symbol it cannot interpret', () => {
    // Preserving unknown text is the contract (ADR-006); the parser does not validate symbols.
    expect(parseInlineRow('[N.C.]silence').chords).toEqual([{ symbol: 'N.C.', index: 0 }]);
  });

  it('IN-12 reads a line length written as /n/ and keeps it out of the lyric', () => {
    const parsed = parseInlineRow('[Am]Great God, and [E]I for [Am]one./12/');
    expect(parsed.beats).toBe(12);
    expect(parsed.lyrics).toBe('Great God, and I for one.');
    expect(parsed.chords.map((c) => c.symbol)).toEqual(['Am', 'E', 'Am']);
  });

  it('IN-13 leaves beats null when the line does not say', () => {
    expect(parseInlineRow('[C]plain line').beats).toBeNull();
  });

  it('IN-14 does not mistake a slash chord for a line length', () => {
    const parsed = parseInlineRow('[C/G]over a bass note');
    expect(parsed.beats).toBeNull();
    expect(parsed.chords).toEqual([{ symbol: 'C/G', index: 0 }]);
    expect(parsed.lyrics).toBe('over a bass note');
  });

  it('IN-15 keeps a lone slash in the lyric as text', () => {
    const parsed = parseInlineRow('and/or, he said');
    expect(parsed.beats).toBeNull();
    expect(parsed.lyrics).toBe('and/or, he said');
  });

  it('IN-16 takes the length tag out before fixing chord offsets', () => {
    // The tag sits before a chord, so a naive parse would shift that chord four characters.
    const parsed = parseInlineRow('/8/[C]start');
    expect(parsed.beats).toBe(8);
    expect(parsed.lyrics).toBe('start');
    expect(parsed.chords).toEqual([{ symbol: 'C', index: 0 }]);
  });

  it('IN-17 ignores a zero or malformed length', () => {
    expect(parseInlineRow('a/0/').beats).toBeNull();
    expect(parseInlineRow('a/x/').beats).toBeNull();
    expect(parseInlineRow('a/x/').lyrics).toBe('a/x/');
  });

  it('handles an empty string', () => {
    expect(parseInlineRow('')).toEqual({
      lyrics: '',
      chords: [],
      beats: null,
      bars: null,
      meter: null,
    });
  });
});

describe('formatInlineRow', () => {
  it('IN-10 renders a parsed row back to its inline source', () => {
    const source = '[Dm]O, where are you [C]going? To [Dm]Scarborough Fair?';
    expect(formatInlineRow(parseInlineRow(source))).toBe(source);
  });

  it('IN-18 writes the line length back at the end of the line', () => {
    const source = '[Am]Great God, and [E]I for [Am]one./12/';
    expect(formatInlineRow(parseInlineRow(source))).toBe(source);
    // A tag typed at the front is normalised to where it reads.
    expect(formatInlineRow(parseInlineRow('/8/[C]start'))).toBe('[C]start/8/');
  });

  it('IN-11 round-trips every fixture-shaped line unchanged', () => {
    const lines = [
      '[G]I am a young maiden and my [C]story is [G]sad,',
      '[Am]There is a [C]house in New [D]Orleans,',
      '[Dm]Without any seam or [C]needle[Dm]work,',
      'a plain line',
      '[G]',
      '',
      '[Am]a held line/16/',
      'no chords but a length/3/',
    ];
    for (const line of lines) {
      expect(formatInlineRow(parseInlineRow(line))).toBe(line);
    }
  });

  it('clamps an anchor that points past the end of the lyric', () => {
    expect(
      formatInlineRow({
        lyrics: 'ab',
        chords: [{ symbol: 'G', index: 99 }],
        beats: null,
        bars: null,
        meter: null,
      })
    ).toBe('ab[G]');
  });
});

describe('bar and meter tags', () => {
  it('IN-14 reads a bar count from a double slash at the end of the line', () => {
    const row = parseInlineRow('[Am]Dear God, I know I was one.//3');
    expect(row.bars).toBe(3);
    expect(row.beats).toBeNull();
    expect(row.lyrics).toBe('Dear God, I know I was one.');
  });

  it('IN-15 keeps bars and beats apart, so `//2` is never read as a beat tag', () => {
    expect(parseInlineRow('a line//2').bars).toBe(2);
    expect(parseInlineRow('a line//2').beats).toBeNull();
    expect(parseInlineRow('a line/12/').beats).toBe(12);
    expect(parseInlineRow('a line/12/').bars).toBeNull();
  });

  it('IN-16 lets a line name both, for a solo that does not sit on a bar', () => {
    // Both stated: beats win at playback, and both survive the round trip.
    const row = parseInlineRow('[Am]solo//4/24/');
    expect(row.bars).toBe(4);
    expect(row.beats).toBe(24);
  });

  it('IN-17 reads a signature and drops it out of the lyric', () => {
    const row = parseInlineRow('{4/4}[C]Here the bridge starts,');
    expect(row.meter).toBe('4/4');
    expect(row.lyrics).toBe('Here the bridge starts,');
    expect(row.chords).toEqual([{ symbol: 'C', index: 0 }]);
  });

  it('IN-18 ignores a signature that is not one', () => {
    expect(parseInlineRow('{fast}a line').meter).toBeNull();
    expect(parseInlineRow('{fast}a line').lyrics).toBe('{fast}a line');
  });

  it('IN-19 round-trips the new tags to where they read naturally', () => {
    const text = '{6/8}[Am]Dear God, I know I was [Am]one.//3';
    expect(formatInlineRow(parseInlineRow(text))).toBe(text);
    // A signature typed mid-line is normalised to the head, a bar count to the tail.
    expect(formatInlineRow(parseInlineRow('a {3/4}line//2'))).toBe('{3/4}a line//2');
  });
});

