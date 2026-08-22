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
    });
    expect(parseInlineRow('[Am][C]')).toEqual({
      lyrics: '',
      chords: [
        { symbol: 'Am', index: 0 },
        { symbol: 'C', index: 0 },
      ],
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

  it('handles an empty string', () => {
    expect(parseInlineRow('')).toEqual({ lyrics: '', chords: [] });
  });
});

describe('formatInlineRow', () => {
  it('IN-10 renders a parsed row back to its inline source', () => {
    const source = '[Dm]O, where are you [C]going? To [Dm]Scarborough Fair?';
    expect(formatInlineRow(parseInlineRow(source))).toBe(source);
  });

  it('IN-11 round-trips every fixture-shaped line unchanged', () => {
    const lines = [
      '[G]I am a young maiden and my [C]story is [G]sad,',
      '[Am]There is a [C]house in New [D]Orleans,',
      '[Dm]Without any seam or [C]needle[Dm]work,',
      'a plain line',
      '[G]',
      '',
    ];
    for (const line of lines) {
      expect(formatInlineRow(parseInlineRow(line))).toBe(line);
    }
  });

  it('clamps an anchor that points past the end of the lyric', () => {
    expect(formatInlineRow({ lyrics: 'ab', chords: [{ symbol: 'G', index: 99 }] })).toBe('ab[G]');
  });
});
