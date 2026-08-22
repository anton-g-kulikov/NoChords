import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BEATS,
  buildSchedule,
  isComplete,
  rowDurationMs,
  rowIndexAt,
  totalDurationMs,
} from '../src/lib/playback';
import type { SongRow } from '../src/types/song';

function row(id: string, pauseSeconds = 0, beats = 4): SongRow {
  return { id, chords: [{ symbol: 'C', index: 0 }], lyrics: 'a line', beats, pauseSeconds };
}

/** At 120bpm a 4-beat row lasts 2000ms, so these rows run 2000 / 2500 / 4000ms. */
const rows: SongRow[] = [row('r1', 0), row('r2', 0.5), row('r3', 2)];
const TEMPO = 120;

describe('rowDurationMs', () => {
  it('PB-01 derives the base duration from the tempo and the row beats', () => {
    expect(DEFAULT_BEATS).toBe(4);
    expect(rowDurationMs(row('r1', 0), 120)).toBe(2000);
    expect(rowDurationMs(row('r1', 0), 60)).toBe(4000);
    expect(rowDurationMs(row('r1', 0), 240)).toBe(1000);
  });

  it('PB-02 adds pauseSeconds on top of the normal duration', () => {
    expect(rowDurationMs(row('r1', 0.5), 120)).toBe(2500);
    expect(rowDurationMs(row('r1', 2), 120)).toBe(4000);
    // The pause is additive, not a replacement.
    expect(rowDurationMs(row('r1', 1), 120) - rowDurationMs(row('r1', 0), 120)).toBe(1000);
  });

  it('PB-10 scales with the row beat count', () => {
    // The fixtures are 3/4 songs written as six beats per row.
    expect(rowDurationMs(row('r1', 0, 6), 90)).toBe(4000);
    expect(rowDurationMs(row('r1', 0, 3), 120)).toBe(1500);
    expect(rowDurationMs(row('r1', 0, 8), 120)).toBe(4000);
  });

  it('PB-11 falls back to the default beat count for a missing or zero value', () => {
    expect(rowDurationMs(row('r1', 0, 0), 120)).toBe(2000);
    expect(rowDurationMs({ ...row('r1'), beats: undefined as unknown as number }, 120)).toBe(2000);
    expect(rowDurationMs(row('r1', 0, -4), 120)).toBe(2000);
  });

  it('ignores negative pauses rather than shortening the row', () => {
    expect(rowDurationMs(row('r1', -5), 120)).toBe(2000);
  });

  it('guards against a zero or negative tempo', () => {
    expect(Number.isFinite(rowDurationMs(row('r1', 0), 0))).toBe(true);
    expect(rowDurationMs(row('r1', 0), 0)).toBeGreaterThan(0);
    expect(Number.isFinite(rowDurationMs(row('r1', 0), -30))).toBe(true);
  });
});

describe('buildSchedule', () => {
  it('PB-03 accumulates start times across rows', () => {
    const schedule = buildSchedule(rows, TEMPO);
    expect(schedule.map((entry) => entry.startMs)).toEqual([0, 2000, 4500]);
    expect(schedule.map((entry) => entry.endMs)).toEqual([2000, 4500, 8500]);
    expect(schedule.map((entry) => entry.rowId)).toEqual(['r1', 'r2', 'r3']);
  });

  it('PB-04 totals the row durations plus their pauses', () => {
    const schedule = buildSchedule(rows, TEMPO);
    expect(totalDurationMs(schedule)).toBe(2000 + 2500 + 4000);
  });

  it('PB-08 produces an empty schedule and zero duration for an empty song', () => {
    const schedule = buildSchedule([], TEMPO);
    expect(schedule).toEqual([]);
    expect(totalDurationMs(schedule)).toBe(0);
    expect(rowIndexAt(schedule, 0)).toBe(-1);
    expect(isComplete(schedule, 0)).toBe(false);
  });

  it('PB-09 produces a shorter schedule at a faster tempo', () => {
    const slow = totalDurationMs(buildSchedule(rows, 60));
    const fast = totalDurationMs(buildSchedule(rows, 180));
    expect(fast).toBeLessThan(slow);
    // Pauses are fixed wall-clock time, so the schedule does not scale purely with tempo.
    expect(fast).toBeGreaterThan(0);
  });
});

describe('rowIndexAt', () => {
  const schedule = buildSchedule(rows, TEMPO);

  it('PB-05 resolves the active row for a given elapsed time', () => {
    expect(rowIndexAt(schedule, 0)).toBe(0);
    expect(rowIndexAt(schedule, 1999)).toBe(0);
    expect(rowIndexAt(schedule, 2000)).toBe(1);
    expect(rowIndexAt(schedule, 4499)).toBe(1);
    expect(rowIndexAt(schedule, 4500)).toBe(2);
    expect(rowIndexAt(schedule, 8499)).toBe(2);
  });

  it('PB-06 still reports the owning row while its pause is running', () => {
    // r2 plays 2000-4000ms, then holds its 500ms pause until 4500ms.
    expect(rowIndexAt(schedule, 4200)).toBe(1);
    // r3 plays 4500-6500ms, then holds a 2s pause until 8500ms.
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
