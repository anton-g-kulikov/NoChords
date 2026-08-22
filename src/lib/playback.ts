/**
 * Playback timing.
 *
 * Playback is automated scrolling, not audio. This module turns a song into a plain schedule —
 * an array of row time windows — and answers "which row is active at time T". It holds no React
 * state and touches no DOM, so the clock driving it can later be swapped for an audio element's
 * `currentTime` without any of this logic changing (ADR-003).
 */
import type { SongRow } from '../types/song';

/** Beats each line occupies when a song does not say otherwise. One bar in common time. */
export const DEFAULT_BEATS_PER_LINE = 4;

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
  /** Beats this row lasts, after the song default is applied. */
  beats: number;
}

/** Beats per line, falling back to the default for a missing or nonsensical value. */
function safeBeats(beatsPerLine: number): number {
  return beatsPerLine && beatsPerLine > 0 ? beatsPerLine : DEFAULT_BEATS_PER_LINE;
}

/** Beats a row lasts: its own `/n/` if it has one, otherwise the song's default. */
export function rowBeats(row: SongRow, beatsPerLine: number): number {
  return row.beats && row.beats > 0 ? row.beats : safeBeats(beatsPerLine);
}

/** How long a row is held. Everything is beats at the song tempo — no seconds (ADR-011). */
export function rowDurationMs(row: SongRow, tempo: number, beatsPerLine: number): number {
  const safeTempo = Math.max(tempo, MIN_TEMPO);
  return (60000 / safeTempo) * rowBeats(row, beatsPerLine);
}

/** Builds the full schedule for a song. */
export function buildSchedule(
  rows: SongRow[],
  tempo: number,
  beatsPerLine: number = DEFAULT_BEATS_PER_LINE
): ScheduleEntry[] {
  const schedule: ScheduleEntry[] = [];
  let cursor = 0;

  rows.forEach((row, index) => {
    const durationMs = rowDurationMs(row, tempo, beatsPerLine);
    schedule.push({
      rowId: row.id,
      index,
      startMs: cursor,
      endMs: cursor + durationMs,
      durationMs,
      beats: rowBeats(row, beatsPerLine),
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
