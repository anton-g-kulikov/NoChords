/**
 * Song and row state transitions.
 *
 * Every function here is pure: it takes a song and returns a new one. Keeping these outside React
 * means the whole editing model is unit-testable, and it is the seam a future backend would sit
 * behind (ADR-005).
 */
import { CONCEALMENT_STAGES } from './learning';
import { formatInlineRow, parseInlineRow } from './inline';
import { DEFAULT_BEATS_PER_LINE } from './playback';
import { DEFAULT_METER } from './meter';
import type { Song, SongRow } from '../types/song';

export { DEFAULT_BEATS_PER_LINE };

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
    beats: null,
    bars: null,
    meter: null,
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
    beatsPerLine: DEFAULT_BEATS_PER_LINE,
    meter: DEFAULT_METER,
    learningPlaythrough: 0,
    rows: [createRow()],
    ...overrides,
  };
}

/** Renders a whole song as the text the editor shows: one line of inline notation per row. */
export function songToText(song: Song): string {
  return song.rows.map((row) => formatInlineRow(row)).join('\n');
}

/**
 * Parses the editor's text back into rows, one per line (ADR-010).
 *
 * Ids are reused positionally from `existing` so that editing a line does not change its identity —
 * which matters because learning concealment addresses chords by row id.
 */
export function textToRows(text: string, existing: SongRow[] = []): SongRow[] {
  return text.split('\n').map((line, index) => {
    const parsed = parseInlineRow(line);
    const id = existing[index]?.id;
    return id ? { id, ...parsed } : createRow(parsed);
  });
}

/**
 * Converts pasted text into rows, one per line.
 * Trailing blank lines are dropped; interior ones are kept, since they usually separate sections.
 */
export function rowsFromPastedText(text: string): SongRow[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  return lines.map((line) => createRow(parseInlineRow(line)));
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
