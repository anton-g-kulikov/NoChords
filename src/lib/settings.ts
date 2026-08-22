/**
 * Per-device preferences.
 *
 * Kept apart from songs because how loud a click should be is a property of where you are playing,
 * not of the song (ADR-016). Reuses the same storage port as songs, so it degrades the same way
 * when storage is unavailable.
 */
import { defaultStorage, type StorageLike } from './storage';

export const SETTINGS_KEY = 'nochords.settings.v1';

/** Longest count-in offered, in beats. Beyond a couple of bars it stops being useful. */
export const MAX_COUNT_IN_BEATS = 16;

export interface Settings {
  metronomeEnabled: boolean;
  /** 0..1. */
  metronomeVolume: number;
  /** Beats counted in before the song starts; 0 for none. */
  countInBeats: number;
}

export const DEFAULT_SETTINGS: Settings = {
  metronomeEnabled: false,
  metronomeVolume: 0.5,
  countInBeats: 4,
};

export interface SettingsStore {
  load(): Settings;
  save(settings: Settings): void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Coerces a stored record into valid settings, filling anything missing from the defaults. */
function sanitize(value: unknown): Settings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS };
  }
  const record = value as Record<string, unknown>;

  const volume = record.metronomeVolume;
  const countIn = record.countInBeats;

  return {
    metronomeEnabled:
      typeof record.metronomeEnabled === 'boolean'
        ? record.metronomeEnabled
        : DEFAULT_SETTINGS.metronomeEnabled,
    metronomeVolume:
      typeof volume === 'number' && Number.isFinite(volume)
        ? clamp(volume, 0, 1)
        : DEFAULT_SETTINGS.metronomeVolume,
    countInBeats:
      typeof countIn === 'number' && Number.isFinite(countIn)
        ? clamp(Math.round(countIn), 0, MAX_COUNT_IN_BEATS)
        : DEFAULT_SETTINGS.countInBeats,
  };
}

/** Creates a settings store over the given backend. Every operation is failure-tolerant. */
export function createSettingsStore(
  storage: StorageLike | null = defaultStorage()
): SettingsStore {
  return {
    load(): Settings {
      if (!storage) return { ...DEFAULT_SETTINGS };
      try {
        const raw = storage.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return sanitize(JSON.parse(raw));
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    },

    save(settings: Settings): void {
      if (!storage) return;
      try {
        // Sanitise on the way in too, so a clamped value is what is stored.
        storage.setItem(SETTINGS_KEY, JSON.stringify(sanitize(settings)));
      } catch {
        // Quota exceeded or storage blocked: the session keeps its in-memory settings.
      }
    },
  };
}
