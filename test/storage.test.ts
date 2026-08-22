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
  beatsPerLine: 6,
  learningPlaythrough: 3,
  rows: [
    {
      id: 'r1',
      lyrics: 'O, where are you going? To Scarborough Fair?',
      chords: [
        { symbol: 'Dm', index: 0 },
        { symbol: 'C', index: 17 },
      ],
      beats: 12,
    },
    {
      id: 'r2',
      lyrics: 'Savoury, sage, rosemary and thyme,',
      chords: [{ symbol: 'Dm', index: 0 }],
      beats: null,
    },
  ],
};

/** The port is per-song now (ADR-020); most cases still want a whole library in place. */
async function saveAll(store: ReturnType<typeof createSongStore>, songs: Song[]) {
  for (const song of songs) await store.saveSong(song);
}

describe('createSongStore', () => {
  it('ST-01 returns saved songs on a later load', async () => {
    const store = createSongStore(memoryStorage());
    saveAll(store, [sample]);
    expect((await store.load())).toEqual([sample]);
  });

  it('persists through a fresh store over the same backend', async () => {
    const backend = memoryStorage();
    saveAll(createSongStore(backend), [sample]);
    // A page reload builds a new store over the same storage.
    expect((await createSongStore(backend).load())).toEqual([sample]);
  });

  it('ST-02 returns an empty list when nothing has been stored', async () => {
    expect((await createSongStore(memoryStorage()).load())).toEqual([]);
  });

  it('ST-03 returns an empty list when the stored JSON is corrupt', async () => {
    const store = createSongStore(memoryStorage({ [STORAGE_KEY]: '{not json' }));
    expect((await store.load())).toEqual([]);
  });

  it('ST-04 rejects a stored payload that is not an array', async () => {
    expect(await createSongStore(memoryStorage({ [STORAGE_KEY]: '{"a":1}' })).load()).toEqual([]);
    expect((await createSongStore(memoryStorage({ [STORAGE_KEY]: '"hello"' })).load())).toEqual([]);
    expect((await createSongStore(memoryStorage({ [STORAGE_KEY]: 'null' })).load())).toEqual([]);
  });

  it('ST-05 drops malformed entries but keeps valid siblings', async () => {
    const payload = JSON.stringify([
      sample,
      { id: 'no-rows', title: 'broken' },
      null,
      'nonsense',
      { ...sample, id: 'song-2', rows: 'not an array' },
      { ...sample, id: 'song-3', rows: [{ id: 'r1', lyrics: 'x', chords: 'a string', beats: null }] },
      { ...sample, id: 'song-4', beatsPerLine: 'six' },
      { ...sample, id: 'song-5', rows: [{ id: 'r1', lyrics: 'x', chords: [], beats: 'many' }] },
    ]);
    const loaded = (await createSongStore(memoryStorage({ [STORAGE_KEY]: payload })).load());
    expect(loaded).toEqual([sample]);
  });

  it('ST-06 round-trips learning progress with the song', async () => {
    const store = createSongStore(memoryStorage());
    saveAll(store, [{ ...sample, learningPlaythrough: 4 }]);
    expect((await store.load())[0].learningPlaythrough).toBe(4);
  });

  it('ST-07 round-trips every row field exactly', async () => {
    const store = createSongStore(memoryStorage());
    saveAll(store, [sample]);
    const [loaded] = (await store.load());
    expect(loaded.rows).toEqual(sample.rows);
    expect(loaded.rows[0].beats).toBe(12);
    expect(loaded.rows[1].beats).toBeNull();
    expect(loaded.beatsPerLine).toBe(6);
    expect(loaded.rows[0].chords).toEqual([
      { symbol: 'Dm', index: 0 },
      { symbol: 'C', index: 17 },
    ]);
    expect(loaded.originalKey).toBe('Dm');
    expect(loaded.currentKey).toBe('Em');
  });

  it('ST-08 survives a storage backend that refuses to write', async () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const store = createSongStore(failing);
    await expect(saveAll(store, [sample])).resolves.not.toThrow();
  });

  it('survives a storage backend that refuses to read', async () => {
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect((await createSongStore(failing).load())).toEqual([]);
  });

  it('works with no storage backend at all', async () => {
    const store = createSongStore(null);
    expect((await store.load())).toEqual([]);
    await expect(saveAll(store, [sample])).resolves.not.toThrow();
  });

  it('normalises songs produced by the app itself', async () => {
    const store = createSongStore(memoryStorage());
    const song = createSong({ title: 'Fresh' });
    saveAll(store, [song]);
    expect((await store.load())).toEqual([song]);
  });
});
