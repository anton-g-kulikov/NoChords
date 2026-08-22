# Architecture Decisions

Decision records for NoChords. Each entry states the choice, why it was made, and what it costs.

---

## ADR-001 — Chords are stored in the song's original key

**Decision.** Every `ChordAnchor.symbol` in a row is spelled in `Song.originalKey`.
`Song.currentKey` is a *display* setting; transposition happens at render time via
`chordSymbolFor(symbol, song, mode)`.

**Why.** The PRD requires that "changing the song key should not change the Nashville
representation". If transposition rewrote the stored chords, Nashville degrees would have to be
recomputed against a moving key, and repeated transposition would accumulate enharmonic drift
(`C# → Db → C#`). Anchoring storage to one key makes Nashville a pure function of stored data and
makes transposition idempotent and lossless.

**Cost.** The editor always shows chords in the original key, even when the player is transposed.
This is surfaced in the editor UI with an explicit note rather than hidden.

---

## ADR-002 — Chord occurrences are addressed by `rowId:chordIndex`

**Decision.** A concealable "chord occurrence" is identified by its row id plus its index within
that row's `chords` array. The concealed set is a `Set<string>` of those keys, computed once when a
learning playthrough starts and held for the whole playthrough.

**Why.** The brief requires concealment to stay fixed while scrolling — recomputing per render
would make chords flicker in and out. Keying on `rowId:chordIndex` rather than on the chord *name*
means two occurrences of `G` in the same song are concealed independently, which is what
"individual chord occurrences" in the brief calls for.

**Cost.** Editing a row's chords mid-playthrough can shift those indices. Acceptable: editing
during playback is not part of the MVP flow, and the selection is regenerated at the next
playthrough.

---

## ADR-003 — Playback timing is a precomputed schedule, not a render-loop side effect

**Decision.** `buildSchedule(rows, tempo)` returns a pure array of `{ rowId, startMs, endMs }`.
The React layer only maps an elapsed-milliseconds value onto that schedule via `rowIndexAt()`.

**Why.** The brief asks that timing logic stay separate from rendering "so it can later be replaced
by real audio synchronization". With the schedule as plain data, swapping the clock source (a
`requestAnimationFrame` timer today, an audio element's `currentTime` later) touches one hook and
no pure logic. It also makes per-row pause behaviour unit-testable without a DOM.

**Cost.** Tempo changes rebuild the schedule; the current elapsed time is preserved so playback
does not jump to the start.

---

## ADR-004 — Vitest with a `node` environment, testing pure modules only

**Decision.** Tests target the pure modules under `src/lib/`. No jsdom, no React Testing Library.

**Why.** The brief calls for minimal dependencies, and every behaviour it requires to be tested —
transposition, Nashville conversion, concealment percentages, concealment stability, the learning
counter, reset, persistence, pause timing — is pure logic. Keeping that logic outside components
means the required coverage needs no DOM. Vitest reuses the existing Vite config, so it adds one
dev dependency rather than a test toolchain.

**Cost.** Component rendering is verified manually (see `../test/test-documentation.md`, "Manual
verification"). Adding jsdom + RTL later is a self-contained change.

---

## ADR-005 — `localStorage` is reached through an injectable port

**Decision.** `createSongStore(storage)` accepts any object satisfying a minimal
`StorageLike` interface (`getItem` / `setItem` / `removeItem`), defaulting to
`globalThis.localStorage` when present.

**Why.** It makes persistence testable in a `node` environment with an in-memory fake, and it is
the seam through which a future backend would be introduced — the UI talks to the store, not to
`localStorage`. The brief asks for state structures that "could later be moved to a backend without
rewriting the UI".

**Cost.** One indirection layer over a browser API. Small, and it pays for itself in ADR-004.

---

## ADR-006 — Unparseable chord text is preserved verbatim

**Decision.** `parseChord()` returns `null` for input it does not recognise, and every consumer
(`transposeChord`, `toNashville`) falls back to returning the original token unchanged.

**Why.** The brief is explicit: "When encountering an unsupported chord, preserve the original text
rather than failing." A musician's shorthand (`N.C.`, `%`, `|`) should survive a round trip through
transposition rather than being mangled or dropped.

**Cost.** Typos are silently passed through instead of flagged. Correct for the MVP — the editor is
a free-text field, not a validated one.

---

## ADR-007 — Chords are anchored to positions inside the lyric

**Decision.** A row stores `lyrics` plus `chords: ChordAnchor[]`, where each anchor is
`{ symbol, index }` and `index` is a character offset into `lyrics`. Rows are written and edited in
the inline form `[Dm]O, where are you [C]going?`, which `parseInlineRow` / `formatInlineRow`
convert to and from the stored shape.

**Supersedes.** The implementation brief sketched `chords` as a plain string alongside `lyrics`,
and explicitly allowed the schema to be adjusted. The development fixtures
(`_meta/example-songs.md`) settled it: they are written in the inline form, and their acceptance
criteria require the parser to preserve "the position associated with each chord" and require that
concealing a chord move neither its own lyric nor any later chord or lyric.

**Why.** A parallel chord string can only encode position through whitespace, which holds together
only if chords and lyrics render in the same monospace font at the same size — a real constraint on
"large chord/lyric typography". Anchoring to a character offset makes position explicit data,
survives editing the lyric around it, and lets the two lines be typeset independently. It also
makes the row a single text field to edit, which is the fastest possible song entry (UX priority 1).

**Cost.** One text field per row now carries both chords and lyrics rather than two separate
inputs. Chord symbols are typed in brackets, which is the same notation the fixtures use.

---

## ADR-008 — Row duration is measured in beats, per row

**Decision.** `SongRow.beats` holds how many beats the row occupies; `rowDurationMs` is
`(60000 / tempo) * beats + pauseSeconds * 1000`. New rows default to `DEFAULT_BEATS` (4).

**Why.** The fixtures give every row an explicit `duration` (6 beats, these being 3/4-time songs),
so a fixed bar length per row cannot represent them. Beats rather than seconds keeps the tempo
control meaningful: changing tempo rescales the song, while `pauseSeconds` stays absolute, which
is what a pause between phrases should do.

**Cost.** One more field per row in the editor. It is a plain number input and defaults sensibly.

---

## ADR-009 — Nashville degrees are relative to the key's own scale

**Decision.** `toNashville` reads the key's mode from its name (`Am`, `Dm` are minor; `C`, `G` are
major) and labels degrees against the major scale or the natural minor scale accordingly.

**Why.** The fixtures state the expected output directly: in D minor `Dm → 1m` and `C → 7`; in A
minor `Am → 1m`, `C → 3`, `D → 4`, `E → 5`. Labelling a minor song against the major scale would
render those as `b7` and `b3` — technically consistent, but not what a chart in a minor key reads
like, and not what the fixtures specify.

**Cost.** The key name now carries mode as well as pitch. Both key lists are offered in the UI.
The invariant that matters — degrees do not move when the song is transposed — is unaffected,
because mode travels with the key.

---

## ADR-010 — The whole song is edited as one text area

**Decision.** The editor is a single text area holding the entire song, one line per row. Chords are
written inline as `[Am]`; a line's length is written as `/6/`, meaning six beats. The text is the
editing buffer and rows are derived from it on every keystroke; the text area is *not* re-rendered
from the rows while typing, so nothing reformats under the cursor.

**Supersedes.** The per-row card UI of ADR-007, which kept a separate input for each row plus two
number fields. The inline chord anchors themselves are unchanged.

**Why.** The row UI cost three controls and a card per line, which on a phone meant a lot of
scrolling to enter one verse — the opposite of "extremely fast song entry" (UX priority 1). A
single text area is also what pasting a song already produces, so writing and pasting stop being
two different paths.

`/n/` cannot collide with a slash chord, because a chord's slash is inside its brackets.

**Cost.** Row ids are matched positionally when text is re-parsed, so inserting a line mid-song
shifts the ids below it. That only matters mid-playthrough for learning concealment, which is
regenerated next playthrough anyway.

---

## ADR-011 — Timing is beats only; there are no seconds

**Decision.** Every duration in a song is expressed in beats at the song tempo. `Song.beatsPerLine`
sets the default length of a line; a line may override it by writing `/n/`. There is no separate
pause field and no value anywhere denominated in seconds — holding at the end of a verse is simply
a longer line.

**Supersedes.** The PRD's "optional pause after each row, entered in seconds", and `SongRow.beats`
as a per-row editor field.

**Why.** One unit means tempo genuinely rescales the whole song: with a seconds-denominated pause,
speeding a song up left its pauses behind and the phrasing drifted. It also collapses two concepts
into one — a line's length — which is what removed the second and third input from every row.
The song-level default keeps the common case silent: the fixtures are 3/4 written two bars to a
line, so they set `beatsPerLine: 6` once instead of tagging sixteen lines.

**Cost.** A hold of an exact wall-clock length can no longer be specified, and changing tempo moves
it. That is the right trade for a tool whose whole point is playing along at a chosen tempo.

**Note on notation.** There is no established convention for per-line duration; `/n/` is this
project's own. The established lead-sheet convention is rhythm slashes, where each `/` is one beat
of the preceding chord (`| C / / / |`). That is chord-level and bar-based, and would be the natural
direction if chord-level timing is ever wanted.

---

## ADR-012 — Nashville mode renders roman numerals

**Decision.** Degrees render as roman numerals with case carrying quality: major uppercase
(`I`, `IV`, `V`), minor and diminished lowercase (`ii`, `vi`, `vii°`). The quality letter is then
dropped from the suffix, since the case already says it — `Dm` in C is `ii`, not `iim`. Remaining
suffix text follows the numeral: `G7` is `V7`, `Cmaj7` is `Imaj7`.

**Why.** Requested, and it is the notation musicians actually read. Case is what makes a numeral
chart scannable — the shape of the line tells you the quality without parsing letters.

**Cost.** `1m` was unambiguous to a non-reader; `i` versus `I` demands a little more care. The
invariant that matters is untouched: numerals are still computed from the original key, so
transposing does not move them.

---

## ADR-013 — The first chord of a line survives until full concealment

**Decision.** Learning mode never conceals the first chord of a row until the final stage, where
everything is hidden. The concealment pool at 20–80% is drawn only from the later chords in each
line.

**Why.** The first chord is what gets you into the line; losing it early means losing your place
rather than recalling a chord, which is a different and less useful kind of difficulty. Keeping it
until the last stage makes the progression a gradual removal of detail rather than of orientation.

**Cost.** The requested percentage can exceed the number of eligible chords — in a song where most
lines carry two chords, 80% of all chords is more than all the non-first ones. The selection is
capped at what is eligible, and the UI reports the concealment actually achieved rather than the
nominal stage, so the number on screen is never a lie.

---

## ADR-014 — The metronome is synthesised, and scheduled ahead of the frame loop

**Decision.** Clicks are generated with the Web Audio API — a short oscillator burst through a gain
envelope, accented on the first beat of each line — with no audio files and no new dependency.
They are scheduled by a lookahead loop: a 25ms timer queues every click falling in the next 150ms
directly on the audio clock, rather than firing one when a frame happens to land on a beat.

**Why.** `requestAnimationFrame` runs at the display's mercy: frames are late under load and pause
entirely in a background tab, which a metronome cannot tolerate — audible jitter of even 15ms is
the difference between a click and a flam. Scheduling onto `AudioContext.currentTime` puts each
click on the audio thread's own clock, which is sample-accurate and unaffected by rendering.

Synthesising the click keeps the bundle unchanged and sidesteps the decode latency of a sample.

**Cost.** The scheduler and the visual playback clock are separate timelines that must be pinned to
each other — done once at play, by converting the `performance.now()` origin into audio time. Over
a long song the two can drift by a few milliseconds; nothing in this app depends on them being
identical, since one drives sound and the other drives scrolling.

---

## ADR-015 — Count-in is negative elapsed time, not a separate mode

**Decision.** Pressing play sets the playback clock to `-countInMs`. The count-in is the stretch of
time before zero; the song proper starts when the clock crosses it.

**Why.** The alternative — a `counting-in` state alongside `playing` — puts a second state machine
next to the one that already exists, and every consumer of playback would have to learn about it.
As negative time it needs no new states at all: the schedule is untouched, `rowIndexAt` already
resolves times before the start to the first row (so the opening line is visible while you count),
and the metronome's beat indices simply run negative through the count-in.

**Cost.** "Elapsed" can be negative, which the progress readout has to clamp. Cheaper than the
state it replaces.

---

## ADR-016 — Metronome preferences are per-device, not per-song

**Decision.** Enabled, volume, and count-in length live in a separate `nochords.settings.v1` key,
loaded once and shared by every song. They are not part of `Song`.

**Why.** How loud a click should be is a property of where you are playing — headphones, a noisy
room — not of the song. Putting them in `Song` would sync a bedroom volume to a stage, and would
dirty every song record on a volume change.

**Cost.** A second persisted key. It uses the same `StorageLike` port as songs (ADR-005), so it
degrades the same way when storage is unavailable.

---

## ADR-017 — The controls collapse to a transport bar while playing

**Decision.** Key, tempo, display mode, metronome and the learning bar live in a disclosure panel
that closes when playback starts. The sticky header then holds only Play/Pause, Restart, the time,
and a `Setup` button. Pausing does *not* reopen it; the user does, whenever they want.

**Why.** On a 420px phone the full control block measured 475px tall against a 780px viewport — it
covered the chart it was there to control, leaving no complete lyric line on screen. Collapsing it
brings the header to 69px, and the visible chart from zero full rows to seven.

The split is by when a control is used, not by how important it is: key, tempo and metronome are
set *before* you play; the transport is the only thing wanted *during*. Reopening on pause was
tried and rejected — a pause is usually momentary, and having 400px of controls spring back would
shove the chart down every time.

The disclosure says only "Setup" rather than naming the current mode, because the chart already
shows it: chord names, roman numerals, or blur.

**Cost.** Changing key or mode mid-song costs one extra tap. That is the right way round, given the
alternative was not being able to read the song at all.

---

## ADR-018 — Revealing is per line, immediate, and temporary

**Decision.** In learning mode a tap on a line reveals every concealed chord on it for a few
seconds. A second tap within the double-tap window also seeks to that line. In Full and Nashville
modes a single tap still seeks, exactly as before.

**Why a whole line, not the chord tapped.** A chord is a couple of characters of 1.4rem text sitting
above a lyric; on a phone it is far below the ~44px touch target a finger can reliably hit, and a
miss would land on the lyric and do nothing. The line is the thing you can actually aim at, and it
is also the useful unit: if you have lost one chord in a line you have usually lost the phrase.

**Why immediate rather than debounced.** Distinguishing a single tap from a double tap normally
means waiting out the double-tap window before acting — 300ms of nothing after a tap, which reads
as a broken control when you need the chord *now*. Instead the first tap reveals straight away, and
a second tap within the window adds the seek. The reveal that happens on the way to a seek is
harmless, because it expires by itself.

**Why temporary.** A permanent reveal would quietly undo the concealment you are working through,
and after a few lines the chart would be back to Full mode without the counter reflecting it.
An expiring reveal is a glance at the answer, not a change of state — learning progress is never
touched.

**Cost.** Seeking in learning mode now costs two taps. That is the less common action of the two
while learning a song, so it is the one that should carry the extra cost.
