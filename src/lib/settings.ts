/**
 * Per-device preferences.
 *
 * Kept apart from songs because how loud a click should be is a property of where you are playing,
 * not of the song (ADR-016). Reuses the same storage port as songs, so it degrades the same way
 * when storage is unavailable.
 */
import { defaultStorage, type StorageLike } from './storage';
import { DEFAULT_VOICE, isVoiceName, type VoiceName } from './metronomeVoice';

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

/** The count-in everybody had before it followed the song's line length (ADR-059). */
const LEGACY_DEFAULT_BARS = 1;

export interface Settings {
  metronomeEnabled: boolean;
  /** Which sound the beat makes (ADR-065). */
  metronomeVoice: VoiceName;
  /** 0..1. */
  metronomeVolume: number;
  /**
   * Bars counted in before the song starts; 0 for none, `null` to follow the song.
   *
   * A bar is as long as the song's meter says, so the count is in the song's own time (ADR-027).
   * Following the song means one line's worth of bars, which is the length you are about to play
   * and so the length that tells you most (ADR-059).
   */
  countInBars: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  metronomeEnabled: false,
  metronomeVoice: DEFAULT_VOICE,
  metronomeVolume: 0.5,
  countInBars: null,
};

/** Bars to count in for a song, resolving "follow the song" against its line length. */
export function countInBarsFor(countInBars: number | null, barsPerLine: number): number {
  if (countInBars !== null) return countInBars;
  return clamp(Math.round(barsPerLine), 1, MAX_COUNT_IN_BARS);
}

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

  /*
   * A stored bar count that is the old default of one is read as "follow the song".
   *
   * There is no telling a deliberate 1 from the 1 everybody was given, and the count-in now
   * follows the line length unless told otherwise (ADR-059). Any other number was typed on
   * purpose and is left alone.
   */
  const stored =
    typeof record.countInBars === 'number'
      ? record.countInBars
      : typeof record.countInBeats === 'number' && Number.isFinite(record.countInBeats)
        ? fromBeats(record.countInBeats)
        : undefined;
  const countIn = stored === LEGACY_DEFAULT_BARS ? null : stored;

  return {
    metronomeVoice: isVoiceName(record.metronomeVoice) ? record.metronomeVoice : DEFAULT_VOICE,
    metronomeEnabled:
      typeof record.metronomeEnabled === 'boolean'
        ? record.metronomeEnabled
        : DEFAULT_SETTINGS.metronomeEnabled,
    metronomeVolume:
      typeof volume === 'number' && Number.isFinite(volume)
        ? clamp(volume, 0, 1)
        : DEFAULT_SETTINGS.metronomeVolume,
    countInBars:
      countIn === null
        ? null
        : typeof countIn === 'number' && Number.isFinite(countIn)
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
