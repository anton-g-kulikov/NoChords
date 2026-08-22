import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  createSettingsStore,
} from '../src/lib/settings';
import type { StorageLike } from '../src/lib/storage';

function memoryStorage(seed: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('createSettingsStore', () => {
  it('SET-01 returns the defaults when nothing is stored', () => {
    expect(createSettingsStore(memoryStorage()).load()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.metronomeVolume).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.metronomeVolume).toBeLessThanOrEqual(1);
  });

  it('SET-02 round-trips saved settings', () => {
    const backend = memoryStorage();
    createSettingsStore(backend).save({
      metronomeEnabled: true,
      metronomeVolume: 0.25,
      countInBeats: 6,
    });
    expect(createSettingsStore(backend).load()).toEqual({
      metronomeEnabled: true,
      metronomeVolume: 0.25,
      countInBeats: 6,
    });
  });

  it('SET-03 falls back to the defaults on corrupt or non-object JSON', () => {
    expect(createSettingsStore(memoryStorage({ [SETTINGS_KEY]: '{oops' })).load()).toEqual(
      DEFAULT_SETTINGS
    );
    expect(createSettingsStore(memoryStorage({ [SETTINGS_KEY]: '[]' })).load()).toEqual(
      DEFAULT_SETTINGS
    );
    expect(createSettingsStore(memoryStorage({ [SETTINGS_KEY]: 'null' })).load()).toEqual(
      DEFAULT_SETTINGS
    );
  });

  it('SET-04 keeps the valid fields of a partly broken record', () => {
    const stored = JSON.stringify({ metronomeVolume: 0.4, countInBeats: 'lots' });
    const loaded = createSettingsStore(memoryStorage({ [SETTINGS_KEY]: stored })).load();
    expect(loaded.metronomeVolume).toBe(0.4);
    expect(loaded.countInBeats).toBe(DEFAULT_SETTINGS.countInBeats);
    expect(loaded.metronomeEnabled).toBe(DEFAULT_SETTINGS.metronomeEnabled);
  });

  it('SET-05 clamps the volume into 0..1', () => {
    const backend = memoryStorage();
    const store = createSettingsStore(backend);
    store.save({ ...DEFAULT_SETTINGS, metronomeVolume: 9 });
    expect(store.load().metronomeVolume).toBe(1);
    store.save({ ...DEFAULT_SETTINGS, metronomeVolume: -3 });
    expect(store.load().metronomeVolume).toBe(0);
  });

  it('SET-06 clamps the count-in to a sane number of beats', () => {
    const backend = memoryStorage();
    const store = createSettingsStore(backend);
    store.save({ ...DEFAULT_SETTINGS, countInBeats: -4 });
    expect(store.load().countInBeats).toBe(0);
    store.save({ ...DEFAULT_SETTINGS, countInBeats: 999 });
    expect(store.load().countInBeats).toBeLessThanOrEqual(16);
  });

  it('SET-07 survives a storage backend that throws, and no backend at all', () => {
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    expect(createSettingsStore(failing).load()).toEqual(DEFAULT_SETTINGS);
    expect(() => createSettingsStore(failing).save(DEFAULT_SETTINGS)).not.toThrow();

    expect(createSettingsStore(null).load()).toEqual(DEFAULT_SETTINGS);
    expect(() => createSettingsStore(null).save(DEFAULT_SETTINGS)).not.toThrow();
  });
});
