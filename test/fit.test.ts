import { describe, expect, it } from 'vitest';
import { MIN_SHEET_SCALE, fitScale } from '../src/lib/fit';

describe('fitScale', () => {
  it('FT-01 leaves the type alone when every line already fits', () => {
    // A ratio above 1 is a line with room to spare.
    expect(fitScale([1.4, 2, 1.05], 1)).toBe(1);
  });

  it('FT-02 shrinks to the widest line, not the average', () => {
    // The tightest line sets the size; the roomy ones do not get a vote.
    expect(fitScale([2, 0.7, 1.2], 1)).toBe(0.7);
  });

  it('FT-03 measures against the scale already applied', () => {
    // Laid out at 0.8 and still 10% too wide: 0.8 x 0.9 = 0.72.
    expect(fitScale([0.9], 0.8)).toBe(0.72);
    // Laid out at 0.5 with room to double: back to full size, never past it.
    expect(fitScale([2], 0.5)).toBe(1);
  });

  it('FT-04 never shrinks past legibility, letting the line wrap instead', () => {
    expect(fitScale([0.1], 1)).toBe(MIN_SHEET_SCALE);
  });

  it('FT-05 rounds down, so the widest line never lands back over the edge', () => {
    // 0.8888... would round up to 0.89 and overflow; it steps down to 0.88.
    expect(fitScale([0.8888], 1)).toBe(0.88);
  });

  it('FT-06 ignores measurements taken before there is anything to measure', () => {
    expect(fitScale([], 1)).toBe(1);
    expect(fitScale([0, Number.NaN, Number.POSITIVE_INFINITY], 1)).toBe(1);
    expect(fitScale([0.5], 0)).toBe(1);
  });
});
