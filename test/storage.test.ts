import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, createSongStore, type StorageLike } from '../src/lib/storage';
import { createSong } from '../src/lib/songs';
import type { Song } from '../src/types/song';

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

const sample: Song = {
  id: 'song-1',
  title: 'Scarborough Fair',
  originalKey: 'Dm',
  currentKey: 'Em',
  tempo: 96,
  learningPlaythrough: 3,
  rows: [
    {
      id: 'r1',
      lyrics: 'O, where are you going? To Scarborough Fair?',
      chords: [
        { symbol: 'Dm', index: 0 },
        { symbol: 'C', index: 17 },
      ],
      beats: 6,
      pauseSeconds: 0.5,
    },
    {
      id: 'r2',
      lyrics: 'Savoury, sage, rosemary and thyme,',
      chords: [{ symbol: 'Dm', index: 0 }],
      beats: 6,
      pauseSeconds: 0,
    },
  ],
};

describe('createSongStore', () => {
  it('ST-01 returns saved songs on a later load', () => {
    const store = createSongStore(memoryStorage());
    store.save([sample]);
    expect(store.load()).toEqual([sample]);
  });

  it('persists through a fresh store over the same backend', () => {
    const backend = memoryStorage();
    createSongStore(backend).save([sample]);
    // A page reload builds a new store over the same storage.
    expect(createSongStore(backend).load()).toEqual([sample]);
  });

  it('ST-02 returns an empty list when nothing has been stored', () => {
    expect(createSongStore(memoryStorage()).load()).toEqual([]);
  });

  it('ST-03 returns an empty list when the stored JSON is corrupt', () => {
    const store = createSongStore(memoryStorage({ [STORAGE_KEY]: '{not json' }));
    expect(store.load()).toEqual([]);
  });

  it('ST-04 rejects a stored payload that is not an array', () => {
    expect(createSongStore(memoryStorage({ [STORAGE_KEY]: '{"a":1}' })).load()).toEqual([]);
    expect(createSongStore(memoryStorage({ [STORAGE_KEY]: '"hello"' })).load()).toEqual([]);
    expect(createSongStore(memoryStorage({ [STORAGE_KEY]: 'null' })).load()).toEqual([]);
  });

  it('ST-05 drops malformed entries but keeps valid siblings', () => {
    const payload = JSON.stringify([
      sample,
      { id: 'no-rows', title: 'broken' },
      null,
      'nonsense',
      { ...sample, id: 'song-2', rows: 'not an array' },
      { ...sample, id: 'song-3', rows: [{ id: 'r1', lyrics: 'x', chords: 'a string', beats: 4, pauseSeconds: 0 }] },
    ]);
    const loaded = createSongStore(memoryStorage({ [STORAGE_KEY]: payload })).load();
    expect(loaded).toEqual([sample]);
  });

  it('ST-06 round-trips learning progress with the song', () => {
    const store = createSongStore(memoryStorage());
    store.save([{ ...sample, learningPlaythrough: 4 }]);
    expect(store.load()[0].learningPlaythrough).toBe(4);
  });

  it('ST-07 round-trips every row field exactly', () => {
    const store = createSongStore(memoryStorage());
    store.save([sample]);
    const [loaded] = store.load();
    expect(loaded.rows).toEqual(sample.rows);
    expect(loaded.rows[0].pauseSeconds).toBe(0.5);
    expect(loaded.rows[0].beats).toBe(6);
    expect(loaded.rows[0].chords).toEqual([
      { symbol: 'Dm', index: 0 },
      { symbol: 'C', index: 17 },
    ]);
    expect(loaded.originalKey).toBe('Dm');
    expect(loaded.currentKey).toBe('Em');
  });

  it('ST-08 survives a storage backend that refuses to write', () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const store = createSongStore(failing);
    expect(() => store.save([sample])).not.toThrow();
  });

  it('survives a storage backend that refuses to read', () => {
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(createSongStore(failing).load()).toEqual([]);
  });

  it('works with no storage backend at all', () => {
    const store = createSongStore(null);
    expect(store.load()).toEqual([]);
    expect(() => store.save([sample])).not.toThrow();
  });

  it('normalises songs produced by the app itself', () => {
    const store = createSongStore(memoryStorage());
    const song = createSong({ title: 'Fresh' });
    store.save([song]);
    expect(store.load()).toEqual([song]);
  });
});
