import { describe, expect, it } from 'vitest';
import { toNashville } from '../src/lib/nashville';
import { transposeChord } from '../src/lib/chords';

describe('toNashville (roman numerals, ADR-012)', () => {
  it('NV-01 maps diatonic majors to bare degrees in C', () => {
    expect(toNashville('C', 'C')).toBe('I');
    expect(toNashville('D', 'C')).toBe('II');
    expect(toNashville('E', 'C')).toBe('III');
    expect(toNashville('F', 'C')).toBe('IV');
    expect(toNashville('G', 'C')).toBe('V');
    expect(toNashville('A', 'C')).toBe('VI');
    expect(toNashville('B', 'C')).toBe('VII');
  });

  it('NV-02 lowercases the numeral for a minor chord instead of adding a letter', () => {
    expect(toNashville('Dm', 'C')).toBe('ii');
    expect(toNashville('Em', 'C')).toBe('iii');
    expect(toNashville('Am', 'C')).toBe('vi');
    expect(toNashville('Amin', 'C')).toBe('vi');
  });

  it('NV-14 marks diminished and half-diminished chords', () => {
    expect(toNashville('Bdim', 'C')).toBe('vii°');
    expect(toNashville('Bdim7', 'C')).toBe('vii°7');
    expect(toNashville('C°', 'C')).toBe('i°');
  });

  it('NV-15 keeps maj distinct from minor', () => {
    expect(toNashville('Cmaj', 'C')).toBe('Imaj');
    expect(toNashville('Cm', 'C')).toBe('i');
  });

  it('NV-03 puts any suffix after the degree', () => {
    expect(toNashville('G7', 'C')).toBe('V7');
    expect(toNashville('Cmaj7', 'C')).toBe('Imaj7');
    expect(toNashville('Dm7', 'C')).toBe('ii7');
    expect(toNashville('Asus4', 'C')).toBe('VIsus4');
  });

  it('NV-04 works in a key other than C', () => {
    expect(toNashville('G', 'G')).toBe('I');
    expect(toNashville('C', 'G')).toBe('IV');
    expect(toNashville('D', 'G')).toBe('V');
    expect(toNashville('Em', 'G')).toBe('vi');
    expect(toNashville('Bb', 'Bb')).toBe('I');
    expect(toNashville('Eb', 'Bb')).toBe('IV');
  });

  it('NV-05 gives chromatic roots a flattened degree', () => {
    expect(toNashville('Eb', 'C')).toBe('bIII');
    expect(toNashville('Bb', 'C')).toBe('bVII');
    expect(toNashville('Ab', 'C')).toBe('bVI');
    expect(toNashville('Db', 'C')).toBe('bII');
    expect(toNashville('F#', 'C')).toBe('bV');
    // Enharmonic spellings land on the same degree.
    expect(toNashville('D#', 'C')).toBe('bIII');
    // The accidental stays lowercase when the numeral is lowered for a minor chord.
    expect(toNashville('Ebm', 'C')).toBe('biii');
  });

  it('NV-06 renders both degrees of a slash chord', () => {
    expect(toNashville('C/G', 'C')).toBe('I/V');
    expect(toNashville('F/A', 'C')).toBe('IV/VI');
    expect(toNashville('D/F#', 'C')).toBe('II/bV');
    // The bass is a scale degree, so it stays uppercase even under a minor chord.
    expect(toNashville('Dm/A', 'C')).toBe('ii/VI');
  });

  it('NV-10 reads minor keys against the natural minor scale', () => {
    // Expected outputs stated by the fixtures in `_meta/example-songs.md`.
    expect(toNashville('Dm', 'Dm')).toBe('i');
    expect(toNashville('C', 'Dm')).toBe('VII');

    expect(toNashville('Am', 'Am')).toBe('i');
    expect(toNashville('C', 'Am')).toBe('III');
    expect(toNashville('D', 'Am')).toBe('IV');
    expect(toNashville('E', 'Am')).toBe('V');
    expect(toNashville('Dm', 'Am')).toBe('iv');
  });

  it('NV-11 keeps major keys on the major scale', () => {
    // The same pitch reads differently depending on the mode of the key.
    expect(toNashville('C', 'A')).toBe('bIII');
    expect(toNashville('C', 'Am')).toBe('III');
    expect(toNashville('F', 'Am')).toBe('VI');
    expect(toNashville('G', 'Am')).toBe('VII');
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
    expect(degrees).toEqual(['I', 'vi', 'IV', 'V7']);

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
    expect(degrees).toEqual(['i', 'III', 'IV', 'V']);

    for (const key of ['Bm', 'Cm', 'Dm', 'Em', 'F#m']) {
      const transposed = symbols.map((symbol) => transposeChord(symbol, 'Am', key));
      expect(transposed.map((symbol) => toNashville(symbol, key))).toEqual(degrees);
    }
  });

  it('NV-13 transposes the Blackbird fixture G -> A as the fixture document states', () => {
    expect(transposeChord('G', 'G', 'A')).toBe('A');
    expect(transposeChord('C', 'G', 'A')).toBe('D');
    expect(transposeChord('D', 'G', 'A')).toBe('E');
    expect(['A', 'D', 'E'].map((symbol) => toNashville(symbol, 'A'))).toEqual(['I', 'IV', 'V']);
  });
});
