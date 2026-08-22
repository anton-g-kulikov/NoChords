import { describe, expect, it } from 'vitest';
import {
  DOUBLE_TAP_MS,
  REVEAL_MS,
  isDoubleTap,
  isRevealed,
  nextExpiry,
  pruneReveals,
  revealRow,
  type Reveals,
} from '../src/lib/reveal';

const NO_REVEALS: Reveals = {};

describe('revealRow / isRevealed', () => {
  it('RV-01 marks a line revealed from the moment it is tapped', () => {
    const reveals = revealRow(NO_REVEALS, 'r1', 1000);
    expect(isRevealed(reveals, 'r1', 1000)).toBe(true);
    expect(isRevealed(reveals, 'r1', 1000 + REVEAL_MS - 1)).toBe(true);
  });

  it('RV-02 lets go of the line once its window passes', () => {
    const reveals = revealRow(NO_REVEALS, 'r1', 1000);
    expect(isRevealed(reveals, 'r1', 1000 + REVEAL_MS + 1)).toBe(false);
    expect(isRevealed(reveals, 'r1', 999999)).toBe(false);
  });

  it('RV-03 treats the expiry instant itself as over', () => {
    const reveals = revealRow(NO_REVEALS, 'r1', 1000);
    expect(isRevealed(reveals, 'r1', 1000 + REVEAL_MS - 1)).toBe(true);
    expect(isRevealed(reveals, 'r1', 1000 + REVEAL_MS)).toBe(false);
  });

  it('RV-04 does not reveal a line that was never tapped', () => {
    const reveals = revealRow(NO_REVEALS, 'r1', 1000);
    expect(isRevealed(reveals, 'r2', 1000)).toBe(false);
    expect(isRevealed(NO_REVEALS, 'r1', 1000)).toBe(false);
  });

  it('RV-05 keeps several lines revealed, each on its own clock', () => {
    let reveals = revealRow(NO_REVEALS, 'r1', 1000);
    reveals = revealRow(reveals, 'r2', 3000);

    // At 4000 the first has expired (1000 + 4000 window) but the second is still live.
    expect(isRevealed(reveals, 'r1', 1000 + REVEAL_MS)).toBe(false);
    expect(isRevealed(reveals, 'r2', 1000 + REVEAL_MS)).toBe(true);
  });

  it('RV-06 extends a live reveal rather than toggling it off', () => {
    let reveals = revealRow(NO_REVEALS, 'r1', 1000);
    reveals = revealRow(reveals, 'r1', 3000);
    // Tapping again must not hide it, and must push the expiry out from the second tap.
    expect(isRevealed(reveals, 'r1', 3000)).toBe(true);
    expect(isRevealed(reveals, 'r1', 3000 + REVEAL_MS - 1)).toBe(true);
    expect(isRevealed(reveals, 'r1', 3000 + REVEAL_MS)).toBe(false);
  });

  it('RV-07 accepts a custom duration', () => {
    const reveals = revealRow(NO_REVEALS, 'r1', 1000, 500);
    expect(isRevealed(reveals, 'r1', 1400)).toBe(true);
    expect(isRevealed(reveals, 'r1', 1500)).toBe(false);
  });

  it('RV-16 never mutates the reveals it is given', () => {
    const original = revealRow(NO_REVEALS, 'r1', 1000);
    const snapshot = { ...original };
    revealRow(original, 'r2', 2000);
    pruneReveals(original, 999999);
    expect(original).toEqual(snapshot);
  });
});

describe('pruneReveals', () => {
  it('RV-08 drops what has expired and keeps what has not', () => {
    let reveals = revealRow(NO_REVEALS, 'r1', 1000);
    reveals = revealRow(reveals, 'r2', 5000);

    const pruned = pruneReveals(reveals, 5500);
    expect(isRevealed(pruned, 'r1', 5500)).toBe(false);
    expect(isRevealed(pruned, 'r2', 5500)).toBe(true);
    expect(Object.keys(pruned)).toEqual(['r2']);
  });

  it('RV-09 returns the very same object when nothing expired', () => {
    const reveals = revealRow(NO_REVEALS, 'r1', 1000);
    // Identity matters: the component stores this in state, and a fresh object every tick
    // would re-render the whole chart for nothing.
    expect(pruneReveals(reveals, 1500)).toBe(reveals);
    expect(pruneReveals(NO_REVEALS, 1500)).toBe(NO_REVEALS);
  });
});

describe('nextExpiry', () => {
  it('RV-10 reports the soonest expiry, for scheduling the tidy-up', () => {
    let reveals = revealRow(NO_REVEALS, 'r1', 1000);
    reveals = revealRow(reveals, 'r2', 5000);
    expect(nextExpiry(reveals)).toBe(1000 + REVEAL_MS);
  });

  it('RV-11 is null when nothing is revealed', () => {
    expect(nextExpiry(NO_REVEALS)).toBeNull();
  });
});

describe('isDoubleTap', () => {
  it('RV-12 counts a quick second tap on the same line', () => {
    expect(isDoubleTap({ rowId: 'r1', atMs: 1000 }, 'r1', 1000 + DOUBLE_TAP_MS - 1)).toBe(true);
    expect(isDoubleTap({ rowId: 'r1', atMs: 1000 }, 'r1', 1050)).toBe(true);
  });

  it('RV-13 does not count a slow second tap', () => {
    expect(isDoubleTap({ rowId: 'r1', atMs: 1000 }, 'r1', 1000 + DOUBLE_TAP_MS)).toBe(false);
    expect(isDoubleTap({ rowId: 'r1', atMs: 1000 }, 'r1', 9000)).toBe(false);
  });

  it('RV-14 never counts taps on different lines, however quick', () => {
    expect(isDoubleTap({ rowId: 'r1', atMs: 1000 }, 'r2', 1001)).toBe(false);
  });

  it('RV-15 never counts the very first tap', () => {
    expect(isDoubleTap(null, 'r1', 1000)).toBe(false);
  });
});
