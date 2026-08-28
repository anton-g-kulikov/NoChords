/**
 * Per-device preferences.
 *
 * Kept apart from songs because how loud a click should be is a property of where you are playing,
 * not of the song (ADR-016). Reuses the same storage port as songs, so it degrades the same way
 * when storage is unavailable.
 */
import { defaultStorage, type StorageLike } from './storage';

export const SETTINGS_KEY = 'nochords.settings.v1';

/**
 * Longest count-in offered, in bars.
 *
 * Generous rather than opinionated: counting yourself in for a long intro, or setting up a groove
 * before a slow song, are both real. The ceiling is here to stop a typo becoming a ten-minute
 * wait, not to have a view about how long is sensible.
 */
export const MAX_COUNT_IN_BARS = 24;

/** What a count-in used to be measured in, before it was counted in bars (ADR-027). */
const LEGACY_BEATS_PER_BAR = 4;

export interface Settings {
  metronomeEnabled: boolean;
  /** 0..1. */
  metronomeVolume: number;
  /** Bars counted in before the song starts; 0 for none. A bar is as long as the song's
   * meter says, so the count is in the song's own time (ADR-027). */
  countInBars: number;
}

export const DEFAULT_SETTINGS: Settings = {
  metronomeEnabled: false,
  metronomeVolume: 0.5,
  countInBars: 1,
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
  // Settings written before the count-in was measured in bars hold beats, read four to the bar —
  // the only bar length the app had then. Anything short of half a bar would otherwise round to
  // nothing, which would answer "I want a count-in" with silence; a count-in that was asked for
  // survives as one bar (ADR-027).
  const fromBeats = (beats: number): number =>
    beats > 0 ? Math.max(1, Math.round(beats / LEGACY_BEATS_PER_BAR)) : 0;

  const countIn =
    typeof record.countInBars === 'number'
      ? record.countInBars
      : typeof record.countInBeats === 'number' && Number.isFinite(record.countInBeats)
        ? fromBeats(record.countInBeats)
        : undefined;

  return {
    metronomeEnabled:
      typeof record.metronomeEnabled === 'boolean'
        ? record.metronomeEnabled
        : DEFAULT_SETTINGS.metronomeEnabled,
    metronomeVolume:
      typeof volume === 'number' && Number.isFinite(volume)
        ? clamp(volume, 0, 1)
        : DEFAULT_SETTINGS.metronomeVolume,
    countInBars:
      typeof countIn === 'number' && Number.isFinite(countIn)
        ? clamp(Math.round(countIn), 0, MAX_COUNT_IN_BARS)
        : DEFAULT_SETTINGS.countInBars,
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
