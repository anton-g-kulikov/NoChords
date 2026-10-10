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
  tempoUnit: 'quarter',
  barsPerLine: 6,
  meter: '3/4',
  displayMode: 'nashville',
  openedAt: 1760000000000,
  learningPlaythrough: 3,
  rows: [
    {
      id: 'r1',
      lyrics: 'O, where are you going? To Scarborough Fair?',
      chords: [
        { symbol: 'Dm', index: 0 },
        { symbol: 'C', index: 17 },
      ],
      bars: 4,
      meter: null,
    },
    {
      id: 'r2',
      lyrics: 'Savoury, sage, rosemary and thyme,',
      chords: [{ symbol: 'Dm', index: 0 }],
      bars: null,
      meter: null,
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
      { ...sample, id: 'song-3', rows: [{ id: 'r1', lyrics: 'x', chords: 'a string', bars: null, meter: null }] },
      { ...sample, id: 'song-4', barsPerLine: 'six' },
      { ...sample, id: 'song-5', rows: [{ id: 'r1', lyrics: 'x', chords: [], bars: 'many' }] },
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
    expect(loaded.rows[0].bars).toBe(4);
    expect(loaded.rows[1].bars).toBeNull();
    expect(loaded.barsPerLine).toBe(6);
    expect(loaded.rows[0].chords).toEqual([
      { symbol: 'Dm', index: 0 },
      { symbol: 'C', index: 17 },
    ]);
    expect(loaded.originalKey).toBe('Dm');
    expect(loaded.currentKey).toBe('Em');
  });

  it('ST-09 reads a song stored before tempo units as the unit that keeps its timing', async () => {
    // The old number counted the meter's own denominator, so a 6/8 song counted eighths. Reading
    // it as the conventional dotted quarter would play it three times too fast (ADR-052).
    const { tempoUnit: _dropped, ...withoutUnit } = sample;
    const stored = JSON.stringify([
      { ...withoutUnit, meter: '6/8' },
      { ...withoutUnit, id: 'song-2', meter: '3/4' },
    ]);
    const [compound, simple] = await createSongStore(
      memoryStorage({ [STORAGE_KEY]: stored })
    ).load();

    expect(compound.tempoUnit).toBe('eighth');
    expect(simple.tempoUnit).toBe('quarter');
    // The number itself is untouched: the migration renames what it counts, it does not retune.
    expect(compound.tempo).toBe(sample.tempo);
  });

  it('ST-10 refuses a tempo unit it does not offer', async () => {
    const stored = JSON.stringify([{ ...sample, tempoUnit: 'half' }]);
    const [loaded] = await createSongStore(memoryStorage({ [STORAGE_KEY]: stored })).load();
    expect(loaded.tempoUnit).toBe('quarter');
  });

  it('ST-12 **reads a song saved in the dotted quarter as the same speed in a unit still offered (ADR-086)**', async () => {
    const stored = JSON.stringify([
      { ...sample, meter: '6/8', tempo: 60, tempoUnit: 'dottedQuarter' },
      { ...sample, id: 'song-2', meter: '6/8', tempo: 120, tempoUnit: 'dottedQuarter' },
    ]);
    const [slow, fast] = await createSongStore(memoryStorage({ [STORAGE_KEY]: stored })).load();

    // Not ♪ = 60 or ♩ = 60, which would play it at a third or two thirds of its speed.
    expect([slow.tempo, slow.tempoUnit]).toEqual([180, 'eighth']);
    expect([fast.tempo, fast.tempoUnit]).toEqual([180, 'quarter']);
  });

  it('ST-13 keeps the chord display a song was left in, and opens an older one on names (ADR-095)', async () => {
    const { displayMode: _dropped, ...withoutMode } = sample;
    const stored = JSON.stringify([
      sample,
      { ...sample, id: 'song-2', displayMode: 'learning' },
      { ...withoutMode, id: 'song-3' },
      { ...sample, id: 'song-4', displayMode: 'karaoke' },
    ]);
    const loaded = await createSongStore(memoryStorage({ [STORAGE_KEY]: stored })).load();
    expect(loaded.map((song) => song.displayMode)).toEqual(['nashville', 'learning', 'full', 'full']);
  });

  it('ST-15 **keeps stored line lengths within what the editor allows** (ADR-108)', async () => {
    const row = (id: string, bars: unknown) => ({ id, lyrics: 'la', chords: [], bars, meter: null });
    const stored = JSON.stringify([
      { ...sample, barsPerLine: 1e308, rows: [row('a', 1e9), row('b', 64), row('c', -3)] },
      { ...sample, id: 'song-2', barsPerLine: -3 },
      { ...sample, id: 'song-3', barsPerLine: 2.6 },
    ]);
    const [huge, negative, fraction] = await createSongStore(memoryStorage({ [STORAGE_KEY]: stored })).load();
    // Out of range is not corruption: the song loads, at lengths the editor could have set.
    expect(huge.barsPerLine).toBe(64);
    expect(huge.rows.map((r) => r.bars)).toEqual([null, 64, null]);
    expect(negative.barsPerLine).toBe(1);
    expect(fraction.barsPerLine).toBe(3);
  });

  it('ST-14 keeps when a song was last opened, and reads an older song as never opened (ADR-106)', async () => {
    const { openedAt: _dropped, ...withoutOpened } = sample;
    const stored = JSON.stringify([
      sample,
      { ...withoutOpened, id: 'song-2' },
      { ...sample, id: 'song-3', openedAt: 'yesterday' },
    ]);
    const loaded = await createSongStore(memoryStorage({ [STORAGE_KEY]: stored })).load();
    expect(loaded.map((song) => song.openedAt)).toEqual([1760000000000, null, null]);
  });

  it('ST-11 loads a song saved with its own count-in, and leaves the count-in behind (ADR-094)', async () => {
    // Songs saved while a song could carry a count-in still load, whole; the count-in is now the
    // device's one bar or two, and an intro is written into the song.
    const stored = JSON.stringify([{ ...sample, countInBars: 4 }, { ...sample, id: 'song-2', countInBars: null }]);
    const loaded = await createSongStore(memoryStorage({ [STORAGE_KEY]: stored })).load();
    expect(loaded.map((song) => song.id)).toEqual([sample.id, 'song-2']);
    expect(loaded.every((song) => !('countInBars' in song))).toBe(true);
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
