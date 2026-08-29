import { describe, expect, it } from 'vitest';
import { shouldHoldWakeLock, supportsWakeLock } from '../src/lib/wakeLock';

describe('supportsWakeLock', () => {
  it('WL-01 recognises a browser that offers the API', () => {
    expect(supportsWakeLock({ wakeLock: {} })).toBe(true);
  });

  it('WL-02 reports no support rather than throwing on an older browser', () => {
    expect(supportsWakeLock({})).toBe(false);
    expect(supportsWakeLock(undefined)).toBe(false);
    expect(supportsWakeLock(null)).toBe(false);
  });
});

describe('shouldHoldWakeLock', () => {
  it('WL-03 **holds the screen awake while a song plays**', () => {
    // The whole point: a chart you are reading from is a page you never touch.
    expect(shouldHoldWakeLock({ isPlaying: true, visible: true })).toBe(true);
  });

  it('WL-04 lets the screen sleep when nothing is playing', () => {
    // A lock held over a paused song is a flat battery by the interval.
    expect(shouldHoldWakeLock({ isPlaying: false, visible: true })).toBe(false);
  });

  it('WL-05 asks for nothing while the page is hidden', () => {
    // The browser drops the lock anyway; asking for one there is how you end up believing you
    // hold a lock you do not.
    expect(shouldHoldWakeLock({ isPlaying: true, visible: false })).toBe(false);
    expect(shouldHoldWakeLock({ isPlaying: false, visible: false })).toBe(false);
  });
});
