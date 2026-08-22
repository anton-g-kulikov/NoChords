/**
 * Turns stored rows into what the player renders.
 *
 * Stored chords are always in `song.originalKey` (ADR-001), so:
 *  - `full` and `learning` transpose to the current display key;
 *  - `nashville` reads degrees straight off the original key, which is why the numbers do not
 *    move when the display key changes.
 */
import { transposeChord } from './chords';
import { toNashville } from './nashville';
import type { ChordAnchor, DisplayMode, Song, SongRow } from '../types/song';

/** The text to show for one stored chord symbol in the given mode. */
export function chordSymbolFor(symbol: string, song: Song, mode: DisplayMode): string {
  if (mode === 'nashville') {
    return toNashville(symbol, song.originalKey);
  }
  return transposeChord(symbol, song.originalKey, song.currentKey);
}

/**
 * A run of lyric text, optionally preceded by the chord played over its first character.
 *
 * Rendering a row as a sequence of these is what keeps the layout stable under concealment: the
 * chord and the lyric under it share one box, so hiding the chord changes nothing about where the
 * lyric — or any later chord — sits (ADR-007).
 */
export interface RowSegment {
  chord: ChordAnchor | null;
  /** Index of `chord` within the row's `chords` array, matching learning's occurrence keys. */
  chordIndex: number | null;
  text: string;
}

/** Splits a row into segments, one per chord plus any lyric text before the first chord. */
export function rowSegments(row: SongRow): RowSegment[] {
  const ordered = row.chords
    .map((chord, chordIndex) => ({ chord, chordIndex }))
    .sort((a, b) => a.chord.index - b.chord.index || a.chordIndex - b.chordIndex);

  if (ordered.length === 0) {
    return [{ chord: null, chordIndex: null, text: row.lyrics }];
  }

  const segments: RowSegment[] = [];
  const firstAt = Math.min(ordered[0].chord.index, row.lyrics.length);
  if (firstAt > 0) {
    segments.push({ chord: null, chordIndex: null, text: row.lyrics.slice(0, firstAt) });
  }

  ordered.forEach(({ chord, chordIndex }, position) => {
    const from = Math.min(chord.index, row.lyrics.length);
    const next = ordered[position + 1];
    const to = next ? Math.min(next.chord.index, row.lyrics.length) : row.lyrics.length;
    segments.push({ chord, chordIndex, text: row.lyrics.slice(from, Math.max(from, to)) });
  });

  return segments;
}
