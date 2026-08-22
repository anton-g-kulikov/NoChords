/**
 * The inline chord notation used to write and edit a row: `[Dm]O, where are you [C]going?`
 *
 * This is both the editing format and the format the development fixtures are written in. Parsing
 * turns it into a lyric plus positioned chord anchors (ADR-007); formatting turns it back, so the
 * editor can render a stored row as editable text without keeping a second copy of the source.
 */
import type { ChordAnchor } from '../types/song';

export interface InlineRow {
  lyrics: string;
  chords: ChordAnchor[];
}

/** Matches a bracketed chord. Nested brackets are not allowed, so an unclosed `[` stays literal. */
const CHORD_TAG = /\[([^[\]]*)\]/g;

/**
 * Splits inline text into its lyric and its positioned chords.
 * Anchors come back in ascending order, and the lyric keeps every character that was not markup.
 */
export function parseInlineRow(text: string): InlineRow {
  let lyrics = '';
  const chords: ChordAnchor[] = [];
  let cursor = 0;

  for (const match of text.matchAll(CHORD_TAG)) {
    lyrics += text.slice(cursor, match.index);
    const symbol = match[1].trim();
    // `[]` is markup with nothing in it; drop it rather than storing an empty chord.
    if (symbol !== '') chords.push({ symbol, index: lyrics.length });
    cursor = match.index + match[0].length;
  }

  lyrics += text.slice(cursor);
  return { lyrics, chords };
}

/** Renders a row back to inline notation. Inverse of {@link parseInlineRow}. */
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
  return text;
}
