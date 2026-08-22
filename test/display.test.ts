import { describe, expect, it } from 'vitest';
import { chordSymbolFor, rowSegments } from '../src/lib/display';
import { parseInlineRow } from '../src/lib/inline';
import { createSong } from '../src/lib/songs';
import type { SongRow } from '../src/types/song';

function row(inline: string): SongRow {
  return { id: 'r1', ...parseInlineRow(inline) };
}

const songInC = createSong({ originalKey: 'C', currentKey: 'C' });

describe('rowSegments', () => {
  it('DS-01 splits the lyric at each chord anchor', () => {
    const segments = rowSegments(row('[C]la [G]la [Am]la'));
    expect(segments.map((segment) => segment.text)).toEqual(['la ', 'la ', 'la']);
    expect(segments.map((segment) => segment.chord?.symbol)).toEqual(['C', 'G', 'Am']);
    expect(segments.map((segment) => segment.chordIndex)).toEqual([0, 1, 2]);
  });

  it('DS-02 puts lyric text before the first chord in a chordless leading segment', () => {
    const segments = rowSegments(row('Oh [G]happy day'));
    expect(segments[0]).toEqual({ chord: null, chordIndex: null, text: 'Oh ' });
    expect(segments[1].chord?.symbol).toBe('G');
    expect(segments[1].text).toBe('happy day');
  });

  it('DS-03 reproduces the complete lyric when the segments are concatenated', () => {
    // This is the layout guarantee at the data level: nothing is dropped or duplicated,
    // so concealing a chord cannot shift the lyric under it.
    for (const inline of [
      '[Dm]O, where are you [C]going? To [Dm]Scarborough Fair?',
      'no chords at all',
      '[G]',
      '[Am]Great God, and [E]I for [Am]one.',
    ]) {
      const source = row(inline);
      expect(rowSegments(source).map((segment) => segment.text).join('')).toBe(source.lyrics);
    }
  });

  it('DS-04 keeps a chordless row as a single segment', () => {
    expect(rowSegments(row('just words'))).toEqual([
      { chord: null, chordIndex: null, text: 'just words' },
    ]);
  });

  it('DS-05 handles an empty row', () => {
    expect(rowSegments(row(''))).toEqual([{ chord: null, chordIndex: null, text: '' }]);
  });

  it('DS-06 numbers segments by their position in the stored chord list', () => {
    // Learning concealment addresses chords by that index, so the two must agree.
    const segments = rowSegments(row('[C]a[G]b[Am]c'));
    expect(segments.map((segment) => segment.chordIndex)).toEqual([0, 1, 2]);
  });
});

describe('chordSymbolFor', () => {
  it('DS-07 shows transposed names in full and learning modes', () => {
    const song = { ...songInC, currentKey: 'G' };
    expect(chordSymbolFor('C', song, 'full')).toBe('G');
    expect(chordSymbolFor('Am', song, 'learning')).toBe('Em');
  });

  it('DS-08 shows degrees in nashville mode, ignoring the display key', () => {
    expect(chordSymbolFor('C', { ...songInC, currentKey: 'G' }, 'nashville')).toBe('I');
    expect(chordSymbolFor('C', { ...songInC, currentKey: 'Eb' }, 'nashville')).toBe('I');
    expect(chordSymbolFor('Am', { ...songInC, currentKey: 'B' }, 'nashville')).toBe('vi');
  });

  it('DS-09 leaves symbols alone when the song is in its original key', () => {
    expect(chordSymbolFor('Bb', songInC, 'full')).toBe('Bb');
  });
});
