import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BEATS_PER_LINE,
  buildSchedule,
  isComplete,
  rowBeats,
  rowDurationMs,
  rowIndexAt,
  totalDurationMs,
} from '../src/lib/playback';
import type { SongRow } from '../src/types/song';

function row(id: string, beats: number | null = null): SongRow {
  return { id, chords: [{ symbol: 'C', index: 0 }], lyrics: 'a line', beats };
}

/** At 120bpm a beat is 500ms, so these rows run 2000 / 2500 / 4000ms. */
const rows: SongRow[] = [row('r1'), row('r2', 5), row('r3', 8)];
const TEMPO = 120;
const BEATS = 4;

describe('rowDurationMs', () => {
  it('PB-01 derives the duration from the tempo and the beat count', () => {
    expect(DEFAULT_BEATS_PER_LINE).toBe(4);
    expect(rowDurationMs(row('r1'), 120, BEATS)).toBe(2000);
    expect(rowDurationMs(row('r1'), 60, BEATS)).toBe(4000);
    expect(rowDurationMs(row('r1'), 240, BEATS)).toBe(1000);
  });

  it('PB-02 lets a line override the song default with its own beat count', () => {
    // The fixtures are 3/4 songs written as two bars a line, with held verse endings.
    expect(rowDurationMs(row('r1', 6), 90, 4)).toBe(4000);
    expect(rowDurationMs(row('r1', 12), 90, 6)).toBe(8000);
    expect(rowBeats(row('r1', 12), 6)).toBe(12);
  });

  it('PB-10 uses the song default when the line does not say', () => {
    expect(rowBeats(row('r1'), 6)).toBe(6);
    expect(rowDurationMs(row('r1'), 90, 6)).toBe(4000);
  });

  it('PB-11 falls back to the default for a zero or negative beat count', () => {
    expect(rowDurationMs(row('r1', 0), 120, BEATS)).toBe(2000);
    expect(rowDurationMs(row('r1', -4), 120, BEATS)).toBe(2000);
    expect(rowDurationMs(row('r1'), 120, 0)).toBe(2000);
  });

  it('PB-12 has no notion of seconds: tempo rescales the whole song', () => {
    const slow = totalDurationMs(buildSchedule(rows, 60, BEATS));
    const fast = totalDurationMs(buildSchedule(rows, 120, BEATS));
    // Doubling the tempo exactly halves every line, held ones included.
    expect(slow).toBe(fast * 2);
  });

  it('guards against a zero or negative tempo', () => {
    expect(Number.isFinite(rowDurationMs(row('r1'), 0, BEATS))).toBe(true);
    expect(rowDurationMs(row('r1'), 0, BEATS)).toBeGreaterThan(0);
    expect(Number.isFinite(rowDurationMs(row('r1'), -30, BEATS))).toBe(true);
  });
});

describe('buildSchedule', () => {
  it('PB-03 accumulates start times across rows', () => {
    const schedule = buildSchedule(rows, TEMPO, BEATS);
    expect(schedule.map((entry) => entry.startMs)).toEqual([0, 2000, 4500]);
    expect(schedule.map((entry) => entry.endMs)).toEqual([2000, 4500, 8500]);
    expect(schedule.map((entry) => entry.rowId)).toEqual(['r1', 'r2', 'r3']);
  });

  it('PB-04 totals the row durations', () => {
    const schedule = buildSchedule(rows, TEMPO, BEATS);
    expect(totalDurationMs(schedule)).toBe(2000 + 2500 + 4000);
    expect(schedule.map((entry) => entry.beats)).toEqual([4, 5, 8]);
  });

  it('PB-08 produces an empty schedule and zero duration for an empty song', () => {
    const schedule = buildSchedule([], TEMPO, BEATS);
    expect(schedule).toEqual([]);
    expect(totalDurationMs(schedule)).toBe(0);
    expect(rowIndexAt(schedule, 0)).toBe(-1);
    expect(isComplete(schedule, 0)).toBe(false);
  });

  it('PB-09 produces a shorter schedule at a faster tempo', () => {
    const slow = totalDurationMs(buildSchedule(rows, 60, BEATS));
    const fast = totalDurationMs(buildSchedule(rows, 180, BEATS));
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeGreaterThan(0);
  });
});

describe('rowIndexAt', () => {
  const schedule = buildSchedule(rows, TEMPO, BEATS);

  it('PB-05 resolves the active row for a given elapsed time', () => {
    expect(rowIndexAt(schedule, 0)).toBe(0);
    expect(rowIndexAt(schedule, 1999)).toBe(0);
    expect(rowIndexAt(schedule, 2000)).toBe(1);
    expect(rowIndexAt(schedule, 4499)).toBe(1);
    expect(rowIndexAt(schedule, 4500)).toBe(2);
    expect(rowIndexAt(schedule, 8499)).toBe(2);
  });

  it('PB-06 holds a longer line for its whole length', () => {
    // r2 is a five-beat line running 2000-4500ms.
    expect(rowIndexAt(schedule, 4200)).toBe(1);
    // r3 is an eight-beat line running 4500-8500ms.
    expect(rowIndexAt(schedule, 7000)).toBe(2);
  });

  it('PB-07 reports completion once the schedule has run out', () => {
    expect(isComplete(schedule, 8499)).toBe(false);
    expect(isComplete(schedule, 8500)).toBe(true);
    expect(rowIndexAt(schedule, 8500)).toBe(-1);
    expect(rowIndexAt(schedule, 99999)).toBe(-1);
  });

  it('treats a negative elapsed time as the first row', () => {
    expect(rowIndexAt(schedule, -100)).toBe(0);
  });
});
