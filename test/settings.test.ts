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

  it('SET-08 converts a count-in written in beats to the nearest whole bar', () => {
    // Preferences saved before the count-in was counted in bars (ADR-027) hold beats, and are
    // read four to the bar — which was the only bar length the app had at the time.
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .countInBars;

    expect(load({ countInBeats: 4 })).toBe(1);
    expect(load({ countInBeats: 8 })).toBe(2);
    // Not a whole number of bars: it rounds, so the count-in changes length slightly. Preserving
    // the intent — that there is one, and roughly how long — matters more than the exact beats,
    // which no longer describe a fixed duration now that a bar is as long as the meter says.
    expect(load({ countInBeats: 6 })).toBe(2);
    expect(load({ countInBeats: 5 })).toBe(1);
    expect(load({ countInBeats: 0 })).toBe(0);
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
