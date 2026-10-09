/**
 * Acceptance tests over the development fixtures in `_meta/example-songs.md`.
 * The expected values here are the ones that document states.
 */
import { describe, expect, it } from "vitest";
import { createExampleSongs, createFixtureSongs } from "../src/lib/examples";
import { transposeChord } from "../src/lib/chords";
import { toNashville } from "../src/lib/nashville";
import {
  collectChordOccurrences,
  createConcealment,
  sectionsOf,
} from "../src/lib/learning";
import {
  buildSchedule,
  isBlankRow,
  rowIndexAt,
  totalDurationMs,
} from "../src/lib/playback";
import { createSongStore, type StorageLike } from "../src/lib/storage";
import { setCurrentKey } from "../src/lib/songs";
import type { Song } from "../src/types/song";

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const examples = createFixtureSongs();
const byTitle = (title: string): Song => {
  const song = examples.find((item) => item.title === title);
  if (!song) throw new Error(`missing fixture: ${title}`);
  return song;
};

const scarborough = byTitle("Scarborough Fair");
const blackbird = byTitle("If I Was a Blackbird");
const risingSun = byTitle("House of the Rising Sun");
const parovoz = byTitle("Постой, паровоз");

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

describe("example songs", () => {
  it("EX-01 provides the four fixtures with their stated keys and tempos", () => {
    expect(examples).toHaveLength(4);
    expect([scarborough.originalKey, scarborough.tempo]).toEqual(["Dm", 90]);
    expect([blackbird.originalKey, blackbird.tempo]).toEqual(["G", 90]);
    expect([risingSun.originalKey, risingSun.tempo]).toEqual(["Am", 180]);
    expect([parovoz.originalKey, parovoz.tempo]).toEqual(["C#m", 120]);
    // A line's length is in bars of its own meter (ADR-032): two of 3/4 is six beats, and the Rising
    // Sun's four of 6/8 — a bar to each chord — is twenty-four.
    expect([scarborough.meter, scarborough.barsPerLine]).toEqual(['3/4', 2]);
    expect([blackbird.meter, blackbird.barsPerLine]).toEqual(['3/4', 2]);
    expect([risingSun.meter, risingSun.barsPerLine]).toEqual(['6/8', 4]);
    expect([parovoz.meter, parovoz.barsPerLine]).toEqual(['2/4', 4]);
    // A fixture opens in its own key.
    expect(examples.every((song) => song.currentKey === song.originalKey)).toBe(
      true,
    );
    expect(examples.every((song) => song.learningPlaythrough === 0)).toBe(true);
  });

  it("EX-02 parses every row, holding the verse endings for an extra bar", () => {
    expect(scarborough.rows).toHaveLength(16);
    expect(blackbird.rows).toHaveLength(16);
    expect(risingSun.rows).toHaveLength(35);
    // Four nine-line verses, each closing on its last three lines sung twice, with a blank line
    // between. A line is four bars of 2/4, and the three that end a phrase are held for eight.
    expect(parovoz.rows).toHaveLength(39);
    expect(parovoz.rows.filter((row) => row.bars !== null).map((row) => row.bars)).toEqual(
      Array(12).fill(8),
    );
    expect(sectionsOf(parovoz.rows)).toHaveLength(4);
    // Every verse is the same music, so learning level 1 has three repeats to thin (ADR-058).
    const signatures = sectionsOf(parovoz.rows).map((section) =>
      section.flatMap((row) => row.chords.map((chord) => chord.symbol)).join(" "),
    );
    expect(new Set(signatures).size).toBe(1);

    // A line takes the song default unless it says otherwise, and it says so in bars (ADR-032).
    // Scarborough and Blackbird hold each verse ending for four bars against a usual two.
    expect(scarborough.rows.map((row) => row.bars)).toEqual([
      null,
      null,
      null,
      4,
      null,
      null,
      null,
      4,
      null,
      null,
      null,
      4,
      null,
      null,
      null,
      4,
    ]);
    // Rising Sun closes every verse with the same turnaround — D, F, Am, E, Am, E — written as
    // one line of six bars, a bar to each chord. Nothing else departs from the four-bar line.
    expect(risingSun.rows.filter((row) => row.bars !== null).map((row) => row.bars)).toEqual([
      6, 6, 6, 6, 6, 6,
    ]);
    const turnaround = risingSun.rows[4];
    expect(turnaround.chords.map((chord) => chord.symbol)).toEqual(["D", "F", "Am", "E", "Am", "E"]);
    expect(turnaround.lyrics.trim()).toBe("");
  });

  it("EX-03 keeps the lyric text intact and anchors each chord inside it", () => {
    const first = scarborough.rows[0];
    expect(first.lyrics).toBe("O, where are you going? To Scarborough Fair?");
    expect(first.chords.map((chord) => chord.symbol)).toEqual([
      "Dm",
      "C",
      "Dm",
    ]);
    expect(
      first.lyrics.slice(first.chords[1].index, first.chords[1].index + 5),
    ).toBe("going");

    // The line the fixture document names as the parsing acceptance test.
    const blackbirdLine = blackbird.rows.find((row) =>
      row.lyrics.startsWith("I'd follow the ship"),
    );
    expect(blackbirdLine?.chords).toHaveLength(3);
    expect(blackbirdLine?.lyrics).toBe(
      "I'd follow the ship that my true love sails in.",
    );
  });

  it("EX-04 gives the relative representation the fixtures specify", () => {
    expect(symbolsOf(scarborough)).toEqual(["Dm", "C"]);
    expect(symbolsOf(scarborough).map((s) => toNashville(s, "Dm"))).toEqual([
      "i",
      "VII",
    ]);

    expect(symbolsOf(blackbird)).toEqual(["G", "C", "D"]);
    expect(symbolsOf(blackbird).map((s) => toNashville(s, "G"))).toEqual([
      "I",
      "IV",
      "V",
    ]);

    expect(symbolsOf(risingSun)).toEqual(["Am", "C", "D", "F", "E"]);
    expect(symbolsOf(risingSun).map((s) => toNashville(s, "Am"))).toEqual([
      "i",
      "III",
      "IV",
      "VI",
      "V",
    ]);

    // Cyrillic lyrics parse like any other: the chord still lands on its syllable.
    expect(parovoz.rows[0].lyrics).toBe("Постой, паровоз...");
    expect(symbolsOf(parovoz)).toEqual(["C#m", "F#m", "G#", "E", "C#"]);
    expect(symbolsOf(parovoz).map((s) => toNashville(s, "C#m"))).toEqual([
      "i",
      "iv",
      "V",
      "III",
      "I",
    ]);
  });

  it("EX-05 transposes Blackbird from G to A with its degrees unchanged", () => {
    const symbols = symbolsOf(blackbird);
    const before = symbols.map((symbol) => toNashville(symbol, "G"));

    const transposed = symbols.map((symbol) =>
      transposeChord(symbol, "G", "A"),
    );
    expect(transposed).toEqual(["A", "D", "E"]);

    const after = transposed.map((symbol) => toNashville(symbol, "A"));
    expect(after).toEqual(before);
    expect(after).toEqual(["I", "IV", "V"]);

    // Changing the display key never rewrites what is stored.
    const inA = setCurrentKey(blackbird, "A");
    expect(inA.rows).toEqual(blackbird.rows);
  });

  it("EX-06 has enough chords for the levels to be visibly different", () => {
    for (const song of examples) {
      const occurrences = collectChordOccurrences(song.rows);
      expect(occurrences.length).toBeGreaterThanOrEqual(20);

      const sizes = [0, 1, 2].map(
        (playthrough) => createConcealment(song.rows, playthrough, 11).size,
      );

      // Each level hides strictly more than the one before it.
      expect(sizes[1]).toBeGreaterThan(sizes[0]);
      expect(sizes[2]).toBeGreaterThan(sizes[1]);

      // Half at the second level, four fifths at the third — near enough, since each section is
      // rounded on its own and opening chords are held back below the last level (ADR-013).
      expect(sizes[1] / occurrences.length).toBeGreaterThan(0.45);
      expect(sizes[1] / occurrences.length).toBeLessThan(0.56);
      expect(sizes[2] / occurrences.length).toBeGreaterThan(0.75);
      expect(sizes[2] / occurrences.length).toBeLessThan(0.85);

      // Even the last level leaves something to read.
      expect(sizes[2]).toBeLessThan(occurrences.length);
    }
  });

  it("EX-10 thins the repeats of a song that marks its sections", () => {
    // Rising Sun separates its verses with blank lines, so the first level has repeats to work
    // on. The other two fixtures are written as one block and get nothing until level 2 — which
    // is what section detection costs when a song does not say where its sections are (ADR-058).
    const risingSun = examples.find((song) => song.title === "House of the Rising Sun");
    expect(risingSun).toBeDefined();
    expect(sectionsOf(risingSun!.rows).length).toBeGreaterThan(1);

    const concealed = createConcealment(risingSun!.rows, 0, 11);
    expect(concealed.size).toBeGreaterThan(0);
    // Nothing in the opening section: that is the verse you are reading for the first time.
    const opening = sectionsOf(risingSun!.rows)[0];
    for (const key of collectChordOccurrences(opening)) {
      expect(concealed.has(key)).toBe(false);
    }
  });


  it("EX-07 builds a playable schedule that runs its lines back to back", () => {
    // The meter matters here: `//3` is three bars, and a bar of 6/8 is not a bar of 4/4.
    const schedule = buildSchedule(
      risingSun.rows,
      risingSun.tempo,
      risingSun.barsPerLine,
      risingSun.meter,
    );
    // An eighth at ♪ = 180 is a third of a second, so a bar of 6/8 is 2000ms, every four-bar line
    // is 8000ms, and they simply follow on.
    expect(schedule[0].startMs).toBe(0);
    expect(schedule[0].endMs).toBeCloseTo(8000);
    expect(schedule[4].startMs).toBeCloseTo(8000 * 4);

    // The blank lines between verses are rendered but never played (ADR-025), so they are absent
    // from the schedule and cost the song no time.
    const played = risingSun.rows.filter((row) => !isBlankRow(row));
    expect(risingSun.rows.some(isBlankRow)).toBe(true);
    expect(schedule).toHaveLength(played.length);

    // Every lyric line is four bars of 6/8 — twenty-four beats, 8000ms. Each verse's turnaround is
    // held for six bars with `|6|`, which is thirty-six (ADR-026, ADR-032).
    const turnarounds = schedule.filter((entry) => entry.beats === 36);
    expect(turnarounds).toHaveLength(6);
    expect(schedule[4].beats).toBe(36);
    const lyricLines = played.length - turnarounds.length;
    expect(schedule.filter((entry) => entry.beats === 24)).toHaveLength(lyricLines);
    expect(totalDurationMs(schedule)).toBeCloseTo(8000 * lyricLines + 2000 * 6 * turnarounds.length);

    // Playback starts on the first row and finishes cleanly after the last.
    expect(rowIndexAt(schedule, 0)).toBe(0);
    expect(rowIndexAt(schedule, totalDurationMs(schedule) - 1)).toBe(
      risingSun.rows.length - 1,
    );
    expect(rowIndexAt(schedule, totalDurationMs(schedule))).toBe(-1);
  });

  it("EX-08 round-trips through storage unchanged", async () => {
    const store = createSongStore(memoryStorage());
    for (const song of examples) await store.saveSong(song);
    expect(await store.load()).toEqual(examples);
  });

  it("EX-09 gives every fixture and row a distinct id on each call", () => {
    const again = createExampleSongs();
    const ids = [...examples, ...again].flatMap((song) => [
      song.id,
      ...song.rows.map((row) => row.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("EX-11 a new library starts with the Rising Sun and Постой, паровоз (ADR-089)", () => {
    // The other fixtures are for the tests above; a first run gets a song each audience knows.
    expect(createExampleSongs().map((song) => song.title)).toEqual([
      "House of the Rising Sun",
      "Постой, паровоз",
    ]);
  });
});
