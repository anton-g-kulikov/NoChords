import { describe, expect, it } from 'vitest';
import { DEFAULT_LIBRARY_SORT, LIBRARY_SORTS, isLibrarySort, sortSongs } from '../src/lib/librarySort';
import { UNTITLED_SONG } from '../src/lib/songs';

/** Just what the order is read from. */
const song = (title: string, openedAt: number | null = null) => ({ title, openedAt });

describe('library order (ADR-106)', () => {
  it('SO-01 offers last opened, the default, and A–Z', () => {
    expect(LIBRARY_SORTS.map((option) => option.value)).toEqual(['opened', 'title']);
    expect(DEFAULT_LIBRARY_SORT).toBe('opened');
    expect(isLibrarySort('title')).toBe(true);
    expect(isLibrarySort('newest')).toBe(false);
  });

  it('SO-02 **puts the last opened song first, and songs never opened after, in library order**', () => {
    const a = song('A', 100);
    const b = song('B', 300);
    const seedOne = song('Seed one');
    const c = song('C', 200);
    const seedTwo = song('Seed two');
    expect(sortSongs([a, b, seedOne, c, seedTwo], 'opened')).toEqual([b, c, a, seedOne, seedTwo]);
  });

  it('SO-03 sorts by title as a reader would: case, accents and numbers', () => {
    const titles = ['song 10', 'Song 2', 'apple', 'Émile', 'Banana'];
    expect(sortSongs(titles.map((title) => song(title)), 'title').map((s) => s.title)).toEqual([
      'apple',
      'Banana',
      'Émile',
      'Song 2',
      'song 10',
    ]);
  });

  it('SO-04 keeps each alphabet in its own order, and an untitled song where its name reads', () => {
    const titles = ['Постой, паровоз', 'House of the Rising Sun', 'Дорогой длинною', '', UNTITLED_SONG];
    const sorted = sortSongs(titles.map((title) => song(title)), 'title').map((s) => s.title);
    // Latin before Cyrillic, each alphabetical; both untitled songs read "Untitled song".
    expect(sorted).toEqual(['House of the Rising Sun', '', UNTITLED_SONG, 'Дорогой длинною', 'Постой, паровоз']);
  });

  it('SO-05 is stable and leaves the library itself alone', () => {
    const library = [song('Same', 5), song('Same', 5), song('Other', 1)];
    const sorted = sortSongs(library, 'title');
    expect(sorted[1]).toBe(library[0]);
    expect(sorted[2]).toBe(library[1]);
    expect(library.map((s) => s.title)).toEqual(['Same', 'Same', 'Other']);
  });
});
