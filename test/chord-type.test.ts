import { describe, expect, it } from 'vitest';
import { chordParts, withSigns } from '../src/lib/chordType';

const letter = (head: string, tail = '', bass = '') => ({ kind: 'letter', head, tail, bass });
const numeral = (head: string, tail = '', bass = '') => ({ kind: 'numeral', head, tail, bass });
const other = (head: string) => ({ kind: 'other', head, tail: '', bass: '' });

describe('chordParts', () => {
  it('CT-01 sets the root apart from the quality', () => {
    expect(chordParts('Am')).toEqual(letter('A', 'm'));
    expect(chordParts('Cmaj7')).toEqual(letter('C', 'maj7'));
    expect(chordParts('Dsus4')).toEqual(letter('D', 'sus4'));
    expect(chordParts('G')).toEqual(letter('G'));
  });

  it('CT-02 writes accidentals as signs, on the root and the bass', () => {
    expect(chordParts('F#m')).toEqual(letter('F♯', 'm'));
    expect(chordParts('Bb')).toEqual(letter('B♭'));
    expect(chordParts('Ab/Eb')).toEqual(letter('A♭', '', '/E♭'));
    expect(chordParts('C/G')).toEqual(letter('C', '', '/G'));
  });

  it('CT-03 signs an altered extension, and leaves the letters of a word alone', () => {
    expect(chordParts('Bm7b5')).toEqual(letter('B', 'm7♭5'));
    expect(chordParts('G7#9')).toEqual(letter('G', '7♯9'));
    expect(chordParts('Cadd9')).toEqual(letter('C', 'add9'));
    expect(chordParts('Absus2')).toEqual(letter('A♭', 'sus2'));
  });

  it('CT-04 splits numerals the same way, prefix and all, and says they are numerals', () => {
    expect(chordParts('vi')).toEqual(numeral('vi'));
    expect(chordParts('bVII')).toEqual(numeral('♭VII'));
    expect(chordParts('vii°7')).toEqual(numeral('vii', '°7'));
    expect(chordParts('Imaj7')).toEqual(numeral('I', 'maj7'));
    expect(chordParts('V/vii')).toEqual(numeral('V', '', '/vii'));
    expect(chordParts('IV/bVII')).toEqual(numeral('IV', '', '/♭VII'));
  });

  it('CT-05 returns anything it does not recognise whole', () => {
    expect(chordParts('N.C.')).toEqual(other('N.C.'));
    expect(chordParts('%')).toEqual(other('%'));
    expect(chordParts('')).toEqual(other(''));
  });

  it('CT-06 sets the signs in a key written as one string', () => {
    expect(withSigns('Bbm')).toBe('B♭m');
    expect(withSigns('F#')).toBe('F♯');
    expect(withSigns('C')).toBe('C');
  });
});
