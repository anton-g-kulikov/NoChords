/**
 * Learning mode: which chord occurrences are concealed on a given playthrough.
 *
 * The selection must stay fixed for a whole playthrough — chords may not flicker in and out while
 * the song scrolls. That is achieved by deriving the set from a seed that only changes between
 * playthroughs, so any number of re-renders reproduce the same set (ADR-002).
 */
import type { SongRow } from '../types/song';

/** Fraction of chord occurrences concealed after N completed playthroughs. */
export const CONCEALMENT_STAGES = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

/** Concealment fraction for a completed-playthrough count, saturating at 100%. */
export function concealmentFor(playthrough: number): number {
  const index = Math.min(Math.max(Math.floor(playthrough), 0), CONCEALMENT_STAGES.length - 1);
  return CONCEALMENT_STAGES[index];
}

/** Stable identity of one chord occurrence: which row, and which chord within it. */
export function occurrenceKey(rowId: string, chordIndex: number): string {
  return `${rowId}:${chordIndex}`;
}

/** Every individual chord occurrence in the song, in reading order. */
export function collectChordOccurrences(rows: SongRow[]): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    row.chords.forEach((_chord, index) => {
      keys.push(occurrenceKey(row.id, index));
    });
  }
  return keys;
}

/**
 * Small deterministic PRNG (mulberry32).
 * Deterministic output is what makes concealment stable across re-renders and testable.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle over a copy, driven by the supplied PRNG. */
function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The set of chord occurrences to conceal for one playthrough.
 *
 * Pure in `(rows, playthrough, seed)`, so calling it repeatedly during a playthrough always
 * returns the same selection. The caller holds the seed steady for the duration of a playthrough
 * and changes it when a new one begins.
 */
export function createConcealment(
  rows: SongRow[],
  playthrough: number,
  seed: number
): Set<string> {
  const occurrences = collectChordOccurrences(rows);
  const fraction = concealmentFor(playthrough);
  const count = Math.round(occurrences.length * fraction);
  if (count <= 0) return new Set();
  if (count >= occurrences.length) return new Set(occurrences);
  return new Set(shuffled(occurrences, seededRandom(seed)).slice(0, count));
}
