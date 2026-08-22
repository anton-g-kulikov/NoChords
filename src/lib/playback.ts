/**
 * Playback timing.
 *
 * Playback is automated scrolling, not audio. This module turns a song into a plain schedule —
 * an array of row time windows — and answers "which row is active at time T". It holds no React
 * state and touches no DOM, so the clock driving it can later be swapped for an audio element's
 * `currentTime` without any of this logic changing (ADR-003).
 */
import type { SongRow } from '../types/song';

/** Beats a row occupies when it does not specify its own count. One bar in common time. */
export const DEFAULT_BEATS = 4;

/** Floor applied to tempo so a zero or negative value cannot produce an infinite duration. */
export const MIN_TEMPO = 20;

/** One row's time window: its normal duration at tempo, plus its trailing pause. */
export interface ScheduleEntry {
  rowId: string;
  index: number;
  /** Milliseconds from the start of the song. */
  startMs: number;
  /** Exclusive end, i.e. the start of the next row. */
  endMs: number;
  durationMs: number;
  /** The portion of `durationMs` contributed by the row's pause. */
  pauseMs: number;
}

/** Beats a row occupies, falling back to the default for a missing or nonsensical value. */
function beatsOf(row: SongRow): number {
  return row.beats && row.beats > 0 ? row.beats : DEFAULT_BEATS;
}

/** Total time a row is held: its tempo-derived duration plus its pause (ADR-008). */
export function rowDurationMs(row: SongRow, tempo: number): number {
  const safeTempo = Math.max(tempo, MIN_TEMPO);
  const beatMs = 60000 / safeTempo;
  const pauseMs = Math.max(0, row.pauseSeconds || 0) * 1000;
  return beatMs * beatsOf(row) + pauseMs;
}

/** Builds the full schedule for a song. */
export function buildSchedule(rows: SongRow[], tempo: number): ScheduleEntry[] {
  const schedule: ScheduleEntry[] = [];
  let cursor = 0;

  rows.forEach((row, index) => {
    const durationMs = rowDurationMs(row, tempo);
    const pauseMs = Math.max(0, row.pauseSeconds || 0) * 1000;
    schedule.push({
      rowId: row.id,
      index,
      startMs: cursor,
      endMs: cursor + durationMs,
      durationMs,
      pauseMs,
    });
    cursor += durationMs;
  });

  return schedule;
}

/** Length of the whole song in milliseconds. */
export function totalDurationMs(schedule: ScheduleEntry[]): number {
  return schedule.length === 0 ? 0 : schedule[schedule.length - 1].endMs;
}

/**
 * Index of the row active at `elapsedMs`, or `-1` once the song has finished
 * (or if there is nothing to play). Times before the start resolve to the first row.
 */
export function rowIndexAt(schedule: ScheduleEntry[], elapsedMs: number): number {
  if (schedule.length === 0) return -1;
  if (elapsedMs < 0) return 0;
  if (elapsedMs >= totalDurationMs(schedule)) return -1;

  for (const entry of schedule) {
    if (elapsedMs < entry.endMs) return entry.index;
  }
  return -1;
}

/** Whether the schedule has run to its end. */
export function isComplete(schedule: ScheduleEntry[], elapsedMs: number): boolean {
  return schedule.length > 0 && elapsedMs >= totalDurationMs(schedule);
}
