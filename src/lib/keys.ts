import { keyPitch, parseKey } from './chords';

/** Major keys offered in the UI: one practical spelling per pitch class. */
export const MAJOR_KEYS = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

/** Minor keys, spelled as their conventional key signatures suggest. */
export const MINOR_KEYS = [
  'Am',
  'Bbm',
  'Bm',
  'Cm',
  'C#m',
  'Dm',
  'Ebm',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'G#m',
] as const;

export const KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

export type KeyName = (typeof KEYS)[number];

/**
 * The same key moved by semitones, keeping its mode (ADR-034).
 *
 * Transposing is a move along the keyboard, not a change of key list: Am goes to Bbm, never to A.
 * The result is spelled the way the offered lists spell that pitch, so the name stays one a
 * musician would write.
 */
export function transposeKey(key: string, semitones: number): string {
  const parsed = parseKey(key);
  const pitch = keyPitch(key);
  if (!parsed || pitch === null) return key;

  const target = (((pitch + semitones) % 12) + 12) % 12;
  const names: readonly string[] = parsed.minor ? MINOR_KEYS : MAJOR_KEYS;
  return names.find((name) => keyPitch(name) === target) ?? key;
}

/** How many semitones apart two keys are, as a signed value in -11..11. */
export function semitonesBetween(from: string, to: string): number {
  const a = keyPitch(from);
  const b = keyPitch(to);
  if (a === null || b === null) return 0;
  const up = (((b - a) % 12) + 12) % 12;
  // Report the shorter way round, so a step down from the original reads as -1 rather than +11.
  return up > 6 ? up - 12 : up;
}
