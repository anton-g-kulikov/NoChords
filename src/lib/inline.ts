/**
 * The inline notation a song is written in: `[Dm]O, where are you [C]going?/6/`
 *
 * `[Chord]` anchors a chord to the following character (ADR-007). `/n/` sets how many beats the
 * line lasts (ADR-011); omit it and the line uses the song's default. Everything else is lyric.
 *
 * The two markups cannot collide: a slash chord keeps its slash inside its brackets.
 */
import type { ChordAnchor } from '../types/song';

export interface InlineRow {
  lyrics: string;
  chords: ChordAnchor[];
  beats: number | null;
}

/** A bracketed chord. Nested brackets are not allowed, so an unclosed `[` stays literal. */
const CHORD_TAG = /\[([^[\]]*)\]/g;

/** A line-length tag: a number between slashes. */
const BEATS_TAG = /\/(\d+(?:\.\d+)?)\//g;

/**
 * Splits one line of inline notation into its lyric, positioned chords, and length.
 * Anchors come back in ascending order, and the lyric keeps every character that was not markup.
 */
export function parseInlineRow(text: string): InlineRow {
  let beats: number | null = null;

  // Take the length tag out first so it cannot disturb the chord offsets.
  const withoutBeats = text.replace(BEATS_TAG, (_match, value: string) => {
    const parsed = Number(value);
    // A later tag on the same line wins; zero or nonsense falls back to the song default.
    if (Number.isFinite(parsed) && parsed > 0) beats = parsed;
    return '';
  });

  let lyrics = '';
  const chords: ChordAnchor[] = [];
  let cursor = 0;

  for (const match of withoutBeats.matchAll(CHORD_TAG)) {
    lyrics += withoutBeats.slice(cursor, match.index);
    const symbol = match[1].trim();
    // `[]` is markup with nothing in it; drop it rather than storing an empty chord.
    if (symbol !== '') chords.push({ symbol, index: lyrics.length });
    cursor = match.index + match[0].length;
  }

  lyrics += withoutBeats.slice(cursor);
  return { lyrics, chords, beats };
}

/**
 * Renders a row back to inline notation. Any length tag is written once at the end of the line,
 * so a tag typed mid-line is normalised to where it reads naturally.
 */
export function formatInlineRow(row: InlineRow): string {
  // Insert from the end so earlier offsets stay valid; equal offsets keep their stored order.
  const ordered = [...row.chords]
    .map((chord, order) => ({ chord, order }))
    .sort((a, b) => a.chord.index - b.chord.index || a.order - b.order);

  let text = row.lyrics;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const { chord } = ordered[i];
    const at = Math.max(0, Math.min(chord.index, row.lyrics.length));
    text = `${text.slice(0, at)}[${chord.symbol}]${text.slice(at)}`;
  }

  return row.beats && row.beats > 0 ? `${text}/${row.beats}/` : text;
}
