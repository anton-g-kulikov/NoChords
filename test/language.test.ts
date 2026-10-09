import { describe, expect, it } from 'vitest';
import {
  effectiveLanguageFilter,
  filterByLanguage,
  languagesIn,
  offersLanguageChoice,
  songLanguage,
} from '../src/lib/language';
import { UNTITLED_SONG } from '../src/lib/songs';
import { createExampleSongs } from '../src/lib/examples';
import type { Song } from '../src/types/song';

/** Just what the language is read from: a title and the lines' words. */
function song(title: string, ...lines: string[]): Pick<Song, 'title' | 'rows'> {
  return {
    title,
    rows: lines.map((lyrics, index) => ({
      id: `r${index}`,
      lyrics,
      chords: [],
      bars: null,
      meter: null,
    })),
  };
}

const RISING_SUN = song('House of the Rising Sun', 'There is a house in New Orleans');
const VORON = song('Чёрный ворон', 'Чёрный ворон, что ты вьёшься');
const UNTITLED = song('', '', '');

describe('song language (ADR-081)', () => {
  it('LG-01 reads a song in Cyrillic as Russian and one in Latin letters as English', () => {
    expect(songLanguage(RISING_SUN)).toBe('en');
    expect(songLanguage(VORON)).toBe('ru');
  });

  it('LG-02 goes by most of the letters, so a translated title does not move a song', () => {
    expect(songLanguage(song('Black Raven', 'Чёрный ворон, что ты вьёшься над моею головой'))).toBe(
      'ru'
    );
    expect(songLanguage(song('Дом восходящего солнца', 'There is a house in New Orleans they call the Rising Sun'))).toBe(
      'en'
    );
  });

  it('LG-03 **a song with no words yet has no language, and every filter shows it**', () => {
    // A song is created empty and opened in the editor; coming back to a library filtered to the
    // other language must not make it look as if it was never made.
    expect(songLanguage(UNTITLED)).toBeNull();
    expect(songLanguage(song('', '', '1 2 3 4'))).toBeNull();
    // The name the app gives a new song is its own English, not the writer's.
    expect(songLanguage(song(UNTITLED_SONG))).toBeNull();
    expect(songLanguage(song(UNTITLED_SONG, 'Чёрный ворон'))).toBe('ru');
    expect(filterByLanguage([UNTITLED], 'ru')).toEqual([UNTITLED]);
    expect(filterByLanguage([UNTITLED], 'en')).toEqual([UNTITLED]);
  });

  it('LG-04 filters the list to one language, keeping its order; "All" keeps everything', () => {
    const library = [VORON, RISING_SUN, UNTITLED];
    expect(filterByLanguage(library, 'all')).toEqual(library);
    expect(filterByLanguage(library, 'ru')).toEqual([VORON, UNTITLED]);
    expect(filterByLanguage(library, 'en')).toEqual([RISING_SUN, UNTITLED]);
  });

  it('LG-05 offers a choice only when the library holds more than one language', () => {
    expect(languagesIn([VORON, RISING_SUN])).toEqual(['en', 'ru']);
    expect(offersLanguageChoice([VORON, RISING_SUN])).toBe(true);
    expect(offersLanguageChoice([RISING_SUN, song('Scarborough Fair', 'Are you going')])).toBe(false);
    // A song with no words is not a language of its own.
    expect(offersLanguageChoice([RISING_SUN, UNTITLED])).toBe(false);
    expect(offersLanguageChoice([])).toBe(false);
  });

  it('LG-06 **a remembered choice cannot empty a library that no longer offers it**', () => {
    // Chose Russian, then deleted the last Russian song: the switcher goes, and so must the filter,
    // or the library would look empty with nothing on screen to explain why.
    expect(effectiveLanguageFilter('ru', [RISING_SUN])).toBe('all');
    expect(effectiveLanguageFilter('ru', [RISING_SUN, VORON])).toBe('ru');
    expect(effectiveLanguageFilter('all', [RISING_SUN, VORON])).toBe('all');
  });

  it('LG-07 **a new library offers the choice from its first run**', () => {
    // Seeding a song for each audience (ADR-080) is paid back by being able to set one aside.
    const seeded = createExampleSongs();
    expect(seeded.map((example) => [example.title, songLanguage(example)])).toEqual([
      ['House of the Rising Sun', 'en'],
      ['Дорогой длинною', 'ru'],
    ]);
    expect(offersLanguageChoice(seeded)).toBe(true);
  });
});
