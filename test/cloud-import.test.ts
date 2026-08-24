import { describe, expect, it } from 'vitest';
import {
  UNFINISHED_IMPORT_KEY,
  hasUnfinishedImport,
  markImportUnfinished,
  missingFromAccount,
  shouldOfferImport,
} from '../src/lib/cloudImport';
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
  const boom = () => {
    throw new Error('blocked');
  };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

describe('shouldOfferImport', () => {
  it('CI-01 offers when there are local songs and the cloud is empty', () => {
    expect(shouldOfferImport(3, 0)).toBe(true);
    expect(shouldOfferImport(1, 0)).toBe(true);
  });

  it('CI-02 does not offer when the cloud already has songs', () => {
    // The account is already in use; concatenating a second device's library would duplicate it.
    expect(shouldOfferImport(3, 5)).toBe(false);
    expect(shouldOfferImport(3, 1)).toBe(false);
  });

  it('CI-03 has nothing to offer when there is nothing local', () => {
    expect(shouldOfferImport(0, 0)).toBe(false);
    expect(shouldOfferImport(0, 7)).toBe(false);
  });

  it('CI-04 does not offer when both sides are empty', () => {
    expect(shouldOfferImport(0, 0)).toBe(false);
  });

  it('CI-05 depends only on the counts, never on what the songs are', () => {
    // Deliberately not "is this the example library?" — that would mean matching titles, which
    // breaks the moment one is renamed.
    expect(shouldOfferImport(2, 0)).toBe(shouldOfferImport(2, 0));
    expect(shouldOfferImport(99, 0)).toBe(true);
  });

  it('treats negative or nonsensical counts as nothing to do', () => {
    expect(shouldOfferImport(-1, 0)).toBe(false);
    expect(shouldOfferImport(2, -1)).toBe(true);
  });
});

describe('missingFromAccount', () => {
  it('CI-06 names the songs that did not arrive', () => {
    expect(missingFromAccount(['a', 'b', 'c'], ['a'])).toEqual(['b', 'c']);
  });

  it('CI-07 says nothing is missing once they are all there', () => {
    expect(missingFromAccount(['a', 'b'], ['b', 'a'])).toEqual([]);
    expect(missingFromAccount([], ['a'])).toEqual([]);
  });

  it('CI-08 counts an empty account as missing everything', () => {
    expect(missingFromAccount(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('CI-09 ignores what the account holds beyond the device', () => {
    // Songs written on another device are not this device's business to check.
    expect(missingFromAccount(['a'], ['a', 'x', 'y'])).toEqual([]);
  });

  it('CI-10 compares by id, so a re-run overwrites rather than duplicating', () => {
    // The import writes each song under its own id, which is what makes retrying safe.
    const local = ['song-1', 'song-2'];
    expect(missingFromAccount(local, ['song-1'])).toEqual(['song-2']);
    expect(missingFromAccount(local, ['song-1', 'song-2'])).toEqual([]);
  });
});

describe('the unfinished-import flag', () => {
  it('CI-11 is not set on a device that has never imported', () => {
    expect(hasUnfinishedImport(memoryStorage())).toBe(false);
  });

  it('CI-12 **survives a reload, so a partial import is not stranded**', () => {
    // Without it the offer never returns: it is only made into an empty account, and a partial
    // import leaves the account non-empty.
    const storage = memoryStorage();
    markImportUnfinished(storage, true);
    expect(hasUnfinishedImport(storage)).toBe(true);
    expect(storage.getItem(UNFINISHED_IMPORT_KEY)).not.toBeNull();
  });

  it('CI-13 clears once everything has arrived', () => {
    const storage = memoryStorage({ [UNFINISHED_IMPORT_KEY]: 'true' });
    markImportUnfinished(storage, false);
    expect(hasUnfinishedImport(storage)).toBe(false);
  });

  it('CI-14 treats a blocked or absent store as nothing pending, and never throws', () => {
    expect(hasUnfinishedImport(null)).toBe(false);
    expect(hasUnfinishedImport(blockedStorage())).toBe(false);
    expect(() => markImportUnfinished(null, true)).not.toThrow();
    expect(() => markImportUnfinished(blockedStorage(), true)).not.toThrow();
  });
});

