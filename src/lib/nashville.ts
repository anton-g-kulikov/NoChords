/**
 * Nashville number conversion: chord symbols expressed as scale degrees of the song's key.
 *
 * Because chords are stored in the song's original key (ADR-001), degrees are a pure function of
 * stored data — so transposing the display never moves a number. That invariant is the whole point
 * of the mode, and is covered by test NV-08.
 */
import { keyIsMinor, keyPitch, parseChord } from './chords';

/**
 * Degree label for each semitone above the tonic, for a major key.
 * Diatonic steps get a bare number; chromatic steps are named as flattened degrees.
 */
const MAJOR_DEGREES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

/**
 * The same for a minor key, read against the natural minor scale — so in A minor `C` is the third
 * degree rather than a flattened third, which is how a minor chart reads (ADR-009).
 */
const MINOR_DEGREES = ['1', 'b2', '2', '3', '#3', '4', 'b5', '5', '6', '#6', '7', '#7'];

/** Degree label for a note, given the key's tonic pitch and mode. */
function degreeOf(notePitch: number, tonicPitch: number, minor: boolean): string {
  const scale = minor ? MINOR_DEGREES : MAJOR_DEGREES;
  return scale[(((notePitch - tonicPitch) % 12) + 12) % 12];
}

/**
 * Converts one chord symbol to Nashville notation relative to `key`.
 * The chord's suffix follows the degree, as the brief specifies (`G7` in C becomes `57`).
 * Unrecognised chords and keys are returned unchanged.
 */
export function toNashville(symbol: string, key: string): string {
  const tonic = keyPitch(key);
  if (tonic === null) return symbol;
  const minor = keyIsMinor(key);

  const chord = parseChord(symbol);
  if (!chord) return symbol;

  const rootPitch = keyPitch(`${chord.root}${chord.accidental}`);
  if (rootPitch === null) return symbol;

  let result = degreeOf(rootPitch, tonic, minor) + chord.suffix;

  if (chord.bass) {
    const bassPitch = keyPitch(`${chord.bass.root}${chord.bass.accidental}`);
    if (bassPitch === null) return symbol;
    result += `/${degreeOf(bassPitch, tonic, minor)}`;
  }

  return result;
}
