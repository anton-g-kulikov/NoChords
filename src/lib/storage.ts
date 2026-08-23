/**
 * Local persistence.
 *
 * The store is created over an injectable `StorageLike` port rather than reaching for
 * `localStorage` directly. That keeps it testable without a DOM and gives a future backend one
 * seam to slot into instead of a rewrite of the UI (ADR-005).
 *
 * Stored data is untrusted input — another tab, an older app version, or a user with devtools can
 * all put nonsense in it — so everything read back is validated before it reaches the app.
 */
import { DEFAULT_METER, parseMeter } from './meter';
import type { ChordAnchor, Song, SongRow } from '../types/song';

export const STORAGE_KEY = 'nochords.songs.v1';

/** The subset of the Web Storage API this app needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * How the app reaches its songs, wherever they live (ADR-020).
 *
 * Asynchronous and per-song because the other implementation is a network store: it cannot answer
 * synchronously, and rewriting the whole library on every keystroke would be a write per song per
 * keystroke. `subscribe` is optional — nothing changes a local library underneath you.
 */
export interface SongStore {
  load(): Promise<Song[]>;
  saveSong(song: Song): Promise<void>;
  deleteSong(songId: string): Promise<void>;
  clear(): Promise<void>;
  subscribe?(onChange: (songs: Song[]) => void): () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeChord(value: unknown): ChordAnchor | null {
  if (!isRecord(value)) return null;
  const { symbol, index } = value;
  if (typeof symbol !== 'string' || symbol === '') return null;
  if (typeof index !== 'number' || !Number.isFinite(index) || index < 0) return null;
  return { symbol, index };
}

/**
 * An optional positive number, absent in anything written before the field existed.
 * `undefined` and `null` both mean "not set"; a wrong type is corruption and rejects the row.
 */
function sanitizeOptionalCount(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function sanitizeRow(value: unknown): SongRow | null {
  if (!isRecord(value)) return null;
  const { id, lyrics, chords, beats, bars, meter } = value;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof lyrics !== 'string') return null;
  if (!Array.isArray(chords)) return null;
  // `null` is the normal case: the line takes the song's default length.
  if (beats !== null && (typeof beats !== 'number' || !Number.isFinite(beats))) return null;

  const sanitizedBars = sanitizeOptionalCount(bars);
  if (sanitizedBars === undefined) return null;
  // A row-level signature is optional and, if present, must be one: an unreadable one is dropped
  // rather than fatal, since the song still plays in whatever meter is already running.
  if (meter !== null && meter !== undefined && typeof meter !== 'string') return null;
  const sanitizedMeter = typeof meter === 'string' && parseMeter(meter) ? meter : null;

  const sanitizedChords: ChordAnchor[] = [];
  for (const chord of chords) {
    const sanitized = sanitizeChord(chord);
    if (!sanitized) return null;
    sanitizedChords.push(sanitized);
  }

  return { id, lyrics, chords: sanitizedChords, beats, bars: sanitizedBars, meter: sanitizedMeter };
}

/**
 * Validates one stored song, returning `null` if any required field is missing or wrongly typed.
 *
 * Exported because a Firestore document crosses the same trust boundary as stored JSON, and both
 * routes into the app should agree on exactly what counts as a song (ADR-021).
 */
export function sanitizeSong(value: unknown): Song | null {
  if (!isRecord(value)) return null;
  const {
    id,
    title,
    originalKey,
    currentKey,
    tempo,
    beatsPerLine,
    meter,
    learningPlaythrough,
    rows,
  } = value;

  if (typeof id !== 'string' || id === '') return null;
  if (typeof title !== 'string') return null;
  if (typeof originalKey !== 'string' || typeof currentKey !== 'string') return null;
  if (typeof tempo !== 'number' || !Number.isFinite(tempo)) return null;
  if (typeof beatsPerLine !== 'number' || !Number.isFinite(beatsPerLine)) return null;
  if (typeof learningPlaythrough !== 'number' || !Number.isFinite(learningPlaythrough)) return null;
  if (!Array.isArray(rows)) return null;

  const sanitizedRows: SongRow[] = [];
  for (const row of rows) {
    const sanitized = sanitizeRow(row);
    // One bad row invalidates the song rather than silently losing a line of the chart.
    if (!sanitized) return null;
    sanitizedRows.push(sanitized);
  }

  return {
    id,
    title,
    originalKey,
    currentKey,
    tempo,
    beatsPerLine,
    // Songs written before meters existed are in four: that is what they were played as.
    meter: typeof meter === 'string' && parseMeter(meter) ? meter : DEFAULT_METER,
    learningPlaythrough,
    rows: sanitizedRows,
  };
}

/** `localStorage` when it is available and usable, otherwise `null`. */
export function defaultStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    // Access itself throws when cookies/site data are blocked.
    return null;
  }
}

/**
 * Creates a song store over the given backend.
 * Every operation is failure-tolerant: a full, blocked, or corrupt store degrades to an empty
 * library rather than breaking the app.
 */
export function createSongStore(storage: StorageLike | null = defaultStorage()): SongStore {
  /** Reads and validates the whole library. A corrupt or blocked store reads as empty. */
  const readAll = (): Song[] => {
    if (!storage) return [];
    let raw: string | null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      return [];
    }
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    const songs: Song[] = [];
    for (const entry of parsed) {
      const song = sanitizeSong(entry);
      if (song) songs.push(song);
    }
    return songs;
  };

  const writeAll = (songs: Song[]): void => {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(songs));
    } catch {
      // Quota exceeded or storage blocked: the in-memory session keeps working.
    }
  };

  return {
    async load(): Promise<Song[]> {
      return readAll();
    },

    async saveSong(song: Song): Promise<void> {
      const songs = readAll();
      const index = songs.findIndex((item) => item.id === song.id);
      if (index === -1) songs.push(song);
      else songs[index] = song;
      writeAll(songs);
    },

    async deleteSong(songId: string): Promise<void> {
      writeAll(readAll().filter((song) => song.id !== songId));
    },

    async clear(): Promise<void> {
      if (!storage) return;
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing useful to do.
      }
    },
  };
}
