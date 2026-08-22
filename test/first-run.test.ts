import { describe, expect, it } from 'vitest';
import {
  SEEDED_KEY,
  hasSeededExamples,
  markExamplesSeeded,
  shouldSeedExamples,
} from '../src/lib/firstRun';
import type { StorageLike } from '../src/lib/storage';

/** An in-memory stand-in for `localStorage` (see `_meta/architecture-decisions.md` ADR-005). */
function memoryStorage(seed: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/** A store that throws on every access, as `localStorage` does when site data is blocked. */
function blockedStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
}

describe('shouldSeedExamples', () => {
  it('FR-01 seeds an empty library that has never been seeded', () => {
    expect(shouldSeedExamples(false, 0)).toBe(true);
  });

  it('FR-02 never seeds twice', () => {
    // The whole point of the flag: someone who deleted the examples does not get them back.
    expect(shouldSeedExamples(true, 0)).toBe(false);
  });

  it('FR-03 leaves an existing library alone', () => {
    expect(shouldSeedExamples(false, 1)).toBe(false);
    expect(shouldSeedExamples(false, 12)).toBe(false);
  });

  it('FR-04 does nothing for a seeded library with songs in it', () => {
    expect(shouldSeedExamples(true, 3)).toBe(false);
  });
});

describe('the seeded flag', () => {
  it('FR-05 reads as not seeded on a fresh device', () => {
    expect(hasSeededExamples(memoryStorage())).toBe(false);
  });

  it('FR-06 survives being written and read back', () => {
    const storage = memoryStorage();
    markExamplesSeeded(storage);
    expect(hasSeededExamples(storage)).toBe(true);
  });

  it('FR-07 is stored under its own key, away from the library', () => {
    const storage = memoryStorage();
    markExamplesSeeded(storage);
    expect(storage.getItem(SEEDED_KEY)).not.toBeNull();
  });

  it('FR-08 reads as seeded from a library written by an earlier session', () => {
    expect(hasSeededExamples(memoryStorage({ [SEEDED_KEY]: 'true' }))).toBe(true);
  });

  it('FR-09 treats a blocked or absent store as a fresh start rather than failing', () => {
    // Nothing persists in a private window, so every load is a first load — examples included.
    expect(hasSeededExamples(null)).toBe(false);
    expect(hasSeededExamples(blockedStorage())).toBe(false);
    expect(() => markExamplesSeeded(null)).not.toThrow();
    expect(() => markExamplesSeeded(blockedStorage())).not.toThrow();
  });
});
