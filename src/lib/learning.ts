/**
 * Learning mode: which chord occurrences are concealed at a given level.
 *
 * Three rules shape the selection:
 *  - it must stay fixed for a whole playthrough, so chords do not flicker in and out while the
 *    song scrolls — achieved by deriving it from a seed that only changes between playthroughs,
 *    so any number of re-renders reproduce the same set (ADR-002);
 *  - the first chord of a line is never concealed until the last level, so you keep your
 *    orientation in the line while the detail disappears (ADR-013);
 *  - what a section is worth depends on whether you have played it before (ADR-058).
 */
import { isBlankRow } from './playback';
import type { SongRow } from '../types/song';

/** What one level conceals. */
export interface LevelRule {
  /** Share concealed in a section whose music has not been played yet. */
  fresh: number;
  /** Share concealed in a section that repeats music already played. */
  repeat: number;
  /** Whether a line's opening chord may be concealed at all. */
  concealFirst: boolean;
}

/**
 * The three levels (ADR-058).
 *
 * The first is the one that does the teaching: the first verse and chorus are shown whole, and
 * only their repeats start losing chords — you read the changes once, then play them from memory
 * with the chart still there to catch you. The other two blur the whole song evenly.
 */
export const LEARNING_LEVELS: readonly LevelRule[] = [
  { fresh: 0, repeat: 0.15, concealFirst: false },
  { fresh: 0.5, repeat: 0.5, concealFirst: false },
  { fresh: 0.8, repeat: 0.8, concealFirst: true },
];

/** Highest level, counting from one. */
export const MAX_LEVEL = LEARNING_LEVELS.length;

/** Level, from one, for a completed-playthrough count. Levels saturate rather than run out. */
export function levelFor(playthrough: number): number {
  const index = Math.min(Math.max(Math.floor(playthrough), 0), LEARNING_LEVELS.length - 1);
  return index + 1;
}

/** What a level conceals. Out-of-range levels are clamped to a real one. */
export function ruleFor(level: number): LevelRule {
  const index = Math.min(Math.max(Math.floor(level), 1), MAX_LEVEL) - 1;
  return LEARNING_LEVELS[index];
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

/** The opening chord of every line that has one — the chords protected until full concealment. */
export function firstChordOccurrences(rows: SongRow[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.chords.length > 0) keys.add(occurrenceKey(row.id, 0));
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
 * The song split into sections at its blank lines.
 *
 * Blank rows are structure rather than music (ADR-025), which makes them the only thing in a song
 * that says where a verse ends. Sections carrying no chords are dropped: they are lyrics-only
 * passages, and there is nothing in them to conceal or to recognise later.
 */
export function sectionsOf(rows: SongRow[]): SongRow[][] {
  const sections: SongRow[][] = [];
  let current: SongRow[] = [];

  for (const row of rows) {
    if (isBlankRow(row)) {
      if (current.length > 0) sections.push(current);
      current = [];
      continue;
    }
    current.push(row);
  }
  if (current.length > 0) sections.push(current);

  return sections.filter((section) => section.some((row) => row.chords.length > 0));
}

/** A section's chords in order — what makes two sections the same music to play. */
function signatureOf(section: SongRow[]): string {
  return section.flatMap((row) => row.chords.map((chord) => chord.symbol)).join(' ');
}

/**
 * The set of chord occurrences to conceal at a level.
 *
 * Pure in `(rows, playthrough, seed)`, so calling it repeatedly during a playthrough always
 * returns the same selection. The caller holds the seed steady for the duration of a playthrough
 * and changes it when a new one begins.
 *
 * Each section is drawn from separately, so a share means the same thing everywhere in the song
 * rather than landing wherever the shuffle happened to put it. Below the last level the pool
 * excludes each line's opening chord, so a requested share can exceed what is eligible; the
 * selection is capped at the eligible chords, and callers should report the size of the returned
 * set rather than the nominal percentage.
 */
export function createConcealment(
  rows: SongRow[],
  playthrough: number,
  seed: number
): Set<string> {
  const rule = ruleFor(levelFor(playthrough));
  const concealed = new Set<string>();
  const played = new Set<string>();

  sectionsOf(rows).forEach((section, index) => {
    const signature = signatureOf(section);
    const fraction = played.has(signature) ? rule.repeat : rule.fresh;
    played.add(signature);
    if (fraction <= 0) return;

    const occurrences = collectChordOccurrences(section);
    const protectedKeys = rule.concealFirst ? new Set<string>() : firstChordOccurrences(section);
    const eligible = occurrences.filter((key) => !protectedKeys.has(key));
    const target = Math.min(Math.round(occurrences.length * fraction), eligible.length);

    // The seed moves with the section, so two identical verses do not blur identically.
    for (const key of shuffled(eligible, seededRandom(seed + index)).slice(0, target)) {
      concealed.add(key);
    }
  });

  return concealed;
}
