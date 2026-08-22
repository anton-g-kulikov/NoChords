/**
 * Temporarily revealing a line's concealed chords (ADR-018).
 *
 * A tap in learning mode brings a whole line back for a few seconds, then lets it go again. This
 * is deliberately *not* a change to the concealment: learning progress is untouched, and the
 * reveal expires on its own so the chart cannot quietly drift back to Full mode.
 *
 * Time is a parameter everywhere rather than read from a clock, which is what makes expiry
 * testable without waiting.
 */

/** How long a tapped line stays revealed. Long enough to read, short enough not to become a mode. */
export const REVEAL_MS = 4000;

/** Window within which a second tap on the same line counts as a double tap. */
export const DOUBLE_TAP_MS = 300;

/** Row id → the time its reveal ends. */
export type Reveals = Readonly<Record<string, number>>;

/** The last tap, for spotting a double. */
export interface LastTap {
  rowId: string;
  atMs: number;
}

/**
 * Reveals a line from `nowMs`.
 * Tapping an already-revealed line extends it rather than toggling it off — a second tap means
 * "I still need this", never "hide it again".
 */
export function revealRow(
  reveals: Reveals,
  rowId: string,
  nowMs: number,
  durationMs: number = REVEAL_MS
): Reveals {
  return { ...reveals, [rowId]: nowMs + durationMs };
}

/** Whether a line is revealed at `nowMs`. The expiry instant itself counts as over. */
export function isRevealed(reveals: Reveals, rowId: string, nowMs: number): boolean {
  const expiry = reveals[rowId];
  return expiry !== undefined && nowMs < expiry;
}

/**
 * Drops reveals that have run out.
 *
 * Returns the *same object* when nothing expired: this lands in React state, and handing back a
 * fresh object every tick would re-render the whole chart for no change.
 */
export function pruneReveals(reveals: Reveals, nowMs: number): Reveals {
  const live = Object.entries(reveals).filter(([, expiry]) => nowMs < expiry);
  if (live.length === Object.keys(reveals).length) return reveals;
  return Object.fromEntries(live);
}

/** When the soonest reveal ends, or `null` if nothing is revealed. */
export function nextExpiry(reveals: Reveals): number | null {
  const expiries = Object.values(reveals);
  return expiries.length === 0 ? null : Math.min(...expiries);
}

/** Whether this tap is the second of a double tap on the same line. */
export function isDoubleTap(last: LastTap | null, rowId: string, nowMs: number): boolean {
  if (!last || last.rowId !== rowId) return false;
  return nowMs - last.atMs < DOUBLE_TAP_MS;
}
