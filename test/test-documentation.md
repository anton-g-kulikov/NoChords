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
| Inline `[Chord]lyric` and `/n/` notation | `src/lib/inline.ts` | `inline.test.ts` |
| Chord-over-lyric layout | `src/lib/display.ts` | `display.test.ts` |
| Learning concealment | `src/lib/learning.ts` | `learning.test.ts` |
| Playback timing | `src/lib/playback.ts` | `playback.test.ts` |
| Song state transitions | `src/lib/songs.ts` | `songs.test.ts` |
| Metronome timing | `src/lib/metronome.ts` | `metronome.test.ts` |
| Chord reveal on tap | `src/lib/reveal.ts` | `reveal.test.ts` |
| Numeric field commits | `src/lib/numberField.ts` | `number-field.test.ts` |
| Local persistence | `src/lib/storage.ts` | `storage.test.ts` |
| Cloud document mapping | `src/lib/songDoc.ts` | `song-doc.test.ts` |
| Sign-in import decision | `src/lib/cloudImport.ts` | `cloud-import.test.ts` |
| First-run example seeding | `src/lib/firstRun.ts` | `first-run.test.ts` |
| Device preferences | `src/lib/settings.ts` | `settings.test.ts` |
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
| NV-01 | Diatonic majors are uppercase numerals in C (`C`→`I`, `F`→`IV`, `G`→`V`) | ✅ |
| NV-02 | Minor lowercases the numeral rather than adding a letter (`Dm`→`ii`, `Am`→`vi`) | ✅ |
| NV-03 | Suffixes follow the numeral (`G7`→`V7`, `Cmaj7`→`Imaj7`, `Dm7`→`ii7`) | ✅ |
| NV-04 | Works in a non-C key (`G`→`I` and `D`→`V` in G) | ✅ |
| NV-05 | Chromatic roots get a flattened numeral (`Eb` in C → `bIII`, `Ebm` → `biii`) | ✅ |
| NV-06 | Slash chords render both, the bass staying uppercase (`Dm/A` in C → `ii/VI`) | ✅ |
| NV-14 | Diminished and half-diminished are marked (`Bdim` in C → `vii°`) | ✅ |
| NV-15 | `maj` is not mistaken for minor (`Cmaj`→`Imaj`, `Cm`→`i`) | ✅ |
| NV-07 | Unparseable text passes through unchanged | ✅ |
| NV-08 | **Degrees are unchanged after transposition** (PRD invariant) | ✅ |
| NV-10 | Minor keys read against the natural minor scale (`C` in Dm → `VII`) | ✅ |
| NV-11 | Major keys stay on the major scale (`C` in A → `bIII`, in Am → `III`) | ✅ |
| NV-12 | The invariant holds for the minor-key fixtures too | ✅ |
| NV-13 | Blackbird G→A gives A/D/E with numerals still `I`/`IV`/`V` | ✅ |

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
| IN-12 | Reads a line length written as `/12/` and keeps it out of the lyric | ✅ |
| IN-13 | Leaves the length unset when the line does not say | ✅ |
| IN-14 | Does not mistake a slash chord (`[C/G]`) for a line length | ✅ |
| IN-15 | Keeps a lone slash in the lyric as text (`and/or`) | ✅ |
| IN-16 | Removes the length tag before fixing chord offsets | ✅ |
| IN-17 | Ignores a zero or malformed length | ✅ |
| IN-18 | Writes the length back at the end of the line | ✅ |

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
| LN-05 | Selection size matches the stage, capped by the rule below (10 chords → 0/2/4/6/7/10) | ✅ |
| LN-06 | 100% conceals every occurrence | ✅ |
| LN-07 | 0% conceals nothing | ✅ |
| LN-08 | **Selection is stable across repeated reads within one playthrough** | ✅ |
| LN-09 | Different playthrough seeds produce different selections | ✅ |
| LN-10 | Selection only ever contains real occurrence keys | ✅ |
| LN-11 | Rounding is exact at each stage for a non-multiple-of-5 chord count | ✅ |
| LN-12 | **The first chord of every line survives stages 1–4** | ✅ |
| LN-13 | The final stage conceals the opening chords too | ✅ |
| LN-14 | The selection is capped at the eligible chords rather than overshooting | ✅ |

### Playback timing — `playback.test.ts`

| # | Case | Status |
|---|------|--------|
| PB-01 | Line duration derives from tempo and beat count (120bpm, 4 beats → 2000ms) | ✅ |
| PB-02 | **A line may override the song default with its own `/n/` beat count** | ✅ |
| PB-03 | Schedule start times accumulate across rows | ✅ |
| PB-04 | Total duration equals the sum of row durations plus pauses | ✅ |
| PB-05 | `rowIndexAt` resolves the active row for a given elapsed time | ✅ |
| PB-06 | Elapsed time inside a pause still reports the row that owns the pause | ✅ |
| PB-07 | Elapsed time past the end reports completion | ✅ |
| PB-08 | An empty song produces an empty schedule and zero duration | ✅ |
| PB-09 | Faster tempo yields a shorter schedule | ✅ |
| PB-10 | A line with no `/n/` takes the song's beats-per-line | ✅ |
| PB-11 | A zero or negative beat count falls back to the default | ✅ |
| PB-12 | **No seconds anywhere: doubling the tempo exactly halves the song** | ✅ |

### Song state transitions — `songs.test.ts`

| # | Case | Status |
|---|------|--------|
| SG-01 | `createSong` seeds a song with one empty row and sane defaults | ✅ |
| SG-02 | `rowsFromPastedText` makes one row per pasted line | ✅ |
| SG-03 | Drops trailing blank lines but keeps interior ones | ✅ |
| SG-04 | Handles CRLF line endings | ✅ |

| SG-06 | `deleteRow` removes the row, and keeps at least one row present | ✅ |
| SG-07 | `updateRow` patches a single field without touching siblings | ✅ |
| SG-08 | **`completeLearningPlaythrough` increments the counter** | ✅ |
| SG-09 | The counter saturates at 5 (100% concealment) | ✅ |
| SG-10 | **`resetLearningProgress` returns the counter to 0** | ✅ |
| SG-11 | Changing the current key leaves `originalKey` and stored chords untouched | ✅ |
| SG-12 | Pasted lines are parsed for inline chord markup | ✅ |
| SG-13 | A line length written as `/n/` is read from pasted text | ✅ |
| SG-15 | **Song text round-trips through rows unchanged** | ✅ |
| SG-16 | One row per line, blank lines included | ✅ |
| SG-17 | Row ids stay stable when a line is edited | ✅ |
| SG-18 | A newly typed line gets its own id | ✅ |
| SG-19 | A trailing blank line survives, so Enter works at the end | ✅ |

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

### Metronome timing — `metronome.test.ts`

| # | Case | Status |
|---|------|--------|
| MT-01 | Beat length derives from the tempo (120bpm → 500ms) | ✅ |
| MT-02 | A zero or negative tempo cannot divide by zero | ✅ |
| MT-03 | Count-in length is its beats at the song tempo | ✅ |
| MT-04 | A negative count-in is treated as none | ✅ |
| MT-05 | `beatsInWindow` returns the beats falling in a window | ✅ |
| MT-06 | **The window is half-open, so contiguous scans never double a click** | ✅ |
| MT-07 | Beat indices run negative through the count-in | ✅ |
| MT-08 | An empty or inverted window yields nothing | ✅ |
| MT-09 | A window shorter than a beat is handled | ✅ |
| MT-10 | The first beat of each line is accented | ✅ |
| MT-11 | Accents follow the song's line length, not a fixed bar | ✅ |
| MT-12 | Accents are correct through negative count-in beats | ✅ |
| MT-13 | A nonsensical line length degrades to 4/4, not "accent everything" | ✅ |

### Numeric field commits — `number-field.test.ts`

Intent: decide what a partly-typed number field should store. The regression that prompted this is
NF-02 — an emptied field previously restored the old value, so a number could never change its
digit count.

| # | Case | Status |
|---|------|--------|
| NF-01 | A valid in-range number commits | ✅ |
| NF-02 | **An empty field commits nothing** (the 90 → 80 regression) | ✅ |
| NF-03 | Whitespace alone commits nothing | ✅ |
| NF-04 | A value below the minimum commits nothing, so `8` en route to `80` is not stored | ✅ |
| NF-05 | A value above the maximum commits nothing | ✅ |
| NF-06 | The bounds themselves are allowed | ✅ |
| NF-07 | Non-numeric text commits nothing | ✅ |
| NF-08 | A partial decimal such as `1.` commits nothing, but `1.5` does | ✅ |
| NF-09 | Leading zeros and surrounding spaces are read as the number they are | ✅ |
| NF-10 | A negative number commits only where the minimum allows it | ✅ |

### Chord reveal on tap — `reveal.test.ts`

Intent: a tap in learning mode must bring a whole line's concealed chords back **immediately**, let
go of them **on its own**, and never touch the concealment itself. Time is passed in explicitly so
expiry is tested without waiting on a clock.

| # | Case | Status |
|---|------|--------|
| RV-01 | Revealing a line marks it revealed from that moment | ✅ |
| RV-02 | A revealed line stops being revealed once its window passes | ✅ |
| RV-03 | The boundary is half-open: it is revealed at `expiry - 1`, not at `expiry` | ✅ |
| RV-04 | A line that was never tapped is not revealed | ✅ |
| RV-05 | Several lines can be revealed at once, each expiring on its own clock | ✅ |
| RV-06 | Re-tapping a revealed line extends it rather than toggling it off | ✅ |
| RV-07 | The reveal duration is overridable, for tests and future tuning | ✅ |
| RV-08 | Pruning drops expired entries and keeps live ones | ✅ |
| RV-09 | Pruning returns the same object when nothing expired, so React can skip the render | ✅ |
| RV-10 | `nextExpiry` reports when the soonest reveal ends, for scheduling the tidy-up | ✅ |
| RV-11 | `nextExpiry` is null when nothing is revealed | ✅ |
| RV-12 | A second tap on the same line inside the window counts as a double tap | ✅ |
| RV-13 | A second tap after the window does not | ✅ |
| RV-14 | A tap on a *different* line is never a double tap, however fast | ✅ |
| RV-15 | The first tap of all is never a double tap | ✅ |
| RV-16 | Reveal state is derived data and never mutates its input | ✅ |

### Cloud document mapping — `song-doc.test.ts`

Intent: a Firestore document is untrusted input in exactly the way stored JSON is — it can be
written by an older version of the app, or by hand in the console. Mapping both ways must be
lossless for good data and must refuse bad data rather than letting it into the app.

| # | Case | Status |
|---|------|--------|
| SD-01 | A song round-trips to a document and back unchanged | ✅ |
| SD-02 | The document carries the song id as a field as well as its key | ✅ |
| SD-03 | Rows survive with their chords, anchors and beat overrides | ✅ |
| SD-04 | `beats: null` survives, rather than becoming undefined | ✅ |
| SD-05 | A document missing required fields is rejected | ✅ |
| SD-06 | A document with wrongly typed fields is rejected | ✅ |
| SD-07 | A document with a malformed row is rejected whole | ✅ |
| SD-08 | Unknown extra fields are dropped rather than carried into the app | ✅ |
| SD-09 | The document contains no `undefined`, which Firestore rejects | ✅ |

### Sign-in import decision — `cloud-import.test.ts`

Intent: decide, from what is in each place, whether signing in should offer to bring local songs
up. Getting this wrong either duplicates a library or appears to lose one.

| # | Case | Status |
|---|------|--------|
| CI-01 | Local songs and an empty cloud library → offer the import | ✅ |
| CI-02 | Local songs and a non-empty cloud library → do not offer | ✅ |
| CI-03 | No local songs → nothing to offer, whatever is in the cloud | ✅ |
| CI-04 | Neither side has songs → nothing to offer | ✅ |
| CI-05 | The decision is a pure function of the two counts, with no inspection of content | ✅ |

If the local library happens to be only the example songs, the offer is still made and the user
declines it. Recognising the examples would mean matching on their titles, which breaks as soon as
one is renamed — a worse failure than one extra question.

### First-run seeding — `first-run.test.ts`

Intent: decide whether a library should be given the example songs. The examples are seeded once
and then owned by the user, so the failure to avoid is bringing back songs someone deleted.

| # | Case | Status |
|---|------|--------|
| FR-01 | An empty, never-seeded library → seed the examples | ✅ |
| FR-02 | An already-seeded library → never seed again, even when empty | ✅ |
| FR-03 | A library with songs in it → leave it alone | ✅ |
| FR-04 | A seeded library with songs in it → nothing to do | ✅ |
| FR-05 | A fresh device reads as not seeded | ✅ |
| FR-06 | The flag round-trips through storage | ✅ |
| FR-07 | The flag lives under its own key, not inside the library | ✅ |
| FR-08 | A flag written by an earlier session is honoured | ✅ |
| FR-09 | A blocked or absent store reads as a fresh start and never throws | ✅ |

### Device preferences — `settings.test.ts`

| # | Case | Status |
|---|------|--------|
| SET-01 | Defaults are returned when nothing is stored | ✅ |
| SET-02 | Saved settings round-trip | ✅ |
| SET-03 | Corrupt or non-object JSON falls back to the defaults | ✅ |
| SET-04 | A partly broken record keeps its valid fields | ✅ |
| SET-05 | Volume is clamped into 0..1 | ✅ |
| SET-06 | Count-in is clamped to a sane number of beats | ✅ |
| SET-07 | A throwing backend, or none at all, degrades to the defaults | ✅ |

### Fixture acceptance — `examples.test.ts`

Covers the "Acceptance Tests Using These Fixtures" section of `../_meta/example-songs.md`.

| # | Case | Status |
|---|------|--------|
| EX-01 | The three fixtures load with their stated keys and tempos | ✅ |
| EX-02 | Every row parses, with verse endings held for an extra bar (`/12/`) | ✅ |
| EX-03 | Lyric text is intact and each chord is anchored inside it | ✅ |
| EX-04 | Relative representation matches the document (`Dm`→`1m`, `C`→`7`, etc.) | ✅ |
| EX-05 | Blackbird G→A gives A/D/E with degrees unchanged, stored rows untouched | ✅ |
| EX-06 | Each fixture has enough occurrences for every concealment step to be visible | ✅ |
| EX-07 | Schedule honours the held lines, starts at row 1, completes cleanly | ✅ |
| EX-08 | Fixtures round-trip through storage unchanged | ✅ |
| EX-09 | Every fixture and row gets a distinct id on each call | ✅ |

## Browser acceptance run

Driven against a production build (`npm run build && npm run preview`) with Playwright at a
phone-sized viewport (420×900). 19 checks, all passing:

| Check | Result |
|-------|--------|
| The editor is a single text area, with no per-row cards left | ✅ |
| The whole song is in the box, in inline notation | ✅ |
| A held line reads `/12/`, and no `[n]` seconds notation survives anywhere | ✅ |
| Beats per line imports as 6 for the 3/4 fixtures | ✅ |
| Typing a new line is not reformatted mid-edit, and the caret does not jump | ✅ |
| The typed line persists across a reload | ✅ |
| Nashville renders roman numerals — `i III IV i V i` for the A-minor fixture | ✅ |
| Minor is lowercase, major uppercase, and no arabic digits remain | ✅ |
| **Numerals are byte-identical after transposing Am → Cm** | ✅ |
| Concealment blur is the softened 4px | ✅ |
| Stages 1–4 conceal 5/10/14/15 of 24 chords, **never a line's first chord** | ✅ |
| The final stage conceals all 24, opening chords included | ✅ |
| No console errors or page errors | ✅ |

### Metronome run

A second run, with the audio graph instrumented to record every scheduled click. 18 checks, all
passing:

| Check | Result |
|-------|--------|
| Toggle, volume slider, and count-in control are present | ✅ |
| Metronome defaults to off, with the volume slider disabled | ✅ |
| Enabling it enables the volume slider | ✅ |
| The count-in indicator appears and counts down from 6 | ✅ |
| The count-in ends and the song starts | ✅ |
| Clicks are actually scheduled on the audio graph | ✅ |
| **Clicks land exactly one beat apart — worst error 0.00ms over 6 gaps at 80bpm** | ✅ |
| No duplicate click times | ✅ |
| One accent per six-beat line | ✅ |
| Volume reaches the gain envelope (0.400 peak at 80%) | ✅ |
| Enabled, volume, and count-in all persist across a reload | ✅ |

The 0.00ms figure is the point of ADR-014's single anchor: pinning `performance.now()` to
`AudioContext.currentTime` on every scheduler tick instead measured 1.85ms of beat-to-beat jitter.

### Cloud persistence run — unconfigured build

The build that ships without an API key must be indistinguishable from the app before cloud sync
existed. 8 checks, all passing:

| Check | Result |
|-------|--------|
| No sign-in is offered, and no account bar renders | ✅ |
| **No Firebase network request is made at all** | ✅ |
| Example songs still load | ✅ |
| An edit persists locally through the 800ms write debounce | ✅ |
| A deletion persists across a reload | ✅ |
| No console or page errors | ✅ |

Bundle split verified separately by building with a dummy key: app chunk 55.8kB gzip, Firebase
chunk 183.6kB, and zero SDK bytes in the app chunk (ADR-023).

Signed-in behaviour — real Google sign-in, cross-device sync and the rules — cannot be exercised
from this sandbox and is listed under "Not yet verified" below.

### Not yet verified

These need a configured project and a real Google account, and are outstanding:

- Signing in, and the library switching to Firestore.
- A song written on one device appearing on another.
- The import prompt on a first sign-in with local songs.
- The security rules actually refusing another user's documents.

### Numeric field run

The reported flow reproduced at 420×780, on the fields that were broken. 15 checks, all passing:

| Check | Result |
|-------|--------|
| **The field can be emptied — the keystroke that used to snap it back** | ✅ |
| 90 → backspace → 9 → backspace → empty → type `80` → 80 | ✅ |
| 4 → empty → type `12` → 12 beats per line | ✅ |
| Leaving a field empty restores the last good value, not a blank | ✅ |
| Below-minimum text (`5` for tempo) is never committed | ✅ |
| Both values survive a reload, so they really were persisted | ✅ |
| A tempo change from the slider still reaches the field | ✅ |
| Count-in behaves the same way | ✅ |

### Chord reveal run

Driven at 420×780, in learning mode advanced to three completed playthroughs so chords are really
concealed. 10 checks, all passing:

| Check | Result |
|-------|--------|
| **A single tap reveals the whole line — 2 concealed chords → 0** | ✅ |
| Other lines stay concealed | ✅ |
| The reveal is immediate, with no double-tap wait | ✅ |
| **Learning progress is unchanged by revealing** | ✅ |
| **The reveal expires by itself while playback is paused** | ✅ |
| Nothing outside the tapped line changed | ✅ |
| A double tap seeks to the line (0:18 → 0:13) | ✅ |
| A single tap still seeks in Full mode (0:13 → 0:04) | ✅ |
| Nothing is concealed in Full mode | ✅ |

Progress is read by opening the setup panel, because ADR-017 keeps the learning bar inside it while
playing.

### Playing-screen space run

Measured at a 420×780 phone viewport with the metronome on and learning mode active — the worst
case for header height. 12 checks, all passing:

| Check | Result |
|-------|--------|
| **Setup collapses when playback starts — header 475px → 69px** | ✅ |
| The header leaves 91% of the screen to the song | ✅ |
| **Fully visible chart rows rise from 0 (before the fix) to 7** | ✅ |
| Play/Pause and Restart stay reachable while collapsed | ✅ |
| The active row sits clear of the sticky header | ✅ |
| The disclosure is compact, reading just "Setup" | ✅ |
| Setup reopens on demand mid-play, and closes again | ✅ |
| Pausing does *not* spring the setup back open | ✅ |
| The disclosure is still available after pausing | ✅ |

Caret and persistence behaviour is verified with the caret placed deterministically
(`Control+Home`, `End`); clicking into the middle of the text area naturally puts it elsewhere.

The driver scripts are not committed: they target a running preview server and are verification
tools rather than part of the suite. Re-create them from this table if the run needs repeating.
