/**
 * The inline notation a song is written in: `{6/8}[Dm]O, where are you [C]going?|2|`
 *
 * `[Chord]` anchors a chord to the following character (ADR-007). `|n|` sets how many bars the
 * line lasts (ADR-032), and `{n/d}` changes the time signature from this line on. Omit both and
 * the line uses the song's default. Everything else is lyric.
 *
 * `/n/` still parses as a raw beat count, for a line that does not sit on a bar boundary. Nothing
 * documents it, because a length that is not whole bars displaces every downbeat after it.
 *
 * None of the markups collide: a slash chord keeps its slash inside its brackets, and a bar tag
 * is pipes rather than slashes.
 */
import type { ChordAnchor } from '../types/song';

export interface InlineRow {
  lyrics: string;
  chords: ChordAnchor[];
  beats: number | null;
  bars: number | null;
  meter: string | null;
}

/** A bracketed chord. Nested brackets are not allowed, so an unclosed `[` stays literal. */
const CHORD_TAG = /\[([^[\]]*)\]/g;

/** A line-length tag: a number between slashes. */
const BEATS_TAG = /\/(\d+(?:\.\d+)?)\//g;

/** A bar-count tag: a number between pipes. */
const BARS_TAG = /\|(\d+)\|/g;

/** A time-signature tag: `{6/8}`. */
const METER_TAG = /\{\s*(\d+)\s*\/\s*(\d+)\s*\}/g;

/**
 * Splits one line of inline notation into its lyric, positioned chords, and length.
 * Anchors come back in ascending order, and the lyric keeps every character that was not markup.
 */
export function parseInlineRow(text: string): InlineRow {
  let beats: number | null = null;
  let bars: number | null = null;
  let meter: string | null = null;

  // Take the tags out first so they cannot disturb the chord offsets.
  const withoutTags = text
    .replace(METER_TAG, (_match, top: string, bottom: string) => {
      meter = `${Number(top)}/${Number(bottom)}`;
      return '';
    })
    .replace(BARS_TAG, (_match, value: string) => {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) bars = parsed;
      return '';
    })
    .replace(BEATS_TAG, (_match, value: string) => {
      const parsed = Number(value);
      // A later tag on the same line wins; zero or nonsense falls back to the song default.
      if (Number.isFinite(parsed) && parsed > 0) beats = parsed;
      return '';
    });

  let lyrics = '';
  const chords: ChordAnchor[] = [];
  let cursor = 0;

  for (const match of withoutTags.matchAll(CHORD_TAG)) {
    lyrics += withoutTags.slice(cursor, match.index);
    const symbol = match[1].trim();
    // `[]` is markup with nothing in it; drop it rather than storing an empty chord.
    if (symbol !== '') chords.push({ symbol, index: lyrics.length });
    cursor = match.index + match[0].length;
  }

  lyrics += withoutTags.slice(cursor);
  return { lyrics, chords, beats, bars, meter };
}

/**
 * Renders a row back to inline notation. A signature is written at the head of the line and any
 * length tag once at its end, so tags typed mid-line are normalised to where they read naturally.
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

  if (row.meter) text = `{${row.meter}}${text}`;
  // Bars are how a line says its length; beats are the undocumented escape hatch.
  if (row.bars && row.bars > 0) text = `${text}|${row.bars}|`;
  if (row.beats && row.beats > 0) text = `${text}/${row.beats}/`;
  return text;
}
