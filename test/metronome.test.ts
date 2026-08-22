import { describe, expect, it } from 'vitest';
import {
  beatDurationMs,
  beatsInWindow,
  countInDurationMs,
  isAccent,
} from '../src/lib/metronome';

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
