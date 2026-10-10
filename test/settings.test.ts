import { describe, expect, it } from 'vitest';
import {
  COUNT_IN_OPTIONS,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  createSettingsStore,
  type CountInBars,
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

describe('device preferences', () => {
  it('SET-13 keeps the chosen sound, and refuses one it cannot make', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .metronomeVoice;

    expect(DEFAULT_SETTINGS.metronomeVoice).toBe('shaker');
    expect(load({ metronomeVoice: 'woodblock' })).toBe('woodblock');
    // Preferences written before there was a choice, and anything that is not a voice.
    expect(load({})).toBe('shaker');
    expect(load({ metronomeVoice: 'cowbell' })).toBe('shaker');
  });

  it('SET-14 keeps the chosen scheme, and follows the device otherwise (ADR-067)', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load().theme;

    expect(DEFAULT_SETTINGS.theme).toBe('system');
    expect(load({ theme: 'light' })).toBe('light');
    expect(load({ theme: 'dark' })).toBe('dark');
    // Preferences written before there was a choice, and anything that is not a scheme.
    expect(load({})).toBe('system');
    expect(load({ theme: 'sepia' })).toBe('system');
    expect(load({ theme: true })).toBe('system');
  });

  it('SET-15 keeps the chosen ink, and falls back to vermilion otherwise (ADR-072)', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load().accent;

    expect(DEFAULT_SETTINGS.accent).toBe('vermilion');
    expect(load({ accent: 'plum' })).toBe('plum');
    expect(load({})).toBe('vermilion');
    expect(load({ accent: 'chartreuse' })).toBe('vermilion');
  });

  it('SET-16 keeps the chosen song language; anything else, or nothing, shows every song (ADR-081)', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .libraryLanguage;

    expect(DEFAULT_SETTINGS.libraryLanguage).toBe('all');
    expect(load({ libraryLanguage: 'ru' })).toBe('ru');
    expect(load({ libraryLanguage: 'en' })).toBe('en');
    expect(load({})).toBe('all');
    expect(load({ libraryLanguage: 'de' })).toBe('all');
  });

  it('SET-18 keeps the chosen library order; anything else, or nothing, is last opened first (ADR-106)', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .librarySort;

    expect(DEFAULT_SETTINGS.librarySort).toBe('opened');
    expect(load({ librarySort: 'title' })).toBe('title');
    expect(load({})).toBe('opened');
    expect(load({ librarySort: 'random' })).toBe('opened');
  });

  it('SET-10 counts every song in by one bar, or two if chosen (ADR-094)', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .countInBars;

    expect(COUNT_IN_OPTIONS).toEqual([1, 2]);
    expect(DEFAULT_SETTINGS.countInBars).toBe(1);
    expect(load({})).toBe(1);
    expect(load({ countInBars: 1 })).toBe(1);
    expect(load({ countInBars: 2 })).toBe(2);
  });

  it('SET-11 **reads a count-in from before it was one bar or two as the nearer of the two**', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .countInBars;

    // Auto, none, and one bar all become the one-bar count every song now starts with.
    expect(load({ countInBars: null })).toBe(1);
    expect(load({ countInBars: 0 })).toBe(1);
    // A long count asked for a long count, and keeps the longer of the two.
    expect(load({ countInBars: 3 })).toBe(2);
    expect(load({ countInBars: 24 })).toBe(2);
    // Nonsense is the default.
    expect(load({ countInBars: -4 })).toBe(1);
    expect(load({ countInBars: 'lots' })).toBe(1);
  });
});

describe('createSettingsStore', () => {
  it('SET-01 returns the defaults when nothing is stored', () => {
    expect(createSettingsStore(memoryStorage()).load()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.metronomeVolume).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.metronomeVolume).toBeLessThanOrEqual(1);
  });

  it('SET-18 the beat is heard by default, and a device that turned it off keeps it off', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .metronomeEnabled;

    expect(DEFAULT_SETTINGS.metronomeEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.metronomeVoice).toBe('shaker');
    expect(load({})).toBe(true);
    expect(load({ metronomeEnabled: false })).toBe(false);
  });

  it('SET-02 round-trips saved settings', () => {
    const backend = memoryStorage();
    createSettingsStore(backend).save({
      metronomeEnabled: true,
      metronomeVoice: 'woodblock',
      metronomeVolume: 0.25,
      countInBars: 2,
      theme: 'dark',
      accent: 'teal',
      libraryLanguage: 'ru',
      librarySort: 'title',
    });
    expect(createSettingsStore(backend).load()).toEqual({
      metronomeEnabled: true,
      metronomeVoice: 'woodblock',
      metronomeVolume: 0.25,
      countInBars: 2,
      theme: 'dark',
      accent: 'teal',
      libraryLanguage: 'ru',
      librarySort: 'title',
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

  it('SET-06 never stores a count-in other than one bar or two', () => {
    const backend = memoryStorage();
    const store = createSettingsStore(backend);
    store.save({ ...DEFAULT_SETTINGS, countInBars: -4 as CountInBars });
    expect(store.load().countInBars).toBe(1);
    store.save({ ...DEFAULT_SETTINGS, countInBars: 999 as CountInBars });
    expect(store.load().countInBars).toBe(2);
  });

  it('SET-08 converts a count-in written in beats, four to the bar (ADR-027)', () => {
    // Preferences saved before the count-in was counted in bars hold beats, read four to the bar —
    // the only bar length the app had at the time — then settle on one bar or two (ADR-094).
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .countInBars;

    expect(load({ countInBeats: 8 })).toBe(2);
    expect(load({ countInBeats: 6 })).toBe(2);
    expect(load({ countInBeats: 4 })).toBe(1);
  });

  it('SET-09 never turns a count-in into none at all', () => {
    const load = (stored: object) =>
      createSettingsStore(memoryStorage({ [SETTINGS_KEY]: JSON.stringify(stored) })).load()
        .countInBars;

    // Every song is counted in now; what used to mean none, or too little to round to a bar, is one.
    expect(load({ countInBeats: 0 })).toBe(1);
    expect(load({ countInBeats: 1 })).toBe(1);
    expect(load({ countInBeats: -4 })).toBe(1);
    expect(load({ countInBeats: 'lots' })).toBe(1);
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
