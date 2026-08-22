# Test Documentation

Test intent, cases, and coverage status for NoChords.
Run with `npm test` (Vitest, `node` environment — see `../_meta/architecture-decisions.md` ADR-004).

## Strategy

All behaviour required by the implementation brief lives in pure modules under `src/lib/`, so it is
covered by unit tests with no DOM. React components under `src/components/` are deliberately thin —
they read derived data and dispatch state changes — and are covered by the browser acceptance run
described at the end of this document.

| Area | Module under test | File |
|------|-------------------|------|
| Chord parsing and transposition | `src/lib/chords.ts` | `chords.test.ts` |
| Nashville conversion | `src/lib/nashville.ts` | `nashville.test.ts` |
| Inline `[Chord]lyric` notation | `src/lib/inline.ts` | `inline.test.ts` |
| Chord-over-lyric layout | `src/lib/display.ts` | `display.test.ts` |
| Learning concealment | `src/lib/learning.ts` | `learning.test.ts` |
| Playback timing | `src/lib/playback.ts` | `playback.test.ts` |
| Song state transitions | `src/lib/songs.ts` | `songs.test.ts` |
| Local persistence | `src/lib/storage.ts` | `storage.test.ts` |
| Fixture acceptance | `src/lib/examples.ts` | `examples.test.ts` |

## Test Plan

- **Behavior under change:** the full MVP surface — chord handling, timing, learning progression,
  and persistence.
- **Happy path checks:** each case marked ✅ below.
- **Error and edge cases:** unparseable chords, empty songs, corrupt stored JSON, zero-length
  chord sets, playthrough counts beyond the concealment table, anchors past the end of a lyric.
- **Regression risks:** enharmonic spelling on transposition; Nashville drifting when the current
  key changes; concealment re-randomising during a playthrough; chord anchors drifting out of step
  with the learning occurrence keys.
- **Automated checks to run:** `npm test`, `npm run typecheck`, `npm run build`.
- **Manual verification to run:** the browser acceptance run at the end of this document.

## Cases

### Chord parsing and transposition — `chords.test.ts`

| # | Case | Status |
|---|------|--------|
| CH-01 | Parses a bare root (`C`) into root/accidental/suffix | ✅ |
| CH-02 | Parses a sharp root with suffix (`F#m`) | ✅ |
| CH-03 | Parses a flat root (`Bb`) | ✅ |
| CH-04 | Parses numeric and extended suffixes (`G7`, `Cmaj7`, `sus4`, `dim`) | ✅ |
| CH-05 | Parses slash chords, keeping the bass note (`C/G`, `D/F#`) | ✅ |
| CH-06 | Returns `null` for text that is not a chord (`N.C.`, `%`, `Hello`, `\|`) | ✅ |
| CH-07 | Transposes up: C→G raises `C` to `G`, `Am` to `Em` | ✅ |
| CH-08 | Transposes down and wraps across the octave boundary | ✅ |
| CH-09 | Preserves the suffix through transposition (`Cmaj7` → `Gmaj7`) | ✅ |
| CH-10 | Transposes the bass of a slash chord too (`C/G` → `G/D`) | ✅ |
| CH-11 | Spells with flats in flat keys and sharps in sharp keys | ✅ |
| CH-12 | Leaves unparseable tokens untouched instead of throwing | ✅ |
| CH-13 | Transposing to the same key is an identity (`Bb` stays `Bb`) | ✅ |
| CH-14 | Transposes every chord of a progression | ✅ |
| CH-15 | Round trip C→G→C restores the original spelling | ✅ |
| CH-16 | Transposes between minor keys (`Am`→`Bm`) | ✅ |
| CH-17 | Spells minor keys with flats where convention expects them (`Dm`, `Gm`) | ✅ |

### Nashville conversion — `nashville.test.ts`

| # | Case | Status |
|---|------|--------|
| NV-01 | Diatonic majors map to bare degrees in C (`C`→`1`, `F`→`4`, `G`→`5`) | ✅ |
| NV-02 | Minor quality follows the degree (`Dm`→`2m`, `Am`→`6m`) | ✅ |
| NV-03 | Suffixes follow the degree (`G7`→`57`, `Cmaj7`→`1maj7`) | ✅ |
| NV-04 | Works in a non-C key (`G`→`1` and `D`→`5` in G) | ✅ |
| NV-05 | Chromatic roots get a flattened degree (`Eb` in C → `b3`) | ✅ |
| NV-06 | Slash chords render both degrees (`C/G` in C → `1/5`) | ✅ |
| NV-07 | Unparseable text passes through unchanged | ✅ |
| NV-08 | **Degrees are unchanged after transposition** (PRD invariant) | ✅ |
| NV-10 | Minor keys read against the natural minor scale (`C` in Dm → `7`) | ✅ |
| NV-11 | Major keys stay on the major scale (`C` in A → `b3`, in Am → `3`) | ✅ |
| NV-12 | The invariant holds for the minor-key fixtures too | ✅ |
| NV-13 | Blackbird G→A gives A/D/E with degrees still `1`/`4`/`5` | ✅ |

### Inline notation — `inline.test.ts`

| # | Case | Status |
|---|------|--------|
| IN-01 | Separates chords from the lyric and records each chord's position | ✅ |
| IN-02 | The fixture document's parsing acceptance line yields 3 chords, lyric intact | ✅ |
| IN-03 | Handles a chord falling in the middle of a word | ✅ |
| IN-04 | Anchors come back in ascending order | ✅ |
| IN-05 | A line with no brackets is pure lyrics | ✅ |
| IN-06 | Supports a chord at the very end, and a chords-only row | ✅ |
| IN-07 | Ignores empty brackets and trims chord text | ✅ |
| IN-08 | An unclosed bracket stays literal lyric text | ✅ |
| IN-09 | Keeps a chord symbol it cannot interpret (`[N.C.]`) | ✅ |
| IN-10 | Renders a parsed row back to its inline source | ✅ |
| IN-11 | Round-trips every fixture-shaped line unchanged | ✅ |

### Chord-over-lyric layout — `display.test.ts`

| # | Case | Status |
|---|------|--------|
| DS-01 | Splits the lyric at each chord anchor | ✅ |
| DS-02 | Text before the first chord becomes a chordless leading segment | ✅ |
| DS-03 | **Segments concatenate back to the complete lyric** (layout guarantee) | ✅ |
| DS-04 | A chordless row is a single segment | ✅ |
| DS-05 | Handles an empty row | ✅ |
| DS-06 | Segment numbering matches learning's occurrence keys | ✅ |
| DS-07 | Full and learning modes show transposed names | ✅ |
| DS-08 | Nashville mode ignores the display key | ✅ |
| DS-09 | Symbols are untouched when the song is in its original key | ✅ |

### Learning concealment — `learning.test.ts`

| # | Case | Status |
|---|------|--------|
| LN-01 | Concealment table maps playthroughs 0–5 to 0/20/40/60/80/100% | ✅ |
| LN-02 | Playthrough counts above 5 stay at 100% | ✅ |
| LN-03 | Occurrences are collected as `rowId:chordIndex` across all rows | ✅ |
| LN-04 | Rows with no chords contribute no occurrences | ✅ |
| LN-05 | Selection size matches the percentage at each stage (10 chords → 0/2/4/6/8/10) | ✅ |
| LN-06 | 100% conceals every occurrence | ✅ |
| LN-07 | 0% conceals nothing | ✅ |
| LN-08 | **Selection is stable across repeated reads within one playthrough** | ✅ |
| LN-09 | Different playthrough seeds produce different selections | ✅ |
| LN-10 | Selection only ever contains real occurrence keys | ✅ |
| LN-11 | Rounding is exact at each stage for a non-multiple-of-5 chord count | ✅ |

### Playback timing — `playback.test.ts`

| # | Case | Status |
|---|------|--------|
| PB-01 | Row duration derives from tempo (120bpm, 4 beats → 2000ms) | ✅ |
| PB-02 | **`pauseSeconds` is added on top of the row's normal duration** | ✅ |
| PB-03 | Schedule start times accumulate across rows | ✅ |
| PB-04 | Total duration equals the sum of row durations plus pauses | ✅ |
| PB-05 | `rowIndexAt` resolves the active row for a given elapsed time | ✅ |
| PB-06 | Elapsed time inside a pause still reports the row that owns the pause | ✅ |
| PB-07 | Elapsed time past the end reports completion | ✅ |
| PB-08 | An empty song produces an empty schedule and zero duration | ✅ |
| PB-09 | Faster tempo yields a shorter schedule | ✅ |
| PB-10 | Duration scales with the row's beat count (6 beats at 90bpm → 4000ms) | ✅ |
| PB-11 | A missing or nonsensical beat count falls back to the default | ✅ |

### Song state transitions — `songs.test.ts`

| # | Case | Status |
|---|------|--------|
| SG-01 | `createSong` seeds a song with one empty row and sane defaults | ✅ |
| SG-02 | `rowsFromPastedText` makes one row per pasted line | ✅ |
| SG-03 | Drops trailing blank lines but keeps interior ones | ✅ |
| SG-04 | Handles CRLF line endings | ✅ |
| SG-05 | `addRowAfter` inserts at the right index with a fresh id | ✅ |
| SG-06 | `deleteRow` removes the row, and keeps at least one row present | ✅ |
| SG-07 | `updateRow` patches a single field without touching siblings | ✅ |
| SG-08 | **`completeLearningPlaythrough` increments the counter** | ✅ |
| SG-09 | The counter saturates at 5 (100% concealment) | ✅ |
| SG-10 | **`resetLearningProgress` returns the counter to 0** | ✅ |
| SG-11 | Changing the current key leaves `originalKey` and stored chords untouched | ✅ |
| SG-12 | Pasted lines are parsed for inline chord markup | ✅ |
| SG-13 | Fixture `duration \| pause` metadata is applied to the row above it | ✅ |
| SG-14 | Blank separator lines are dropped only in fixture-formatted text | ✅ |

### Local persistence — `storage.test.ts`

| # | Case | Status |
|---|------|--------|
| ST-01 | Saved songs are returned by a subsequent load | ✅ |
| ST-02 | Loading from empty storage returns an empty list, not an error | ✅ |
| ST-03 | Corrupt JSON in storage returns an empty list instead of throwing | ✅ |
| ST-04 | Non-array stored payloads are rejected | ✅ |
| ST-05 | Entries with missing or wrongly-typed fields are dropped; valid siblings survive | ✅ |
| ST-06 | Learning progress round-trips with the song | ✅ |
| ST-07 | Row fields (chords, beats, pause, keys) round-trip exactly | ✅ |
| ST-08 | A failing storage backend (quota, blocked) does not crash save or load | ✅ |

### Fixture acceptance — `examples.test.ts`

Covers the "Acceptance Tests Using These Fixtures" section of `../_meta/example-songs.md`.

| # | Case | Status |
|---|------|--------|
| EX-01 | The three fixtures load with their stated keys and tempos | ✅ |
| EX-02 | Every row parses with its chords, 6 beats, and stated pause | ✅ |
| EX-03 | Lyric text is intact and each chord is anchored inside it | ✅ |
| EX-04 | Relative representation matches the document (`Dm`→`1m`, `C`→`7`, etc.) | ✅ |
| EX-05 | Blackbird G→A gives A/D/E with degrees unchanged, stored rows untouched | ✅ |
| EX-06 | Each fixture has enough occurrences for every concealment step to be visible | ✅ |
| EX-07 | Schedule honours beats and pauses, starts at row 1, completes cleanly | ✅ |
| EX-08 | Fixtures round-trip through storage unchanged | ✅ |
| EX-09 | Every fixture and row gets a distinct id on each call | ✅ |

## Browser acceptance run

The scenario from the implementation brief and the fixture document, driven against a production
build (`npm run build && npm run preview`) with Playwright. 16 checks, all passing:

| Check | Result |
|-------|--------|
| Editor shows a fixture row in inline notation | ✅ |
| Fixture beat counts import correctly | ✅ |
| A song survives a full page reload (localStorage) | ✅ |
| Full mode shows chord names in the song's key | ✅ |
| Nashville shows `1m 3 4 1m 5 1m` for the A-minor fixture | ✅ |
| Transposing Am → Cm moves chord names to `Cm Eb F Cm G Cm` | ✅ |
| **Nashville output is byte-identical before and after that transposition** | ✅ |
| Learning starts at 0% concealed | ✅ |
| Five completed playthroughs conceal 5/9/14/18/23 of 23 chords (20/40/60/80/100%) | ✅ |
| The concealed set does not change while scrolling | ✅ |
| `Reset learning progress` returns to 0% and 0 playthroughs | ✅ |
| Lyric boxes are pixel-identical with chords concealed vs visible | ✅ |
| Chord boxes are pixel-identical with chords concealed vs visible | ✅ |
| Total duration reflects beats plus per-row pauses (0:41 for the A-minor fixture) | ✅ |
| Clearing a 2s row pause shortens the song to 0:39 | ✅ |
| No console errors or failed requests | ✅ |

Playback scrolling and the active-row highlight were confirmed visually in the same run.

The driver script is not committed: it targets a running preview server and is a verification tool
rather than part of the suite. Re-create it from this table if the acceptance run needs repeating.
