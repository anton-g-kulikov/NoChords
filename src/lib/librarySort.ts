/**
 * The order the library lists songs in (ADR-106): the last opened first, or by title.
 *
 * "Last opened" is the default because the song you came back for is usually the one you played
 * last. A–Z is for a library long enough that you look a song up rather than recognise it. Both are
 * stable: songs that tie keep the library's own order.
 */
import type { Song } from '../types/song';
import { UNTITLED_SONG } from './songs';

export type LibrarySort = 'opened' | 'title';

/** In the order the switch offers them. */
export const LIBRARY_SORTS: ReadonlyArray<{ value: LibrarySort; label: string; hint: string }> = [
  { value: 'opened', label: 'Recent', hint: 'Last opened first' },
  { value: 'title', label: 'A–Z', hint: 'By title' },
];

export const DEFAULT_LIBRARY_SORT: LibrarySort = 'opened';

export function isLibrarySort(value: unknown): value is LibrarySort {
  return LIBRARY_SORTS.some((option) => option.value === value);
}

/**
 * Titles compared as a reader expects: case and accents set aside, numbers by value ("Song 2"
 * before "Song 10"), and Cyrillic and Latin each in their own alphabet's order.
 */
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** The title as the list shows it, so an untitled song sorts where it reads. */
const shownTitle = (song: Pick<Song, 'title'>): string => song.title.trim() || UNTITLED_SONG;

/**
 * The songs in the chosen order, as a new array.
 *
 * Last opened puts the most recent first; songs never opened — the seeded ones, before you touch
 * them — follow, in the library's order.
 */
export function sortSongs<T extends Pick<Song, 'title' | 'openedAt'>>(
  songs: readonly T[],
  sort: LibrarySort
): T[] {
  const indexed = songs.map((song, index) => ({ song, index }));
  indexed.sort((a, b) => {
    if (sort === 'title') {
      return collator.compare(shownTitle(a.song), shownTitle(b.song)) || a.index - b.index;
    }
    const at = a.song.openedAt;
    const bt = b.song.openedAt;
    if (at !== null && bt !== null && at !== bt) return bt - at;
    if (at !== null && bt === null) return -1;
    if (at === null && bt !== null) return 1;
    return a.index - b.index;
  });
  return indexed.map(({ song }) => song);
}
