/**
 * Song and row state transitions.
 *
 * Every function here is pure: it takes a song and returns a new one. Keeping these outside React
 * means the whole editing model is unit-testable, and it is the seam a future backend would sit
 * behind (ADR-005).
 */
import { CONCEALMENT_STAGES } from './learning';
import { parseInlineRow } from './inline';
import { DEFAULT_BEATS } from './playback';
import type { Song, SongRow } from '../types/song';

export { DEFAULT_BEATS };

/** Playthrough count at which concealment reaches 100%. Counting beyond it has no effect. */
export const MAX_LEARNING_PLAYTHROUGH = CONCEALMENT_STAGES.length - 1;

export const DEFAULT_TEMPO = 90;
export const DEFAULT_KEY = 'C';

let idCounter = 0;

/** Unique enough for a single-browser app; no coordination required. */
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** A new empty row. */
export function createRow(overrides: Partial<SongRow> = {}): SongRow {
  return {
    id: nextId('row'),
    lyrics: '',
    chords: [],
    beats: DEFAULT_BEATS,
    pauseSeconds: 0,
    ...overrides,
  };
}

/** A new song with one empty row, ready to type into. */
export function createSong(overrides: Partial<Song> = {}): Song {
  const originalKey = overrides.originalKey ?? DEFAULT_KEY;
  return {
    id: nextId('song'),
    title: '',
    originalKey,
    // A new song is displayed in the key it was written in until the user transposes it.
    currentKey: originalKey,
    tempo: DEFAULT_TEMPO,
    learningPlaythrough: 0,
    rows: [createRow()],
    ...overrides,
  };
}

/**
 * A fixture timing line: `duration: 6 | pause: 2`.
 * These annotate the row above them rather than being rows of their own.
 */
const TIMING_RE = /^\s*duration:\s*([\d.]+)\s*\|\s*pause:\s*([\d.]+)\s*$/i;

/**
 * Converts pasted text into one row per line.
 *
 * Chords may be written inline as `[G]lyric` (ADR-007). Trailing blank lines are dropped; interior
 * ones are kept, since they usually separate sections.
 *
 * Text in the fixture format of `_meta/example-songs.md` — lyric lines each followed by a
 * `duration: N | pause: N` line — is recognised and applied to the preceding row. In that format
 * blank lines are separators between entries, so they are dropped rather than kept as rows.
 */
export function rowsFromPastedText(text: string): SongRow[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  const isFixture = lines.some((line) => TIMING_RE.test(line));
  const rows: SongRow[] = [];

  for (const line of lines) {
    const timing = TIMING_RE.exec(line);
    if (timing) {
      const previous = rows[rows.length - 1];
      if (previous) {
        previous.beats = Number(timing[1]) || DEFAULT_BEATS;
        previous.pauseSeconds = Math.max(0, Number(timing[2]) || 0);
      }
      continue;
    }
    if (isFixture && line.trim() === '') continue;
    rows.push(createRow(parseInlineRow(line)));
  }

  return rows;
}

/** Inserts a fresh empty row after `index`. */
export function addRowAfter(song: Song, index: number): Song {
  const rows = [...song.rows];
  rows.splice(index + 1, 0, createRow());
  return { ...song, rows };
}

/** Removes a row. A song always keeps at least one row so there is somewhere to type. */
export function deleteRow(song: Song, rowId: string): Song {
  const rows = song.rows.filter((row) => row.id !== rowId);
  return { ...song, rows: rows.length > 0 ? rows : [createRow()] };
}

/** Patches one field of one row. */
export function updateRow(song: Song, rowId: string, patch: Partial<SongRow>): Song {
  return {
    ...song,
    rows: song.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
  };
}

/** Moves a row up or down by one position. */
export function moveRow(song: Song, index: number, delta: number): Song {
  const target = index + delta;
  if (index < 0 || index >= song.rows.length) return song;
  if (target < 0 || target >= song.rows.length) return song;
  const rows = [...song.rows];
  [rows[index], rows[target]] = [rows[target], rows[index]];
  return { ...song, rows };
}

/** Records a finished learning playthrough, saturating at full concealment. */
export function completeLearningPlaythrough(song: Song): Song {
  return {
    ...song,
    learningPlaythrough: Math.min(song.learningPlaythrough + 1, MAX_LEARNING_PLAYTHROUGH),
  };
}

/** Returns learning concealment to 0%, leaving the rest of the song untouched. */
export function resetLearningProgress(song: Song): Song {
  return { ...song, learningPlaythrough: 0 };
}

/** Changes the display key. Stored chords stay in `originalKey` (ADR-001). */
export function setCurrentKey(song: Song, key: string): Song {
  return { ...song, currentKey: key };
}
