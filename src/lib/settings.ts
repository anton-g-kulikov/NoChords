/**
 * Per-device preferences.
 *
 * Kept apart from songs because how loud a click should be is a property of where you are playing,
 * not of the song (ADR-016). Reuses the same storage port as songs, so it degrades the same way
 * when storage is unavailable.
 */
import { defaultStorage, type StorageLike } from './storage';
import { DEFAULT_VOICE, isVoiceName, type VoiceName } from './metronomeVoice';
import { DEFAULT_THEME, isThemePreference, type ThemePreference } from './theme';
import { DEFAULT_ACCENT, isAccentName, type AccentName } from './accent';
import { DEFAULT_LANGUAGE_FILTER, isLanguageFilter, type LanguageFilter } from './language';
import { DEFAULT_LIBRARY_SORT, isLibrarySort, type LibrarySort } from './librarySort';

export const SETTINGS_KEY = 'nochords.settings.v1';

/** What a count-in used to be measured in, before it was counted in bars (ADR-027). */
const LEGACY_BEATS_PER_BAR = 4;

/**
 * A count-in is one bar or two, counted in the song's opening meter (ADR-094).
 *
 * It only counts: "1 2 3 4", then the first line. Bars to be played before the singing starts are
 * an intro, and an intro is written into the song as a line of chords.
 */
export type CountInBars = 1 | 2;

export const COUNT_IN_OPTIONS: readonly CountInBars[] = [1, 2];

export const DEFAULT_COUNT_IN_BARS: CountInBars = 1;

export interface Settings {
  metronomeEnabled: boolean;
  /** Which sound the beat makes (ADR-065). */
  metronomeVoice: VoiceName;
  /** 0..1. */
  metronomeVolume: number;
  /**
   * Bars counted in before every song: one or two (ADR-094).
   *
   * A bar is as long as the song's opening meter says, so the count is in the song's own time
   * (ADR-027): "1 2 3 4" in 4/4, "1 2 3 4 5 6" in 6/8.
   */
  countInBars: CountInBars;
  /** Light, dark, or whatever the device says (ADR-067). */
  theme: ThemePreference;
  /** The second ink, chosen by tapping the mark (ADR-072). */
  accent: AccentName;
  /** Which songs the library lists, by the language they are written in (ADR-081). */
  libraryLanguage: LanguageFilter;
  /** The order the library lists songs in: last opened first, or by title (ADR-106). */
  librarySort: LibrarySort;
}

export const DEFAULT_SETTINGS: Settings = {
  // Heard from the first Play: a beat you can only see is a feature to discover (ADR-083).
  metronomeEnabled: true,
  metronomeVoice: DEFAULT_VOICE,
  metronomeVolume: 0.5,
  countInBars: DEFAULT_COUNT_IN_BARS,
  theme: DEFAULT_THEME,
  accent: DEFAULT_ACCENT,
  libraryLanguage: DEFAULT_LANGUAGE_FILTER,
  librarySort: DEFAULT_LIBRARY_SORT,
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
  /*
   * Any count-in stored before it was one bar or two (ADR-094): two bars or more asked for a long
   * count, and keeps the longer of the two; anything else — none, one, Auto — is one bar. Settings
   * older still hold beats, read four to the bar, the only bar length the app had then (ADR-027).
   */
  const storedBars =
    typeof record.countInBars === 'number' && Number.isFinite(record.countInBars)
      ? record.countInBars
      : typeof record.countInBeats === 'number' && Number.isFinite(record.countInBeats)
        ? Math.round(record.countInBeats / LEGACY_BEATS_PER_BAR)
        : null;
  const countInBars: CountInBars =
    storedBars !== null && storedBars >= 2 ? 2 : DEFAULT_COUNT_IN_BARS;

  return {
    theme: isThemePreference(record.theme) ? record.theme : DEFAULT_THEME,
    accent: isAccentName(record.accent) ? record.accent : DEFAULT_ACCENT,
    librarySort: isLibrarySort(record.librarySort) ? record.librarySort : DEFAULT_LIBRARY_SORT,
    libraryLanguage: isLanguageFilter(record.libraryLanguage)
      ? record.libraryLanguage
      : DEFAULT_LANGUAGE_FILTER,
    metronomeVoice: isVoiceName(record.metronomeVoice) ? record.metronomeVoice : DEFAULT_VOICE,
    metronomeEnabled:
      typeof record.metronomeEnabled === 'boolean'
        ? record.metronomeEnabled
        : DEFAULT_SETTINGS.metronomeEnabled,
    metronomeVolume:
      typeof volume === 'number' && Number.isFinite(volume)
        ? clamp(volume, 0, 1)
        : DEFAULT_SETTINGS.metronomeVolume,
    countInBars,
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
