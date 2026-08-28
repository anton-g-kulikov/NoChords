import { describe, expect, it } from 'vitest';
import { parseChord, formatChord, transposeChord } from '../src/lib/chords';
import { MAJOR_KEYS, MINOR_KEYS, semitonesBetween, transposeKey } from '../src/lib/keys';

describe('parseChord', () => {
  it('CH-01 parses a bare root', () => {
    expect(parseChord('C')).toEqual({
      root: 'C',
      accidental: '',
      suffix: '',
      bass: null,
    });
  });

  it('CH-02 parses a sharp root with a suffix', () => {
    expect(parseChord('F#m')).toEqual({
      root: 'F',
      accidental: '#',
      suffix: 'm',
      bass: null,
    });
  });

  it('CH-03 parses a flat root', () => {
    expect(parseChord('Bb')).toEqual({
      root: 'B',
      accidental: 'b',
      suffix: '',
      bass: null,
    });
  });

  it('CH-04 parses numeric and extended suffixes', () => {
    expect(parseChord('G7')?.suffix).toBe('7');
    expect(parseChord('Cmaj7')?.suffix).toBe('maj7');
    expect(parseChord('Asus4')?.suffix).toBe('sus4');
    expect(parseChord('Ddim')?.suffix).toBe('dim');
  });

  it('CH-05 parses slash chords and keeps the bass note', () => {
    expect(parseChord('C/G')).toEqual({
      root: 'C',
      accidental: '',
      suffix: '',
      bass: { root: 'G', accidental: '' },
    });
    expect(parseChord('D/F#')?.bass).toEqual({ root: 'F', accidental: '#' });
  });

  it('CH-06 returns null for text that is not a chord', () => {
    expect(parseChord('N.C.')).toBeNull();
    expect(parseChord('%')).toBeNull();
    expect(parseChord('Hello')).toBeNull();
    expect(parseChord('')).toBeNull();
    expect(parseChord('|')).toBeNull();
  });

  it('round-trips through formatChord', () => {
    for (const symbol of ['C', 'F#m', 'Bb', 'G7', 'Cmaj7', 'C/G', 'D/F#']) {
      const parsed = parseChord(symbol);
      expect(parsed).not.toBeNull();
      expect(formatChord(parsed!)).toBe(symbol);
    }
  });
});

describe('transposeChord', () => {
  it('CH-07 transposes up a fourth from C to G', () => {
    expect(transposeChord('C', 'C', 'G')).toBe('G');
    expect(transposeChord('Am', 'C', 'G')).toBe('Em');
    expect(transposeChord('F', 'C', 'G')).toBe('C');
  });

  it('CH-08 transposes down and wraps across the octave boundary', () => {
    // C down to A: every root drops three semitones and wraps below C.
    expect(transposeChord('C', 'C', 'A')).toBe('A');
    expect(transposeChord('D', 'C', 'A')).toBe('B');
    expect(transposeChord('E', 'C', 'A')).toBe('C#');
  });

  it('CH-09 preserves the suffix through transposition', () => {
    expect(transposeChord('Cmaj7', 'C', 'G')).toBe('Gmaj7');
    expect(transposeChord('Dm7', 'C', 'G')).toBe('Am7');
    expect(transposeChord('Asus4', 'C', 'D')).toBe('Bsus4');
  });

  it('CH-10 transposes the bass of a slash chord too', () => {
    expect(transposeChord('C/G', 'C', 'G')).toBe('G/D');
    expect(transposeChord('D/F#', 'C', 'D')).toBe('E/G#');
  });

  it('CH-11 spells with flats in flat keys and sharps in sharp keys', () => {
    // C -> F is a flat key: the raised second degree is spelled Bb, not A#.
    expect(transposeChord('E', 'C', 'F')).toBe('A');
    expect(transposeChord('A', 'C', 'F')).toBe('D');
    expect(transposeChord('F#', 'C', 'F')).toBe('B');
    expect(transposeChord('C', 'C', 'Eb')).toBe('Eb');
    expect(transposeChord('A', 'C', 'Eb')).toBe('C');
    expect(transposeChord('D', 'C', 'Eb')).toBe('F');
    // C -> D is a sharp key.
    expect(transposeChord('C', 'C', 'D')).toBe('D');
    expect(transposeChord('E', 'C', 'D')).toBe('F#');
  });

  it('CH-12 leaves unparseable tokens untouched instead of throwing', () => {
    expect(transposeChord('N.C.', 'C', 'G')).toBe('N.C.');
    expect(transposeChord('%', 'C', 'G')).toBe('%');
    expect(transposeChord('nonsense', 'C', 'G')).toBe('nonsense');
  });

  it('CH-13 transposing to the same key is an identity', () => {
    for (const symbol of ['C', 'F#m', 'Bb', 'G7', 'Cmaj7', 'C/G']) {
      expect(transposeChord(symbol, 'C', 'C')).toBe(symbol);
    }
  });

  it('falls back to the original text when a key is unrecognised', () => {
    expect(transposeChord('C', 'C', 'H')).toBe('C');
    expect(transposeChord('C', 'nope', 'G')).toBe('C');
  });
});

describe('transposing a whole progression', () => {
  it('CH-14 transposes every chord of a progression', () => {
    const progression = ['C', 'Am', 'F', 'G7'];
    expect(progression.map((symbol) => transposeChord(symbol, 'C', 'G'))).toEqual([
      'G',
      'Em',
      'C',
      'D7',
    ]);
  });

  it('CH-15 round trips C -> G -> C back to the original spelling', () => {
    const progression = ['C', 'Am', 'F', 'G7'];
    const inG = progression.map((symbol) => transposeChord(symbol, 'C', 'G'));
    expect(inG.map((symbol) => transposeChord(symbol, 'G', 'C'))).toEqual(progression);
  });

  it('CH-16 transposes between minor keys', () => {
    expect(['Am', 'C', 'D', 'E'].map((symbol) => transposeChord(symbol, 'Am', 'Bm'))).toEqual([
      'Bm',
      'D',
      'E',
      'F#',
    ]);
  });

  it('CH-17 spells minor keys with flats where convention expects them', () => {
    // D minor carries one flat, so its sixth degree is Bb rather than A#.
    expect(transposeChord('A', 'Am', 'Dm')).toBe('D');
    expect(transposeChord('F', 'Am', 'Dm')).toBe('Bb');
    expect(transposeChord('G', 'Am', 'Gm')).toBe('F');
  });
});

describe('transposeKey', () => {
  it('KY-01 moves a key by semitones and keeps its mode', () => {
    // The point of the stepper: Am can never become A (ADR-034).
    expect(transposeKey('Am', 1)).toBe('Bbm');
    expect(transposeKey('Am', 2)).toBe('Bm');
    expect(transposeKey('Am', -1)).toBe('G#m');
    expect(transposeKey('C', 2)).toBe('D');
    expect(transposeKey('C', -1)).toBe('B');
  });

  it('KY-02 wraps around the octave', () => {
    expect(transposeKey('Am', 12)).toBe('Am');
    expect(transposeKey('C', -12)).toBe('C');
    expect(transposeKey('B', 1)).toBe('C');
    expect(transposeKey('C', -1)).toBe('B');
  });

  it('KY-03 spells the result the way the key lists do', () => {
    // Never Cb or E#: the offered spelling for each pitch is the one a musician would write.
    for (const step of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      expect(MAJOR_KEYS).toContain(transposeKey('C', step));
      expect(MINOR_KEYS).toContain(transposeKey('Am', step));
    }
  });

  it('KY-04 leaves something that is not a key alone', () => {
    expect(transposeKey('', 1)).toBe('');
    expect(transposeKey('nonsense', 1)).toBe('nonsense');
  });

  it('KY-05 reports the distance the short way round', () => {
    expect(semitonesBetween('Am', 'Bm')).toBe(2);
    expect(semitonesBetween('Am', 'G#m')).toBe(-1);
    expect(semitonesBetween('Am', 'Am')).toBe(0);
    // Six is the far side; beyond it the shorter direction is negative.
    expect(semitonesBetween('C', 'F#')).toBe(6);
    expect(semitonesBetween('C', 'G')).toBe(-5);
  });
});
