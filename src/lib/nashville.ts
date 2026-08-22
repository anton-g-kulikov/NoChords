/**
 * Nashville mode: chords as roman numerals relative to the song's key (ADR-012).
 *
 * Case carries quality — `I` major, `ii` minor, `vii°` diminished — so the quality letter is
 * dropped from the suffix once the numeral is cased. Because chords are stored in the song's
 * original key (ADR-001), numerals are a pure function of stored data, which is why transposing
 * the display never moves one. That invariant is covered by test NV-08.
 */
import { keyIsMinor, keyPitch, parseChord } from './chords';

/** Numeral for each semitone above the tonic in a major key. */
const MAJOR_NUMERALS = [
  'I',
  'bII',
  'II',
  'bIII',
  'III',
  'IV',
  'bV',
  'V',
  'bVI',
  'VI',
  'bVII',
  'VII',
];

/**
 * The same for a minor key, read against the natural minor scale — so in A minor `C` is `III`
 * rather than `bIII`, which is how a minor chart is written (ADR-009).
 */
const MINOR_NUMERALS = [
  'I',
  'bII',
  'II',
  'III',
  '#III',
  'IV',
  'bV',
  'V',
  'VI',
  '#VI',
  'VII',
  '#VII',
];

interface Quality {
  /** Lowercase the numeral: minor or diminished. */
  lower: boolean;
  /** Marker appended after the numeral, e.g. `°` for diminished. */
  mark: string;
  /** Suffix text left over once the quality letters are consumed. */
  rest: string;
}

/**
 * Separates the quality that the numeral's case will express from the suffix text that still has
 * to be printed. `m7` becomes lowercase plus `7`; `maj7` stays uppercase and keeps `maj7`.
 */
function splitQuality(suffix: string): Quality {
  if (/^dim/i.test(suffix)) return { lower: true, mark: '°', rest: suffix.slice(3) };
  if (/^°/.test(suffix)) return { lower: true, mark: '°', rest: suffix.slice(1) };
  if (/^ø/.test(suffix)) return { lower: true, mark: 'ø', rest: suffix.slice(1) };
  if (/^min/i.test(suffix)) return { lower: true, mark: '', rest: suffix.slice(3) };
  // `m` means minor, but `maj` does not.
  if (/^m(?!aj)/.test(suffix)) return { lower: true, mark: '', rest: suffix.slice(1) };
  return { lower: false, mark: '', rest: suffix };
}

/** Numeral for a note, given the key's tonic pitch and mode. */
function numeralOf(notePitch: number, tonicPitch: number, minorKey: boolean): string {
  const scale = minorKey ? MINOR_NUMERALS : MAJOR_NUMERALS;
  return scale[(((notePitch - tonicPitch) % 12) + 12) % 12];
}

/** Lowercases only the numeral letters, leaving any `b`/`#` prefix as written. */
function lowerNumeral(numeral: string): string {
  return numeral.replace(/[IV]+/, (letters) => letters.toLowerCase());
}

/**
 * Converts one chord symbol to a roman numeral relative to `key`.
 * Unrecognised chords and keys are returned unchanged (ADR-006).
 */
export function toNashville(symbol: string, key: string): string {
  const tonic = keyPitch(key);
  if (tonic === null) return symbol;
  const minorKey = keyIsMinor(key);

  const chord = parseChord(symbol);
  if (!chord) return symbol;

  const rootPitch = keyPitch(`${chord.root}${chord.accidental}`);
  if (rootPitch === null) return symbol;

  const quality = splitQuality(chord.suffix);
  const numeral = numeralOf(rootPitch, tonic, minorKey);
  let result = (quality.lower ? lowerNumeral(numeral) : numeral) + quality.mark + quality.rest;

  if (chord.bass) {
    const bassPitch = keyPitch(`${chord.bass.root}${chord.bass.accidental}`);
    if (bassPitch === null) return symbol;
    // The bass is a scale degree, not a chord, so it carries no quality of its own.
    result += `/${numeralOf(bassPitch, tonic, minorKey)}`;
  }

  return result;
}
