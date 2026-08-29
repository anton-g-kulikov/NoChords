import { describe, expect, it } from 'vitest';
import {
  accentAt,
  clickAt,
  beatsInWindow,
  countInDurationMs,
  countInSounded,
  isAccent,
} from '../src/lib/metronome';
import { buildSchedule } from '../src/lib/playback';
import type { SongRow } from '../src/types/song';

const row = (id: string): SongRow => ({ id, lyrics: id, chords: [], bars: null, meter: null });

/** Three bars of 4/4 at ♩ = 120: beats land every 500ms, from 0 to 11. */
const inFour = buildSchedule([row('a'), row('b'), row('c')], 120, 1, '4/4', 'quarter');

/** The indices of the beats a window yields, which is what most of these are about. */
const indices = (schedule: typeof inFour, beatMs: number, from: number, to: number) =>
  beatsInWindow(schedule, beatMs, from, to).map((beat) => beat.index);

describe('beatsInWindow times', () => {
  it('MT-01 takes each beat’s time from the row it belongs to', () => {
    const beats = beatsInWindow(inFour, 500, 0, 1600);
    expect(beats).toEqual([
      { index: 0, atMs: 0 },
      { index: 1, atMs: 500 },
      { index: 2, atMs: 1000 },
      { index: 3, atMs: 1500 },
    ]);
  });

  it('MT-02 follows a meter change, where a beat is a different length (ADR-052)', () => {
    // 6/8 at ♪ = 120 clicks eighths every 500ms; the {3/4} section counts quarters, which at the
    // same eighth pulse are 1000ms apart. One beat length for the whole song would drift here.
    const rows = [row('a'), { ...row('b'), meter: '3/4' }];
    const schedule = buildSchedule(rows, 120, 1, '6/8', 'eighth');

    expect(beatsInWindow(schedule, 500, 0, 3000)).toEqual([
      { index: 0, atMs: 0 },
      { index: 1, atMs: 500 },
      { index: 2, atMs: 1000 },
      { index: 3, atMs: 1500 },
      { index: 4, atMs: 2000 },
      { index: 5, atMs: 2500 },
    ]);
    // The second row is one bar of 3/4 — three beats of 1000ms, starting where the first ended.
    expect(beatsInWindow(schedule, 500, 3000, 6000)).toEqual([
      { index: 6, atMs: 3000 },
      { index: 7, atMs: 4000 },
      { index: 8, atMs: 5000 },
    ]);
  });
});

describe('countInSounded', () => {
  it('MT-19 lights one beat on the first click and all of them on the last', () => {
    // A count-in of four counts down 4, 3, 2, 1.
    expect([4, 3, 2, 1].map((left) => countInSounded(4, left))).toEqual([1, 2, 3, 4]);
  });

  it('MT-20 has nothing sounded when nothing is counting', () => {
    expect(countInSounded(4, 0)).toBe(0);
    expect(countInSounded(0, 0)).toBe(0);
    // The lead-in can report more left than there are beats; it never lights a beat that is not there.
    expect(countInSounded(4, 9)).toBe(0);
    expect(countInSounded(4, 5)).toBe(0);
  });
});

describe('countInDurationMs', () => {
  it('MT-03 is the count-in beats at the length of one beat', () => {
    expect(countInDurationMs(500, 4)).toBe(2000);
    expect(countInDurationMs(500, 0)).toBe(0);
    // A 3/4 song at ♩ = 90 counted in for two bars.
    expect(countInDurationMs(60000 / 90, 6)).toBeCloseTo(4000, 6);
  });

  it('MT-04 treats a negative count-in as none', () => {
    expect(countInDurationMs(500, -4)).toBe(0);
  });
});

describe('beatsInWindow', () => {
  it('MT-05 returns the beats falling in the window', () => {
    expect(indices(inFour, 500, 0, 1600)).toEqual([0, 1, 2, 3]);
    expect(indices(inFour, 500, 500, 1500)).toEqual([1, 2]);
  });

  it('MT-06 uses a half-open window so consecutive scans never double a click', () => {
    // A beat exactly on the boundary belongs to the later window, not both.
    expect(indices(inFour, 500, 0, 500)).toEqual([0]);
    expect(indices(inFour, 500, 500, 1000)).toEqual([1]);

    // Scanning forward in contiguous slices yields each beat exactly once, in order — which is
    // the property the scheduler depends on. The slice width is deliberately not a beat multiple.
    const seen: number[] = [];
    let from = 0;
    while (from < 4000) {
      seen.push(...indices(inFour, 500, from, from + 137));
      from += 137;
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    // The scan runs a little past 4000ms, so it covers beats 0..8.
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('MT-07 runs negative through the count-in (ADR-015)', () => {
    // A four-beat count-in occupies indices -4..-1, with the song starting at 0.
    expect(indices(inFour, 500, -2000, 0)).toEqual([-4, -3, -2, -1]);
    expect(indices(inFour, 500, -2000, 500)).toEqual([-4, -3, -2, -1, 0]);
  });

  it('MT-08 returns nothing for an empty or inverted window', () => {
    expect(indices(inFour, 500, 600, 600)).toEqual([]);
    expect(indices(inFour, 500, 900, 600)).toEqual([]);
  });

  it('MT-09 handles a window shorter than a beat', () => {
    expect(indices(inFour, 500, 100, 200)).toEqual([]);
    expect(indices(inFour, 500, 400, 600)).toEqual([1]);
  });

  it('MT-18 counts in on the given beat when there is no song to read one from', () => {
    expect(indices([], 500, -1200, 0)).toEqual([-2, -1]);
    expect(indices([], 500, 0, 2000)).toEqual([]);
  });
});

describe('isAccent', () => {
  it('MT-10 accents the first beat of each line', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((beat) => isAccent(beat, 4))).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('MT-11 accents on the song’s own line length, not a fixed bar', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((beat) => isAccent(beat, 6))).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('MT-12 accents correctly through negative count-in beats', () => {
    // A six-beat count-in lands its first beat on an accent, so the count reads as a bar.
    expect([-6, -5, -4, -3, -2, -1].map((beat) => isAccent(beat, 6))).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect([-4, -3, -2, -1].map((beat) => isAccent(beat, 4))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('MT-13 degrades to a plain 4/4 accent for a nonsensical line length', () => {
    // Not "accent everything", which is what a fallback of 1 would give.
    expect([0, 1, 2, 3, 4].map((beat) => isAccent(beat, 0))).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });
});

describe('accentAt', () => {
  function row(id: string): SongRow {
    return { id, chords: [{ symbol: 'C', index: 0 }], lyrics: 'a line', bars: null, meter: null };
  }

  it('MT-14 pulses a 6/8 song in two, not once a bar', () => {
    const schedule = buildSchedule([row('r1'), row('r2')], 80, 1, '6/8');
    // Beats 0 and 3 of each six-beat bar carry the click.
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((beat) => accentAt(beat, schedule))).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
  });

  it('MT-15 follows a signature change into the next section', () => {
    const bridge: SongRow = {
      id: 'r2',
      chords: [],
      lyrics: 'bridge',
      bars: 2,
      meter: '4/4',
    };
    const schedule = buildSchedule([row('r1'), bridge], 80, 1, '6/8');

    // Six beats of 6/8, accented at 0 and 3; then 4/4 from beat 6, accented at 6 and 10.
    expect([0, 3, 6, 7, 10].map((beat) => accentAt(beat, schedule))).toEqual([
      true,
      true,
      true,
      false,
      true,
    ]);
    // Beat 9 would be an accent if the old 6/8 phase had carried through. It must not.
    expect(accentAt(9, schedule)).toBe(false);
  });

  it('MT-16 accents the count-in so it lands on the downbeat', () => {
    const schedule = buildSchedule([row('r1')], 80, 1, '6/8');
    expect(accentAt(-3, schedule)).toBe(true);
    expect(accentAt(-2, schedule)).toBe(false);
    expect(accentAt(0, schedule)).toBe(true);
  });

  it('MT-17 falls back to a plain four when there is nothing to play', () => {
    expect(accentAt(0, [])).toBe(true);
    expect(accentAt(4, [])).toBe(true);
    expect(accentAt(5, [])).toBe(false);
  });
});

describe('clickAt', () => {
  it('MT-18 fires a click early by the output latency, so it is heard on the beat', () => {
    // Origin at audio time 10s, beat at 2s in, device 150ms behind: fire at 11.85 to be heard
    // at 12.0.
    expect(clickAt(10, 2000, 0.15)).toBeCloseTo(11.85, 6);
  });

  it('MT-19 is the plain sum when the device reports no latency', () => {
    expect(clickAt(10, 2000, 0)).toBeCloseTo(12, 6);
  });

  it('MT-20 keeps every click the same distance apart', () => {
    // Compensation shifts the whole grid; it must not stretch it.
    const a = clickAt(10, 0, 0.2);
    const b = clickAt(10, 500, 0.2);
    const c = clickAt(10, 1000, 0.2);
    expect(b - a).toBeCloseTo(0.5, 6);
    expect(c - b).toBeCloseTo(0.5, 6);
  });

  it('MT-21 refuses to push a click later on a nonsensical latency', () => {
    expect(clickAt(10, 1000, -5)).toBeCloseTo(11, 6);
  });
});

