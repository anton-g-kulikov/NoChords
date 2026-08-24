/**
 * Playback timing.
 *
 * Playback is automated scrolling, not audio. This module turns a song into a plain schedule —
 * an array of row time windows — and answers "which row is active at time T". It holds no React
 * state and touches no DOM, so the clock driving it can later be swapped for an audio element's
 * `currentTime` without any of this logic changing (ADR-003).
 */
import { DEFAULT_METER, accentEveryOf, beatsPerBarOf, parseMeter } from './meter';
import type { SongRow } from '../types/song';

/** Bars each line occupies when a song does not say otherwise. */
export const DEFAULT_BARS_PER_LINE = 1;

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
  /** Beats from the start of the song — the metronome's own clock (ADR-026). */
  startBeat: number;
  /** How often the accent falls here, from the meter in effect (ADR-026). */
  accentEvery: number;
  /** Where the current meter began, so a signature change restarts the pulse rather than
   * inheriting the phase of the meter before it. */
  sectionStartBeat: number;
}

/**
 * Whether a row is a blank separator — no chords, and nothing but whitespace for lyrics.
 *
 * These are the empty lines between verses. They are structure, not music: they say where one
 * verse ends, and holding silence on one is not what the writer meant (ADR-025).
 */
export function isBlankRow(row: SongRow): boolean {
  return row.chords.length === 0 && row.lyrics.trim() === '';
}

/** Bars per line, falling back to the default for a missing or nonsensical value. */
function safeBars(barsPerLine: number): number {
  return barsPerLine && barsPerLine > 0 ? barsPerLine : DEFAULT_BARS_PER_LINE;
}

/**
 * Beats a row lasts: its own `|n|` bars if it has one, otherwise the song's default — measured
 * either way by the meter in effect (ADR-032).
 */
export function rowBeats(row: SongRow, barsPerLine: number, meter: string = DEFAULT_METER): number {
  const bars = row.bars && row.bars > 0 ? row.bars : safeBars(barsPerLine);
  return bars * beatsPerBarOf(meter);
}

/** How long a row is held. Everything is beats at the song tempo — no seconds (ADR-011). */
export function rowDurationMs(
  row: SongRow,
  tempo: number,
  barsPerLine: number,
  meter: string = DEFAULT_METER
): number {
  const safeTempo = Math.max(tempo, MIN_TEMPO);
  return (60000 / safeTempo) * rowBeats(row, barsPerLine, meter);
}

/**
 * Builds the full schedule for a song.
 *
 * Blank separator rows get no entry, so they take no time. Entries keep the index of the row they
 * came from, which is what everything downstream refers to — the schedule can be shorter than the
 * song without any caller having to know it (ADR-025).
 */
export function buildSchedule(
  rows: SongRow[],
  tempo: number,
  barsPerLine: number = DEFAULT_BARS_PER_LINE,
  songMeter: string = DEFAULT_METER
): ScheduleEntry[] {
  const schedule: ScheduleEntry[] = [];
  let cursor = 0;
  let beatCursor = 0;
  let meter = songMeter;
  let sectionStartBeat = 0;

  rows.forEach((row, index) => {
    // A `{n/d}` takes effect here and runs until the next one. It is read before the blank check,
    // so a signature may sit on the empty line between verses where a reader expects to see it.
    if (row.meter && parseMeter(row.meter)) {
      meter = row.meter;
      sectionStartBeat = beatCursor;
    }
    if (isBlankRow(row)) return;

    const beats = rowBeats(row, barsPerLine, meter);
    const durationMs = rowDurationMs(row, tempo, barsPerLine, meter);
    schedule.push({
      rowId: row.id,
      index,
      startMs: cursor,
      endMs: cursor + durationMs,
      durationMs,
      beats,
      startBeat: beatCursor,
      accentEvery: accentEveryOf(meter),
      sectionStartBeat,
    });
    cursor += durationMs;
    beatCursor += beats;
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

/**
 * The entry to play when someone asks for row `rowIndex`.
 *
 * A blank row has no entry of its own, so a tap on one lands on the next row that does play
 * rather than doing nothing — the tap was aimed at the music that follows.
 */
export function entryForRow(
  schedule: ScheduleEntry[],
  rowIndex: number
): ScheduleEntry | undefined {
  return schedule.find((entry) => entry.index >= rowIndex);
}

/** Whether the schedule has run to its end. */
export function isComplete(schedule: ScheduleEntry[], elapsedMs: number): boolean {
  return schedule.length > 0 && elapsedMs >= totalDurationMs(schedule);
}
