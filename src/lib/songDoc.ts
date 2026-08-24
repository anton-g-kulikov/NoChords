/**
 * Mapping a song to and from a Firestore document (ADR-021).
 *
 * A document is untrusted in exactly the way stored JSON is: it can have been written by an older
 * version of the app, or edited by hand in the console. So reading one validates rather than
 * casts, and a document that does not describe a song is rejected outright instead of arriving
 * half-formed.
 *
 * Writing is the mirror image, and must never emit `undefined` — Firestore refuses it.
 */
import { DEFAULT_METER } from './meter';
import { sanitizeSong } from './storage';
import type { Song } from '../types/song';

/** The stored shape. Structurally a `Song`; named apart because it crosses a trust boundary. */
export type SongDoc = Song;

/** Builds the document to store. Only known fields, and never `undefined`. */
export function songToDoc(song: Song): SongDoc {
  return {
    id: song.id,
    title: song.title,
    originalKey: song.originalKey,
    currentKey: song.currentKey,
    tempo: song.tempo,
    barsPerLine: song.barsPerLine,
    // Never `undefined`: Firestore rejects the entire document for one undefined field, which
    // would lose a whole song rather than one value.
    meter: song.meter ?? DEFAULT_METER,
    learningPlaythrough: song.learningPlaythrough,
    rows: song.rows.map((row) => ({
      id: row.id,
      lyrics: row.lyrics,
      chords: row.chords.map((chord) => ({ symbol: chord.symbol, index: chord.index })),
      // `null` rather than omitted: the fields mean "use the song default", and Firestore
      // would reject `undefined` outright.
      bars: row.bars ?? null,
      meter: row.meter ?? null,
    })),
  };
}

/**
 * Reads a document back, or `null` if it does not describe a song.
 * Shares its validation with local storage, so both routes into the app agree on what a song is.
 */
export function songFromDoc(value: unknown): Song | null {
  return sanitizeSong(value);
}
