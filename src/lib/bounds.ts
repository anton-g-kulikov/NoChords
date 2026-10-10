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

/**
 * Lines in a song. The database refuses a song with more (ADR-108), so the app stops here first:
 * a refused save is lost silently, a capped one is not.
 */
export const MAX_ROWS = 1000;

/**
 * Characters in a song's text. Firestore refuses a document over 1 MiB, and a chord costs far more
 * stored than typed — about 25 bytes for its fields — so chord-dense text is the worst case: at
 * 200,000 characters, "[C]" over and over came to 1.5 MiB. At 100,000 it stays under the limit,
 * and plain Cyrillic lyrics, two bytes a letter, sit far below it (ADR-108).
 */
export const MAX_SONG_TEXT = 100_000;

/** A line length that is a whole number of bars within range, or `null` for "use the default". */
export function boundedBars(value: number): number | null {
  return Number.isInteger(value) && value >= 1 && value <= MAX_BARS_PER_LINE ? value : null;
}
