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
    // All three are 3/4 written two bars to a line.
    expect(examples.every((song) => song.beatsPerLine === 6)).toBe(true);
    // A fixture opens in its own key.
    expect(examples.every((song) => song.currentKey === song.originalKey)).toBe(true);
    expect(examples.every((song) => song.learningPlaythrough === 0)).toBe(true);
  });

  it('EX-02 parses every row, holding the verse endings for an extra bar', () => {
    expect(scarborough.rows).toHaveLength(16);
    expect(blackbird.rows).toHaveLength(16);
    expect(risingSun.rows).toHaveLength(8);

    // A line takes the song default unless it is a verse ending, which holds for twelve beats.
    expect(scarborough.rows.map((row) => row.beats)).toEqual([
      null, null, null, 12, null, null, null, 12, null, null, null, 12, null, null, null, 12,
    ]);
    expect(risingSun.rows.map((row) => row.beats)).toEqual([
      null, null, null, 12, null, null, null, 12,
    ]);
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
    expect(symbolsOf(scarborough).map((s) => toNashville(s, 'Dm'))).toEqual(['i', 'VII']);

    expect(symbolsOf(blackbird)).toEqual(['G', 'C', 'D']);
    expect(symbolsOf(blackbird).map((s) => toNashville(s, 'G'))).toEqual(['I', 'IV', 'V']);

    expect(symbolsOf(risingSun)).toEqual(['Am', 'C', 'D', 'E']);
    expect(symbolsOf(risingSun).map((s) => toNashville(s, 'Am'))).toEqual(['i', 'III', 'IV', 'V']);
  });

  it('EX-05 transposes Blackbird from G to A with its degrees unchanged', () => {
    const symbols = symbolsOf(blackbird);
    const before = symbols.map((symbol) => toNashville(symbol, 'G'));

    const transposed = symbols.map((symbol) => transposeChord(symbol, 'G', 'A'));
    expect(transposed).toEqual(['A', 'D', 'E']);

    const after = transposed.map((symbol) => toNashville(symbol, 'A'));
    expect(after).toEqual(before);
    expect(after).toEqual(['I', 'IV', 'V']);

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
      // Each step lands on the documented percentage, capped by the opening chords that stay
      // visible until the final stage (ADR-013).
      const eligible = occurrences.length - song.rows.filter((row) => row.chords.length > 0).length;
      expect(sizes).toEqual(
        [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction, stage) => {
          const target = Math.round(occurrences.length * fraction);
          return stage === 5 ? occurrences.length : Math.min(target, eligible);
        })
      );
    }
  });

  it('EX-07 builds a playable schedule that honours the held lines', () => {
    const schedule = buildSchedule(risingSun.rows, risingSun.tempo, risingSun.beatsPerLine);
    // A beat at 80bpm is 750ms, so a six-beat line is 4500ms and a twelve-beat one is 9000ms.
    expect(schedule[0].startMs).toBe(0);
    expect(schedule[0].endMs).toBe(4500);
    expect(schedule[4].startMs).toBe(4500 * 3 + 9000);
    expect(totalDurationMs(schedule)).toBe(4500 * 6 + 9000 * 2);

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
