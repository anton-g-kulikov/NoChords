import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BEATS_PER_LINE,
  buildSchedule,
  entryForRow,
  isBlankRow,
  isComplete,
  rowBeats,
  rowDurationMs,
  rowIndexAt,
  totalDurationMs,
} from '../src/lib/playback';
import type { SongRow } from '../src/types/song';

function row(id: string, beats: number | null = null): SongRow {
  return { id, chords: [{ symbol: 'C', index: 0 }], lyrics: 'a line', beats, bars: null, meter: null };
}

/** A separator between verses: nothing but whitespace, and no chords. */
function blank(id: string, lyrics = ''): SongRow {
  return { id, chords: [], lyrics, beats: null, bars: null, meter: null };
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

describe('blank separator rows', () => {
  it('PB-10 recognises a row with no chords and no lyric text', () => {
    expect(isBlankRow(blank('b1'))).toBe(true);
    expect(isBlankRow(blank('b2', '   '))).toBe(true);
    expect(isBlankRow(row('r1'))).toBe(false);
    // An instrumental bar is not blank: it has chords and is meant to be played.
    expect(
      isBlankRow({
        id: 'i1',
        chords: [{ symbol: 'C', index: 0 }],
        lyrics: '  ',
        beats: null,
        bars: null,
        meter: null,
      })
    ).toBe(false);
  });

  it('PB-11 leaves blank rows out of the schedule and charges them no time', () => {
    const withGaps = [row('r1'), blank('b1'), row('r2'), blank('b2'), row('r3')];
    const schedule = buildSchedule(withGaps, TEMPO, BEATS);

    expect(schedule).toHaveLength(3);
    // Three ordinary rows at 120bpm and four beats: 2000ms each, back to back.
    expect(totalDurationMs(schedule)).toBe(6000);
    expect(schedule.map((entry) => entry.startMs)).toEqual([0, 2000, 4000]);
  });

  it('PB-12 keeps entries pointing at the row they came from', () => {
    const withGaps = [row('r1'), blank('b1'), row('r2'), blank('b2'), row('r3')];
    const schedule = buildSchedule(withGaps, TEMPO, BEATS);

    // The song's own indices, not positions in the schedule — the UI still renders every row.
    expect(schedule.map((entry) => entry.index)).toEqual([0, 2, 4]);
    expect(schedule.map((entry) => entry.rowId)).toEqual(['r1', 'r2', 'r3']);

    // So the active row never lands on a blank one.
    expect(rowIndexAt(schedule, 0)).toBe(0);
    expect(rowIndexAt(schedule, 2500)).toBe(2);
    expect(rowIndexAt(schedule, 4500)).toBe(4);
  });

  it('PB-13 seeks a blank row forward to the next row that plays', () => {
    const withGaps = [row('r1'), blank('b1'), row('r2'), blank('b2'), row('r3')];
    const schedule = buildSchedule(withGaps, TEMPO, BEATS);

    expect(entryForRow(schedule, 2)?.rowId).toBe('r2');
    // A tap on the gap was aimed at the verse after it.
    expect(entryForRow(schedule, 1)?.rowId).toBe('r2');
    expect(entryForRow(schedule, 3)?.rowId).toBe('r3');
    // Nothing plays after a trailing blank, so there is nowhere to seek.
    expect(entryForRow(buildSchedule([row('r1'), blank('b1')], TEMPO, BEATS), 1)).toBeUndefined();
  });

  it('PB-14 treats an all-blank song as having nothing to play', () => {
    const schedule = buildSchedule([blank('b1'), blank('b2')], TEMPO, BEATS);
    expect(schedule).toHaveLength(0);
    expect(totalDurationMs(schedule)).toBe(0);
    expect(rowIndexAt(schedule, 0)).toBe(-1);
  });
});

describe('bars and meter', () => {
  /** A row that states its length in bars. */
  function barRow(id: string, bars: number, meter: string | null = null): SongRow {
    return { id, chords: [{ symbol: 'C', index: 0 }], lyrics: 'a line', beats: null, bars, meter };
  }

  it('PB-15 measures a bar count against the meter in effect', () => {
    // Two bars of 6/8 is twelve beats; of 3/4, six.
    expect(rowBeats(barRow('r1', 2), 4, '6/8')).toBe(12);
    expect(rowBeats(barRow('r1', 2), 4, '3/4')).toBe(6);
    expect(rowBeats(barRow('r1', 3), 4, '6/8')).toBe(18);
  });

  it('PB-16 lets an explicit beat count win over a bar count', () => {
    // The solo that runs twenty-four beats over the same four chords.
    const solo: SongRow = {
      id: 'solo',
      chords: [],
      lyrics: 'solo',
      beats: 24,
      bars: 4,
      meter: null,
    };
    expect(rowBeats(solo, 4, '6/8')).toBe(24);
  });

  it('PB-17 falls back to the song default when a row says neither', () => {
    expect(rowBeats(row('r1'), 6, '6/8')).toBe(6);
  });

  it('PB-18 carries the accent spacing of the meter running at each row', () => {
    const schedule = buildSchedule([row('r1'), row('r2')], TEMPO, 6, '6/8');
    // 6/8 is felt in two: an accent every three beats, not one every six.
    expect(schedule.map((entry) => entry.accentEvery)).toEqual([3, 3]);
    expect(buildSchedule([row('r1')], TEMPO, 4, '4/4')[0].accentEvery).toBe(4);
  });

  it('PB-19 restarts the pulse where a signature changes mid-song', () => {
    const rows = [row('r1'), barRow('r2', 1, '4/4'), row('r3')];
    const schedule = buildSchedule(rows, TEMPO, 6, '6/8');

    // Row 1 runs six beats of 6/8, then the bridge starts its own four.
    expect(schedule.map((entry) => entry.startBeat)).toEqual([0, 6, 10]);
    expect(schedule.map((entry) => entry.accentEvery)).toEqual([3, 4, 4]);
    expect(schedule.map((entry) => entry.sectionStartBeat)).toEqual([0, 6, 6]);
    // One bar of 4/4 is four beats, so the row after it starts at beat 10.
    expect(schedule[1].beats).toBe(4);
  });

  it('PB-20 applies a signature written on a blank line between verses', () => {
    const rows = [row('r1'), { ...blank('b1'), meter: '4/4' }, row('r2')];
    const schedule = buildSchedule(rows, TEMPO, 6, '6/8');

    // The blank still plays nothing, but the change it carries takes effect.
    expect(schedule).toHaveLength(2);
    expect(schedule.map((entry) => entry.accentEvery)).toEqual([3, 4]);
  });
});

