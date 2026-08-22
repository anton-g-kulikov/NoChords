import { describe, expect, it } from 'vitest';
import { toNashville } from '../src/lib/nashville';
import { transposeChord } from '../src/lib/chords';

describe('toNashville', () => {
  it('NV-01 maps diatonic majors to bare degrees in C', () => {
    expect(toNashville('C', 'C')).toBe('1');
    expect(toNashville('D', 'C')).toBe('2');
    expect(toNashville('E', 'C')).toBe('3');
    expect(toNashville('F', 'C')).toBe('4');
    expect(toNashville('G', 'C')).toBe('5');
    expect(toNashville('A', 'C')).toBe('6');
    expect(toNashville('B', 'C')).toBe('7');
  });

  it('NV-02 puts the minor quality after the degree', () => {
    expect(toNashville('Dm', 'C')).toBe('2m');
    expect(toNashville('Em', 'C')).toBe('3m');
    expect(toNashville('Am', 'C')).toBe('6m');
  });

  it('NV-03 puts any suffix after the degree', () => {
    expect(toNashville('G7', 'C')).toBe('57');
    expect(toNashville('Cmaj7', 'C')).toBe('1maj7');
    expect(toNashville('Dm7', 'C')).toBe('2m7');
    expect(toNashville('Asus4', 'C')).toBe('6sus4');
  });

  it('NV-04 works in a key other than C', () => {
    expect(toNashville('G', 'G')).toBe('1');
    expect(toNashville('C', 'G')).toBe('4');
    expect(toNashville('D', 'G')).toBe('5');
    expect(toNashville('Em', 'G')).toBe('6m');
    expect(toNashville('Bb', 'Bb')).toBe('1');
    expect(toNashville('Eb', 'Bb')).toBe('4');
  });

  it('NV-05 gives chromatic roots a flattened degree', () => {
    expect(toNashville('Eb', 'C')).toBe('b3');
    expect(toNashville('Bb', 'C')).toBe('b7');
    expect(toNashville('Ab', 'C')).toBe('b6');
    expect(toNashville('Db', 'C')).toBe('b2');
    expect(toNashville('F#', 'C')).toBe('b5');
    // Enharmonic spellings land on the same degree.
    expect(toNashville('D#', 'C')).toBe('b3');
  });

  it('NV-06 renders both degrees of a slash chord', () => {
    expect(toNashville('C/G', 'C')).toBe('1/5');
    expect(toNashville('F/A', 'C')).toBe('4/6');
    expect(toNashville('D/F#', 'C')).toBe('2/b5');
  });

  it('NV-10 reads minor keys against the natural minor scale', () => {
    // Expected outputs stated by the fixtures in `_meta/example-songs.md`.
    expect(toNashville('Dm', 'Dm')).toBe('1m');
    expect(toNashville('C', 'Dm')).toBe('7');

    expect(toNashville('Am', 'Am')).toBe('1m');
    expect(toNashville('C', 'Am')).toBe('3');
    expect(toNashville('D', 'Am')).toBe('4');
    expect(toNashville('E', 'Am')).toBe('5');
  });

  it('NV-11 keeps major keys on the major scale', () => {
    // The same pitch reads differently depending on the mode of the key.
    expect(toNashville('C', 'A')).toBe('b3');
    expect(toNashville('C', 'Am')).toBe('3');
    expect(toNashville('F', 'Am')).toBe('6');
    expect(toNashville('G', 'Am')).toBe('7');
  });

  it('NV-07 passes unparseable text through unchanged', () => {
    expect(toNashville('N.C.', 'C')).toBe('N.C.');
    expect(toNashville('%', 'C')).toBe('%');
  });

  it('falls back to the original text when the key is unrecognised', () => {
    expect(toNashville('C', 'H')).toBe('C');
  });
});

describe('transposition invariance', () => {
  it('NV-08 leaves the degrees unchanged after the song is transposed (PRD invariant)', () => {
    const symbols = ['C', 'Am', 'F', 'G7'];
    const degrees = symbols.map((symbol) => toNashville(symbol, 'C'));
    expect(degrees).toEqual(['1', '6m', '4', '57']);

    // Transposing the written chords into another key must not move the degrees.
    for (const key of ['G', 'D', 'F', 'Bb', 'A', 'Eb']) {
      const transposed = symbols.map((symbol) => transposeChord(symbol, 'C', key));
      expect(transposed.map((symbol) => toNashville(symbol, key))).toEqual(degrees);
    }
  });

  it('NV-12 holds the invariant for the minor-key fixtures too', () => {
    // House of the Rising Sun: Am C D E in A minor.
    const symbols = ['Am', 'C', 'D', 'E'];
    const degrees = symbols.map((symbol) => toNashville(symbol, 'Am'));
    expect(degrees).toEqual(['1m', '3', '4', '5']);

    for (const key of ['Bm', 'Cm', 'Dm', 'Em', 'F#m']) {
      const transposed = symbols.map((symbol) => transposeChord(symbol, 'Am', key));
      expect(transposed.map((symbol) => toNashville(symbol, key))).toEqual(degrees);
    }
  });

  it('NV-13 transposes the Blackbird fixture G -> A as the fixture document states', () => {
    expect(transposeChord('G', 'G', 'A')).toBe('A');
    expect(transposeChord('C', 'G', 'A')).toBe('D');
    expect(transposeChord('D', 'G', 'A')).toBe('E');
    expect(['A', 'D', 'E'].map((symbol) => toNashville(symbol, 'A'))).toEqual(['1', '4', '5']);
  });
});
