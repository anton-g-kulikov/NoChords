import { describe, expect, it } from 'vitest';
import {
  accentAt,
  beatDurationMs,
  clickAt,
  beatsInWindow,
  countInDurationMs,
  isAccent,
} from '../src/lib/metronome';
import { buildSchedule } from '../src/lib/playback';
import type { SongRow } from '../src/types/song';

describe('beatDurationMs', () => {
  it('MT-01 derives the beat length from the tempo', () => {
    expect(beatDurationMs(120)).toBe(500);
    expect(beatDurationMs(60)).toBe(1000);
    expect(beatDurationMs(90)).toBeCloseTo(666.667, 2);
  });

  it('MT-02 guards against a zero or negative tempo', () => {
    expect(Number.isFinite(beatDurationMs(0))).toBe(true);
    expect(beatDurationMs(0)).toBeGreaterThan(0);
    expect(beatDurationMs(-40)).toBe(beatDurationMs(0));
  });
});

describe('countInDurationMs', () => {
  it('MT-03 is the count-in beats at the song tempo', () => {
    expect(countInDurationMs(120, 4)).toBe(2000);
    expect(countInDurationMs(120, 0)).toBe(0);
    // A 3/4 song counted in for two bars.
    expect(countInDurationMs(90, 6)).toBeCloseTo(4000, 6);
  });

  it('MT-04 treats a negative count-in as none', () => {
    expect(countInDurationMs(120, -4)).toBe(0);
  });
});

describe('beatsInWindow', () => {
  it('MT-05 returns the beat indices falling in the window', () => {
    // At 120bpm beats land on 0, 500, 1000, 1500...
    expect(beatsInWindow(120, 0, 1600)).toEqual([0, 1, 2, 3]);
    expect(beatsInWindow(120, 500, 1500)).toEqual([1, 2]);
  });

  it('MT-06 uses a half-open window so consecutive scans never double a click', () => {
    // A beat exactly on the boundary belongs to the later window, not both.
    expect(beatsInWindow(120, 0, 500)).toEqual([0]);
    expect(beatsInWindow(120, 500, 1000)).toEqual([1]);

    // Scanning forward in contiguous slices yields each beat exactly once, in order — which is
    // the property the scheduler depends on. The slice width is deliberately not a beat multiple.
    const seen: number[] = [];
    let from = 0;
    while (from < 4000) {
      seen.push(...beatsInWindow(120, from, from + 137));
      from += 137;
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    // The scan runs a little past 4000ms, so it covers beats 0..8.
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('MT-07 runs negative through the count-in (ADR-015)', () => {
    // A four-beat count-in occupies indices -4..-1, with the song starting at 0.
    expect(beatsInWindow(120, -2000, 0)).toEqual([-4, -3, -2, -1]);
    expect(beatsInWindow(120, -2000, 500)).toEqual([-4, -3, -2, -1, 0]);
  });

  it('MT-08 returns nothing for an empty or inverted window', () => {
    expect(beatsInWindow(120, 600, 600)).toEqual([]);
    expect(beatsInWindow(120, 900, 600)).toEqual([]);
  });

  it('MT-09 handles a window shorter than a beat', () => {
    expect(beatsInWindow(120, 100, 200)).toEqual([]);
    expect(beatsInWindow(120, 400, 600)).toEqual([1]);
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
    return { id, chords: [{ symbol: 'C', index: 0 }], lyrics: 'a line', beats: null, bars: null, meter: null };
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
      beats: null,
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

