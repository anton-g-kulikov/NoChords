/**
 * Acceptance tests over the development fixtures in `_meta/example-songs.md`.
 * The expected values here are the ones that document states.
 */
import { describe, expect, it } from 'vitest';
import { createExampleSongs } from '../src/lib/examples';
import { transposeChord } from '../src/lib/chords';
import { toNashville } from '../src/lib/nashville';
import { collectChordOccurrences, createConcealment } from '../src/lib/learning';
import { buildSchedule, rowIndexAt, totalDurationMs } from '../src/lib/playback';
import { createSongStore, type StorageLike } from '../src/lib/storage';
import { setCurrentKey } from '../src/lib/songs';
import type { Song } from '../src/types/song';

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const examples = createExampleSongs();
const byTitle = (title: string): Song => {
  const song = examples.find((item) => item.title === title);
  if (!song) throw new Error(`missing fixture: ${title}`);
  return song;
};

const scarborough = byTitle('Scarborough Fair');
const blackbird = byTitle('If I Was a Blackbird');
const risingSun = byTitle('House of the Rising Sun');

/** Every distinct chord symbol in a song, in first-seen order. */
function symbolsOf(song: Song): string[] {
  const seen: string[] = [];
  for (const row of song.rows) {
    for (const chord of row.chords) {
      if (!seen.includes(chord.symbol)) seen.push(chord.symbol);
    }
  }
  return seen;
}

describe('example songs', () => {
  it('EX-01 provides the three fixtures with their stated keys and tempos', () => {
    expect(examples).toHaveLength(3);
    expect([scarborough.originalKey, scarborough.tempo]).toEqual(['Dm', 90]);
    expect([blackbird.originalKey, blackbird.tempo]).toEqual(['G', 90]);
    expect([risingSun.originalKey, risingSun.tempo]).toEqual(['Am', 80]);
    // A fixture opens in its own key.
    expect(examples.every((song) => song.currentKey === song.originalKey)).toBe(true);
    expect(examples.every((song) => song.learningPlaythrough === 0)).toBe(true);
  });

  it('EX-02 parses every row with its chords, beats, and pause', () => {
    expect(scarborough.rows).toHaveLength(16);
    expect(blackbird.rows).toHaveLength(16);
    expect(risingSun.rows).toHaveLength(8);

    // Every fixture row is six beats long.
    for (const song of examples) {
      expect(song.rows.every((row) => row.beats === 6)).toBe(true);
    }

    // Verse-ending rows carry the stated pauses.
    expect(scarborough.rows.map((row) => row.pauseSeconds)).toEqual([
      0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 3,
    ]);
    expect(risingSun.rows.map((row) => row.pauseSeconds)).toEqual([0, 0, 0, 2, 0, 0, 0, 3]);
  });

  it('EX-03 keeps the lyric text intact and anchors each chord inside it', () => {
    const first = scarborough.rows[0];
    expect(first.lyrics).toBe('O, where are you going? To Scarborough Fair?');
    expect(first.chords.map((chord) => chord.symbol)).toEqual(['Dm', 'C', 'Dm']);
    expect(first.lyrics.slice(first.chords[1].index, first.chords[1].index + 5)).toBe('going');

    // The line the fixture document names as the parsing acceptance test.
    const blackbirdLine = blackbird.rows.find((row) =>
      row.lyrics.startsWith("I'd follow the ship")
    );
    expect(blackbirdLine?.chords).toHaveLength(3);
    expect(blackbirdLine?.lyrics).toBe("I'd follow the ship that my true love sails in.");
  });

  it('EX-04 gives the relative representation the fixtures specify', () => {
    expect(symbolsOf(scarborough)).toEqual(['Dm', 'C']);
    expect(symbolsOf(scarborough).map((s) => toNashville(s, 'Dm'))).toEqual(['1m', '7']);

    expect(symbolsOf(blackbird)).toEqual(['G', 'C', 'D']);
    expect(symbolsOf(blackbird).map((s) => toNashville(s, 'G'))).toEqual(['1', '4', '5']);

    expect(symbolsOf(risingSun)).toEqual(['Am', 'C', 'D', 'E']);
    expect(symbolsOf(risingSun).map((s) => toNashville(s, 'Am'))).toEqual(['1m', '3', '4', '5']);
  });

  it('EX-05 transposes Blackbird from G to A with its degrees unchanged', () => {
    const symbols = symbolsOf(blackbird);
    const before = symbols.map((symbol) => toNashville(symbol, 'G'));

    const transposed = symbols.map((symbol) => transposeChord(symbol, 'G', 'A'));
    expect(transposed).toEqual(['A', 'D', 'E']);

    const after = transposed.map((symbol) => toNashville(symbol, 'A'));
    expect(after).toEqual(before);
    expect(after).toEqual(['1', '4', '5']);

    // Changing the display key never rewrites what is stored.
    const inA = setCurrentKey(blackbird, 'A');
    expect(inA.rows).toEqual(blackbird.rows);
  });

  it('EX-06 has enough chord occurrences for every concealment step to be visible', () => {
    for (const song of examples) {
      const occurrences = collectChordOccurrences(song.rows);
      expect(occurrences.length).toBeGreaterThanOrEqual(20);

      const sizes = [0, 1, 2, 3, 4, 5].map(
        (playthrough) => createConcealment(song.rows, playthrough, 11).size
      );
      // Strictly increasing, starting at nothing and ending at everything.
      expect(sizes[0]).toBe(0);
      expect(sizes[5]).toBe(occurrences.length);
      for (let i = 1; i < sizes.length; i += 1) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      }
      // And each step lands on the documented percentage.
      expect(sizes).toEqual(
        [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) => Math.round(occurrences.length * fraction))
      );
    }
  });

  it('EX-07 builds a playable schedule that honours beats and pauses', () => {
    const schedule = buildSchedule(risingSun.rows, risingSun.tempo);
    // 6 beats at 80bpm is 4500ms per row, plus 2s and 3s of pause across the eight rows.
    expect(schedule[0].startMs).toBe(0);
    expect(schedule[0].endMs).toBe(4500);
    expect(schedule[4].startMs).toBe(4500 * 4 + 2000);
    expect(totalDurationMs(schedule)).toBe(4500 * 8 + 2000 + 3000);

    // Playback starts on the first row and finishes cleanly after the last.
    expect(rowIndexAt(schedule, 0)).toBe(0);
    expect(rowIndexAt(schedule, totalDurationMs(schedule) - 1)).toBe(risingSun.rows.length - 1);
    expect(rowIndexAt(schedule, totalDurationMs(schedule))).toBe(-1);
  });

  it('EX-08 round-trips through storage unchanged', () => {
    const store = createSongStore(memoryStorage());
    store.save(examples);
    expect(store.load()).toEqual(examples);
  });

  it('EX-09 gives every fixture and row a distinct id on each call', () => {
    const again = createExampleSongs();
    const ids = [...examples, ...again].flatMap((song) => [
      song.id,
      ...song.rows.map((row) => row.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
