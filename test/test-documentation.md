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
| Chord parsing and transposition | `src/lib/chords.ts`, `src/lib/keys.ts` | `chords.test.ts` |
| Nashville conversion | `src/lib/nashville.ts` | `nashville.test.ts` |
| Inline `[Chord]lyric`, `\|n\|` and `{n/d}` notation | `src/lib/inline.ts` | `inline.test.ts` |
| Chord-over-lyric layout | `src/lib/display.ts` | `display.test.ts` |
| Learning concealment | `src/lib/learning.ts` | `learning.test.ts` |
| Playback timing | `src/lib/playback.ts` | `playback.test.ts` |
| Song state transitions | `src/lib/songs.ts` | `songs.test.ts` |
| Metronome timing | `src/lib/metronome.ts` | `metronome.test.ts` |
| Time signatures | `src/lib/meter.ts` | `meter.test.ts` |
| Chord reveal on tap | `src/lib/reveal.ts` | `reveal.test.ts` |
| Numeric field commits | `src/lib/numberField.ts` | `number-field.test.ts` |
| Local persistence | `src/lib/storage.ts` | `storage.test.ts` |
| Cloud document mapping | `src/lib/songDoc.ts` | `song-doc.test.ts` |
| Sign-in import decision | `src/lib/cloudImport.ts` | `cloud-import.test.ts` |
| First-run example seeding | `src/lib/firstRun.ts` | `first-run.test.ts` |
| Device preferences | `src/lib/settings.ts` | `settings.test.ts` |
| Service worker decisions | `src/lib/pwa.ts` | `pwa.test.ts` |
| Install affordance | `src/lib/install.ts` | `install.test.ts` |
| Screen wake lock | `src/lib/wakeLock.ts` | `wake-lock.test.ts` |
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
| KY-01 | **A key steps by semitone and keeps its mode: Am goes to Bbm, never to A** | ✅ |
| KY-02 | Stepping wraps around the octave | ✅ |
| KY-03 | The result is spelled the way the offered key lists spell it | ✅ |
| KY-04 | Something that is not a key is left alone | ✅ |
| KY-05 | The distance from the original is reported the short way round | ✅ |

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
| IN-12 | A slashed number is ordinary lyric text, now that `/n/` is gone | ✅ |
| IN-13 | A slash chord (`[C/G]`) is not mistaken for anything else | ✅ |
| IN-14 | A lone slash stays in the lyric as text (`and/or`) | ✅ |
| IN-15 | `\|3\|` at the end of a line reads as three bars | ✅ |
| IN-16 | A zero, malformed or lone-pipe tag stays lyric | ✅ |
| IN-17 | The tag is removed before chord offsets are fixed | ✅ |
| IN-18 | The length is written back at the end of the line | ✅ |
| IN-19 | `{4/4}` reads as a signature and leaves the lyric | ✅ |
| IN-20 | Something that is not a signature stays literal lyric | ✅ |
| IN-21 | Signature normalises to the head of the line, length to the tail | ✅ |

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
| LN-01 | A level per completed playthrough, counting from one | ✅ |
| LN-02 | Counts beyond the last level saturate, including old six-stage counts | ✅ |
| LN-15 | **Opening chords are held back until the last level (ADR-013)**; out-of-range levels clamp | ✅ |
| LN-16 | The song splits into sections at its blank lines | ✅ |
| LN-17 | A song with no blank lines is one section | ✅ |
| LN-18 | Passages with no chords are not sections | ✅ |
| LN-03 | One key per chord, addressed by row and position in the row | ✅ |
| LN-04 | Rows with no chords contribute nothing | ✅ |
| LN-10 | Only ever produces keys for real occurrences | ✅ |
| LN-05 | **Level 1 shows the first verse and chorus whole and thins their repeats** | ✅ |
| LN-06 | Levels 2 and 3 blur every section evenly (50%, 80%) | ✅ |
| LN-07 | Level 1 conceals nothing when nothing repeats | ✅ |
| LN-19 | A share is counted against a song written as one section | ✅ |
| LN-12 | The first chord of a line survives levels 1 and 2 | ✅ |
| LN-13 | Opening chords join the pool at level 3 | ✅ |
| LN-14 | The selection is capped at the eligible chords rather than overshooting | ✅ |
| LN-08 | **Stable: the same seed always yields the same selection** | ✅ |
| LN-09 | The selection genuinely depends on the seed | ✅ |
| LN-20 | Two identical verses do not blur in the same places | ✅ |
| LN-11 | Rounds to a whole number of chords for awkward counts | ✅ |

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
| PB-10 | `isBlankRow` recognises a separator; an instrumental bar with chords is not one | ✅ |
| PB-11 | **Blank separator rows are left out of the schedule and cost the song no time** | ✅ |
| PB-12 | Entries keep their song row index, so the active row never lands on a blank | ✅ |
| PB-13 | Seeking a blank row lands on the next row that plays | ✅ |
| PB-14 | A song of nothing but blanks has nothing to play | ✅ |
| PB-15 | A `\|n\|` bar count is measured against the meter in effect | ✅ |
| PB-16 | **An explicit `/n/` beat count wins over a bar count** | ✅ |
| PB-17 | A row stating neither takes the song default, in bars of its own meter | ✅ |
| PB-18 | Entries carry the accent spacing of the meter running at that row | ✅ |
| PB-19 | A signature change restarts the pulse instead of inheriting the old phase | ✅ |
| PB-20 | A signature on a blank line takes effect without the line playing | ✅ |
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
| SG-09 | The counter saturates at the last level | ✅ |
| SG-10 | **`resetLearningProgress` returns the counter to 0** | ✅ |
| SG-14 | A level can be set outright, and one that does not exist is refused | ✅ |
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
| ST-09 | **A song stored before tempo units is read as the unit that preserves its timing** | ✅ |
| ST-10 | A tempo unit the app does not offer is refused | ✅ |

### Metronome timing — `metronome.test.ts`

| # | Case | Status |
|---|------|--------|
| MT-01 | Each beat's time comes from the row it belongs to | ✅ |
| MT-02 | **A meter change is followed: a `{3/4}` section clicks quarters inside a 6/8 song** | ✅ |
| MT-03 | Count-in length is its beats at one beat's length | ✅ |
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
| MT-14 | **A 6/8 song pulses in two — accents on 1 and 4, not one click a bar** | ✅ |
| MT-15 | The accent follows a signature change into the next section | ✅ |
| MT-16 | Count-in beats are accented so the count lands on the downbeat | ✅ |
| MT-17 | With nothing to play the accent falls back to a plain four | ✅ |
| MT-18 | With no song to read a pulse from, the count-in uses the beat it is given | ✅ |
| MT-23 | **The pulse walks the bar as the song plays, starting again at each barline** | ✅ |
| MT-24 | The pulse counts the bar of the meter running there, and names it (ADR-026) | ✅ |
| MT-25 | No pulse before the song starts or after it ends | ✅ |
| MT-26 | **The bars of the line are counted alongside the beats of the bar** | ✅ |
| MT-19 | **One count-in beat has sounded on the first click, all of them on the last** | ✅ |
| MT-20 | Nothing is lit when nothing is counting, and never a beat that is not there | ✅ |
| MT-21 | **The count cycles one bar of dots and counts the bars down beside it** | ✅ |
| MT-22 | Not counting reads as a full count with nothing sounded; a zero-length bar cannot divide by zero | ✅ |
| MT-18 | **A click fires early by the output latency, so it is heard on the beat** | ✅ |
| MT-19 | With no reported latency the timing is unchanged | ✅ |
| MT-20 | Compensation shifts the grid without stretching it | ✅ |
| MT-21 | A nonsensical latency never pushes a click later | ✅ |

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
| SD-10 | The tempo unit is written, and supplied for a document stored without one | ✅ |

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
| CI-06 | Songs that did not reach the account are named | ✅ |
| CI-07 | Nothing is missing once they have all arrived | ✅ |
| CI-08 | An empty account is missing everything | ✅ |
| CI-09 | Songs in the account from other devices are not this device's concern | ✅ |
| CI-10 | The comparison is by id, so a re-run overwrites rather than duplicating | ✅ |
| CI-11 | A device that has never imported has nothing pending | ✅ |
| CI-12 | **An unfinished import survives a reload, so the rest is not stranded** | ✅ |
| CI-13 | The flag clears once everything has arrived | ✅ |
| CI-14 | A blocked or absent store reads as nothing pending and never throws | ✅ |
| CI-15 | **An account this device already imported into is recognised by a shared id** | ✅ |
| CI-16 | Another device's library is not mistaken for this one | ✅ |
| CI-17 | An empty side means no shared history | ✅ |

An accepted import now checks itself: it reads the account back and compares by id, and the offer
stays until everything is there (ADR-031). If the local library happens to be only the example
songs, the offer is still made and the user declines it. Recognising the examples would mean matching on their titles, which breaks as soon as
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

### Time signatures — `meter.test.ts`

Intent: turn a written signature into the two facts the app needs — how long a bar is, and where
the accent falls. Compound meters are the reason this module exists.

| # | Case | Status |
|---|------|--------|
| ME-01 | A signature reads into numerator and denominator | ✅ |
| ME-02 | Anything that is not a signature is rejected | ✅ |
| ME-03 | Simple meters accent once a bar | ✅ |
| ME-04 | **Compound meters accent the dotted pulse: 6/8 clicks every three** | ✅ |
| ME-05 | 3/8 is simple, since three eighths are one pulse | ✅ |
| ME-06 | Nonsense falls back to 4/4 rather than failing | ✅ |
| ME-07 | Bar length is reported for `//n` to measure against | ✅ |

### Tempo units — `tempo.test.ts`

Intent: make a tempo say what it counts. A bare BPM is ambiguous in a compound meter — "6/8 at 180"
is either eighths or the dotted pulse, three times apart — so everything converts through quarter
notes and no meter gets a special case (ADR-052).

| # | Case | Status |
|---|------|--------|
| TU-01 | A bar is measured in quarter notes: 6/8 is three, 7/8 is three and a half | ✅ |
| TU-02 | An unreadable meter falls back to a bar of four | ✅ |
| TU-03 | Each unit is worth 0.5, 1 or 1.5 quarter notes | ✅ |
| TU-04 | **Bar length from meter, number and unit: 4/4 ♩=120 → 2s, 3/4 ♩=60 → 3s, 6/8 ♩.=60 → 2s, 6/8 ♪=180 → 2s** | ✅ |
| TU-05 | **6/8 ♪=180 and 6/8 ♩.=60 are the same music** | ✅ |
| TU-06 | A zero or negative tempo is floored rather than lasting forever | ✅ |
| TU-07 | The metronome's beat is the meter's unit, not the tempo's | ✅ |
| TU-08 | **An old bare number is read as the meter's denominator, so 6/8 stays in eighths** | ✅ |
| TU-09 | A new song is offered the unit its meter is counted in (6/8, 9/8, 12/8 → ♩.) | ✅ |
| TU-10 | Only the three offered units are accepted | ✅ |
| TU-11 | Each unit writes as its note: ♪, ♩, ♩. | ✅ |
| TU-12 | **Five bars of 6/8 last ten seconds at ♪=180 and at ♩.=60, with identical beat grids** | ✅ |
| TU-13 | Bars stay whole — 7/8 at ♩=120 is one bar of 1750ms, never a fractional bar | ✅ |
| TU-14 | The tempo bounds stay usable at both ends | ✅ |

### Fitting the chart — `fit.test.ts`

Intent: keep the longest line on one row by shrinking the type, since a wrapped line puts a chord
above the wrong word (ADR-054). The measurements are the caller's; this is the arithmetic over them.

| # | Case | Status |
|---|------|--------|
| FT-01 | A song that already fits is left at full size | ✅ |
| FT-02 | **The widest line sets the size; the roomy ones do not get a vote** | ✅ |
| FT-03 | Ratios are read against the scale already applied, so one pass lands on the answer | ✅ |
| FT-04 | It never shrinks past legibility — the line wraps instead | ✅ |
| FT-05 | Rounded down, so the widest line never lands back over the edge | ✅ |
| FT-06 | Measurements taken before there is anything to measure are ignored | ✅ |

### Account state — `account.test.ts`

Intent: one reading of the auth controller, so the header's button and the footer's line cannot
disagree about it (ADR-064).

| # | Case | Status |
|---|------|--------|
| AC-01 | The controller reads as one of four states | ✅ |
| AC-02 | "Unavailable" answers before anything else | ✅ |
| AC-03 | **The header offers the way out as well as the way in** | ✅ |
| AC-04 | Nothing is offered while there is nothing to offer | ✅ |
| AC-05 | **Signing in is worded; signing out is an icon** | ✅ |

### Library readiness — `library.test.ts`

Intent: the library must not show the device's songs while it is still finding out whether they are
the ones being asked for (ADR-062).

| # | Case | Status |
|---|------|--------|
| LB-01 | **Waits while the sign-in check is running — nobody signed in *yet* is not nobody signed in** | ✅ |
| LB-02 | Waits for a signed-in account's store to answer | ✅ |
| LB-03 | Shows the device library as soon as it is known there is no account | ✅ |

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
| SET-08 | **A count-in stored in beats converts to the nearest whole bar, rounding** | ✅ |
| SET-09 | **A count-in that was asked for never converts to none at all** | ✅ |
| SET-10 | **With nothing set, the count-in follows the song's bars per line** | ✅ |
| SET-11 | A count-in set outright wins, including none at all | ✅ |
| SET-12 | A followed count-in stays inside the offered range | ✅ |

### Service worker decisions — `pwa.test.ts`

Intent: a service worker is the one part of the app that can serve someone a stale version of
itself, indefinitely. Every judgement it makes is a pure function here, so the worker itself has no
logic a test cannot reach.

| # | Case | Status |
|---|------|--------|
| PW-01 | Every version owns its own cache | ✅ |
| PW-02 | Older versions' caches are cleared on activate | ✅ |
| PW-03 | Caches belonging to anything else are left alone | ✅ |
| PW-04 | Hashed build output is served from cache | ✅ |
| PW-05 | A page load lets the network decide, with the cache as fallback | ✅ |
| PW-06 | **Cross-origin traffic is never touched, so Firestore keeps working** | ✅ |
| PW-07 | Anything that is not a GET is passed through | ✅ |
| PW-08 | The app's other files are served then refreshed | ✅ |
| PW-09 | An unparseable url is passed through rather than throwing | ✅ |
| PW-10 | A plain successful response is worth caching | ✅ |
| PW-11 | Errors, partials and opaque responses are not | ✅ |

### Install affordance — `install.test.ts`

Intent: decide what, if anything, to offer someone who could install the app. Browsers no longer
ask on their own, and iOS never did.

| # | Case | Status |
|---|------|--------|
| IS-01 | An iPhone and an iPad are recognised | ✅ |
| IS-02 | Android and desktop are not mistaken for iOS | ✅ |
| IS-03 | A captured `beforeinstallprompt` becomes a button | ✅ |
| IS-04 | iOS is told where its own Share-menu button is | ✅ |
| IS-05 | **An app already installed is offered nothing** | ✅ |
| IS-06 | A browser that has offered nothing stays quiet | ✅ |

### Screen wake lock — `wake-lock.test.ts`

Intent: decide when to keep the screen awake. The API call itself cannot be tested in node, so the
rule is separated from it and the hook holds no judgement of its own.

| # | Case | Status |
|---|------|--------|
| WL-01 | A browser offering the API is recognised | ✅ |
| WL-02 | An older browser reports no support rather than throwing | ✅ |
| WL-03 | **The screen is held awake while a song plays** | ✅ |
| WL-04 | Nothing playing lets the screen sleep | ✅ |
| WL-05 | Nothing is requested while the page is hidden | ✅ |

### Fixture acceptance — `examples.test.ts`

Covers the "Acceptance Tests Using These Fixtures" section of `../_meta/example-songs.md`.

| # | Case | Status |
|---|------|--------|
| EX-01 | The three fixtures load with their stated keys and tempos | ✅ |
| EX-02 | Every row parses; Scarborough and Blackbird hold their verse endings (`|4|`), Rising Sun's ending is three bars then two single `{3/4}` bars | ✅ |
| EX-03 | Lyric text is intact and each chord is anchored inside it | ✅ |
| EX-04 | Relative representation matches the document (`Dm`→`1m`, `C`→`7`, etc.) | ✅ |
| EX-05 | Blackbird G→A gives A/D/E with degrees unchanged, stored rows untouched | ✅ |
| EX-06 | Each fixture has enough chords for the three levels to differ visibly | ✅ |
| EX-10 | **Rising Sun marks its sections, so level 1 thins its repeats and leaves its opening verse whole** | ✅ |
| EX-07 | Schedule runs the Rising Sun lines back to back, starts at row 1, completes cleanly | ✅ |
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
