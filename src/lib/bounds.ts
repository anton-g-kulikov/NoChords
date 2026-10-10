/**
 * The largest numbers a song may carry (ADR-108).
 *
 * Song text is shared by pasting — from the public archive or anyone's chart — so whatever a song
 * says reaches the beat strip, which draws a dot per beat, and the metronome, which schedules every
 * beat it is given. Unbounded, one line of `{99999999/4}` or `|999999999|` froze the tab. These are
 * applied wherever a song comes in: the line parser, the meter parser, and the storage validator
 * that both local and synced songs pass through.
 */

/** Beats in one bar. The editor offers up to 12; 32 is generous for anything written by hand. */
export const MAX_BEATS_PER_BAR = 32;

/** Bars in one line, for a line's own `|n|` and for a song's default — the editor's own maximum. */
export const MAX_BARS_PER_LINE = 64;

/** Characters in a song's title: a long title, not a pasted page — the same cap the database keeps. */
export const MAX_TITLE_LENGTH = 200;

/** A line length that is a whole number of bars within range, or `null` for "use the default". */
export function boundedBars(value: number): number | null {
  return Number.isInteger(value) && value >= 1 && value <= MAX_BARS_PER_LINE ? value : null;
}
