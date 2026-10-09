/**
 * Which language a song is in, and filtering the library by it (ADR-081).
 *
 * Read from the song rather than stored on it: songs written before this existed, songs already in
 * an account, and songs nobody thought to label all answer the same way, with nothing to migrate.
 * The reading is by alphabet — Cyrillic letters against Latin ones — which is all it takes to tell
 * the two languages the app is seeded with apart, and which is also its limit: a song in Spanish
 * reads as English, and one in Ukrainian as Russian. A third language that shares an alphabet with
 * one of these would need a stored field.
 */
import type { Song } from '../types/song';
import { UNTITLED_SONG } from './songs';

export type SongLanguage = 'en' | 'ru';

/** What the library shows: every song, or one language's. */
export type LanguageFilter = 'all' | SongLanguage;

/** In the order the switcher offers them. Named in English, as the rest of the UI is. */
export const LANGUAGE_FILTERS: ReadonlyArray<{ value: LanguageFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
];

export const DEFAULT_LANGUAGE_FILTER: LanguageFilter = 'all';

export function isLanguageFilter(value: unknown): value is LanguageFilter {
  return LANGUAGE_FILTERS.some((option) => option.value === value);
}

const CYRILLIC = /\p{Script=Cyrillic}/gu;
const LATIN = /\p{Script=Latin}/gu;

const count = (text: string, letters: RegExp): number => text.match(letters)?.length ?? 0;

/**
 * The language most of a song's letters are written in, title and lyrics together.
 *
 * `null` when it has no letters at all — a song just created, or one of chords alone. Such a song
 * has not said what it is, so it is shown under every filter rather than vanishing from the
 * library the moment it is made. The name a new song is given does not count: it is the app's
 * English, not the writer's.
 */
export function songLanguage(song: Pick<Song, 'title' | 'rows'>): SongLanguage | null {
  const title = song.title === UNTITLED_SONG ? '' : song.title;
  const text = [title, ...song.rows.map((row) => row.lyrics)].join('\n');
  const cyrillic = count(text, CYRILLIC);
  const latin = count(text, LATIN);
  if (cyrillic === 0 && latin === 0) return null;
  return cyrillic > latin ? 'ru' : 'en';
}

/** The languages a library holds songs in, in the switcher's order. */
export function languagesIn(songs: ReadonlyArray<Pick<Song, 'title' | 'rows'>>): SongLanguage[] {
  const found = new Set(songs.map(songLanguage));
  return LANGUAGE_FILTERS.flatMap(({ value }) =>
    value !== 'all' && found.has(value) ? [value] : []
  );
}

/** Whether a library is worth a switcher: only when there is more than one language to choose. */
export function offersLanguageChoice(songs: ReadonlyArray<Pick<Song, 'title' | 'rows'>>): boolean {
  return languagesIn(songs).length > 1;
}

/**
 * The filter actually in force.
 *
 * A remembered choice applies only while the switcher is on screen. Without that, deleting the
 * last English song with "English" chosen would leave a library that looks empty and offers no way
 * to say otherwise.
 */
export function effectiveLanguageFilter(
  chosen: LanguageFilter,
  songs: ReadonlyArray<Pick<Song, 'title' | 'rows'>>
): LanguageFilter {
  return offersLanguageChoice(songs) ? chosen : 'all';
}

/** The songs a filter shows. Songs with no language yet are shown under all of them. */
export function filterByLanguage<T extends Pick<Song, 'title' | 'rows'>>(
  songs: readonly T[],
  filter: LanguageFilter
): T[] {
  if (filter === 'all') return [...songs];
  return songs.filter((song) => {
    const language = songLanguage(song);
    return language === null || language === filter;
  });
}
