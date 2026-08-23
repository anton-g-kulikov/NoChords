import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MAX_COUNT_IN_BARS,
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
      countInBars: 2,
    });
    expect(createSettingsStore(backend).load()).toEqual({
      metronomeEnabled: true,
      metronomeVolume: 0.25,
      countInBars: 2,
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
    const stored = JSON.stringify({ metronomeVolume: 0.4, countInBars: 'lots' });
    const loaded = createSettingsStore(memoryStorage({ [SETTINGS_KEY]: stored })).load();
    expect(loaded.metronomeVolume).toBe(0.4);
    expect(loaded.countInBars).toBe(DEFAULT_SETTINGS.countInBars);
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

  it('SET-06 clamps the count-in to a sane number of bars', () => {
    const backend = memoryStorage();
    const store = createSettingsStore(backend);
    store.save({ ...DEFAULT_SETTINGS, countInBars: -4 });
    expect(store.load().countInBars).toBe(0);
    store.save({ ...DEFAULT_SETTINGS, countInBars: 999 });
    expect(store.load().countInBars).toBeLessThanOrEqual(MAX_COUNT_IN_BARS);
  });

  it('SET-08 reads a count-in written in beats as the same length in bars', () => {
    // Preferences saved before the count-in was counted in bars (ADR-027): four beats was the
    // default, and one bar is what it meant.
    const stored = JSON.stringify({ countInBeats: 4 });
    expect(createSettingsStore(memoryStorage({ [SETTINGS_KEY]: stored })).load().countInBars).toBe(
      1
    );
    const two = JSON.stringify({ countInBeats: 8 });
    expect(createSettingsStore(memoryStorage({ [SETTINGS_KEY]: two })).load().countInBars).toBe(2);
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
