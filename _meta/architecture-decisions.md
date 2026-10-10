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

---

## ADR-019 — Numeric inputs keep their own text while being edited

**Decision.** `NumberField` holds the raw text the user is typing and commits a number only when
that text parses to an in-range value. Empty and half-typed text commit nothing. Leaving the field
restores the text to the last committed value. The field is re-synced from its prop only while it
is *not* focused.

**Why.** Binding a number input straight to a parsed number cannot represent the states a user
passes *through* while editing. Emptying the box yields `""`, and `Number("") || previous` restored
the previous value on the very keystroke that cleared it — so a value could never change its digit
count. 90 could become 9 but never 80.

It is the same problem the song text area solved in ADR-010, and it takes the same shape: the text
being typed is the state, and the parsed value is derived from it, not the other way round.

**Why commit while typing rather than on blur.** The tempo slider and the field show the same
value; waiting for blur would let them disagree, and on a phone a blur may never come. Committing
only in-range values means no intermediate nonsense is ever stored — typing `8` on the way to `80`
commits nothing, because 8 is below the minimum tempo.

**Cost.** One more component, and a focused field deliberately ignores outside changes to its
value. That is the intent: nothing should rewrite what you are in the middle of typing.

---

## ADR-020 — The store port becomes asynchronous and per-song

**Decision.** `SongStore` changes from synchronous whole-library calls to:

```ts
load(): Promise<Song[]>
saveSong(song: Song): Promise<void>
deleteSong(songId: string): Promise<void>
subscribe?(onChange: (songs: Song[]) => void): () => void
```

The local-storage store keeps its old behaviour behind this shape.

**Why async.** A network store cannot answer synchronously, and ADR-005 put this port here
precisely so a backend could arrive without rewriting the UI. Making the *local* store async too
means there is one shape rather than a branch at every call site.

**Why per song.** Saving the whole library on every change is invisible against `localStorage` but
against Firestore it is a write per song per keystroke — cost, quota, and needless contention.
Writing only the song that changed is both cheaper and a better description of what happened.

**Why an optional `subscribe`.** Live cross-device sync is the reason to have a cloud store at all,
but it is meaningless locally. Optional means the local store simply does not implement it, and the
hook treats its absence as "nothing will change underneath you".

**Cost.** The library now has a loading state it did not have before, and tests await. Both are
honest consequences of the data being somewhere else.

---

## ADR-021 — One Firestore document per song, under the owner's uid

**Decision.** Songs live at `users/{uid}/songs/{songId}`, one document each. Security rules allow
read and write only where `request.auth.uid == uid`. Firestore's offline cache is enabled.

**Why a document per song.** A single document holding the whole library would hit the 1MB limit on
a large library, and would make every edit rewrite every song. Per-song documents also let the
rules be simple: ownership is a path segment, so no document field can lie about who owns it.

**Why the rules matter more than the client.** Firestore is reached directly from the browser, so
the client is not a trust boundary — anyone can call the API with their own token. The rules are
the only thing actually enforcing that you see just your own songs, which is why they are committed
here alongside the code rather than being console state.

**Why the offline cache.** A musician's phone in a rehearsal room may have no signal. Firestore's
IndexedDB cache makes reads and writes work offline and reconcile later, which is the behaviour
this app already had locally and should not lose by moving to the cloud.

**Cost.** Last write wins, per song. Editing the same song on two devices at once can lose one
side's change. Acceptable for a personal library; real merging is out of scope.

---

## ADR-022 — Firebase is optional at runtime, and signing in offers to bring local songs

**Decision.** The app checks whether Firebase is configured and reachable. If it is not, sign-in is
simply not offered and the app runs on `localStorage` exactly as before. On a first sign-in that
finds local songs and an empty cloud library, the user is asked whether to bring them along.

**Why optional.** It keeps the app working with no configuration, in a checkout without keys, and
when the network is down — and it keeps the existing test suite meaningful, since none of it should
need a Firebase project. A missing key degrades a feature rather than breaking the app.

**Why ask about the import rather than doing it.** Silently uploading is wrong for someone signing
in on a friend's phone, and silently discarding is wrong for someone who has been using the app for
weeks. Both failure modes are bad enough, and the moment is rare enough, that a question is
justified where usually it would not be.

**Why not merge both ways.** Songs have no shared identity across devices before sign-in — two
libraries are two sets of unrelated ids, so a merge would just concatenate. The import runs only
into an empty cloud library, which is the case where concatenation is the right answer anyway.

**Cost.** A user with songs in both places must pick one; local songs stay on the device either
way, so nothing is destroyed.

---

## ADR-023 — The Firebase SDK is fetched only if someone signs in

**Decision.** Nothing in the main bundle imports the Firebase SDK. `firebase.ts` holds only the
config and lazy loaders; every SDK call goes through a dynamic `import('./firebaseClient')`, which
Rollup emits as its own chunk.

**Why.** Importing it normally took the app from 55kB gzip to 239kB — a 4.3× increase paid on every
first load, by every visitor, including the ones who never sign in. Measured after the split: the
main chunk is 55.8kB and the Firebase chunk is 183.6kB, fetched only when sign-in actually happens.

This falls out of ADR-022 rather than fighting it. Firebase is already optional at runtime, so
there is a well-defined moment when it becomes needed, and nothing before that moment requires a
single byte of it.

**A consequence worth knowing.** Vite folds `import.meta.env` constants at build time, so a build
with no `VITE_FIREBASE_API_KEY` makes `isFirebaseConfigured()` statically false and tree-shakes the
entire Firebase path away — config, chunk and all. An unconfigured build is not merely a build with
sign-in disabled; it contains no Firebase whatsoever. That is the right outcome, but it does mean
the split cannot be observed without supplying a key at build time.

**Cost.** Sign-in pays a one-off chunk fetch, and the loaders are async where direct calls would
have been synchronous. Both are invisible next to 180kB on every cold load.

---

## ADR-024 — A new library starts with the example songs, and then owns them

**Decision.** The first time the app opens on a device with an empty library, the three example
songs from `examples.ts` are written into it as ordinary songs. From that moment they are the
user's: editable, transposable, deletable, and never restored. A flag beside the library
(`nochords.examples-seeded.v1`) records that the decision was made; `firstRun.ts` holds it.

This replaces the "Add example songs" button, which put the burden on a first-time visitor to
guess that pressing it was how to see what the app does.

**Why seeded songs rather than a read-only demo.** A demo the user cannot edit teaches nothing
about the editor, and it needs its own rendering path, its own delete rules, and a second class of
song for every feature after it to handle. Real rows in the real library cost none of that, and
playing with them is the tutorial.

**Why a flag and not "is the library empty?".** Emptiness is not memory. Someone who deletes all
three has said what they want, and re-seeding on the next load would overrule them — the more
annoying bug of the two, because it repeats.

**Why only into an empty library.** An existing library belongs to someone who has already started.
Three uninvited songs would read as a sync bug, not a welcome.

**Why device-local, not per-account.** Seeding writes to the local store only, and never to
Firestore. Signing in already has a defined behaviour for a device library meeting an empty account
(ADR-022): it offers the import. A user who signs in on a fresh device is therefore offered their
examples, and declines — a question, not a surprise, and it keeps the seeding decision out of the
cloud path entirely.

**Cost.** A first-time visitor's library is not empty, so the empty-state copy in the song list is
now reached only after deleting everything. Someone who wants the examples back has to retype
them — the fixtures are in `_meta/example-songs.md`, but there is no longer a button.

---

## ADR-025 — Blank rows are structure, not time

**Decision.** A row with no chords and no lyric text beyond whitespace is a separator. It is
rendered in the chart exactly like any other line, but `buildSchedule` gives it no entry, so it
takes no time and is never the active row. `isBlankRow` is the single definition, in `playback.ts`.

**Why render them at all.** The empty line between verses is how a chart shows its shape. Strip it
and six verses become one wall of text; the reader loses the thing that tells them where they are.

**Why not play them.** A blank line is not a rest anyone wrote. Playing it holds the chart still for
a full line — in the Rising Sun fixture, five of them at 4.5s each added 22.5 seconds of silence to
a song that never asked for any. Someone who wants a real pause writes one, with `/12/` on the line
before it (ADR-011).

**Why the schedule keeps the song's row index.** Skipping rows makes the schedule shorter than the
song, so position in one is no longer position in the other. Every entry already carried `index`,
and everything downstream reads it, so the mismatch stays inside this module rather than becoming
an off-by-blank bug in each caller. The one place that had assumed the two were parallel was
`seekToRow`, which now asks `entryForRow`.

**Seeking a blank.** A tap on a separator seeks forward to the next row that plays, rather than
doing nothing. The tap was aimed at the verse it sits above, and silently ignoring it reads as a
broken control.

**Cost.** Two representations of "which row" now exist — the song's and the schedule's — and a
caller reaching into `schedule[i]` by row index would be wrong. `entryForRow` is the supported way
to cross between them.

---

## ADR-026 — A song carries a time signature, and rows are measured in bars

**Decision.** A song has a `meter` (`6/8`, `3/4`, default `4/4`). It sets how long a bar is and
where the accented click falls. A row may end with `//n` to last n bars, may still end with `/n/`
to last n raw beats, and may open with `{n/d}` to change the signature from that row onward.
`meter.ts` holds the arithmetic; `buildSchedule` resolves it; the metronome reads it back off the
schedule.

**What was wrong.** The metronome had no notion of a bar. It accented one beat per *line*, using
`beatsPerLine`, so House of the Rising Sun — six beats to a line — got a single click every six
beats and nothing in between. A 6/8 song is felt in two, and a 3/4 line of two bars wants its
second downbeat; both were silent. The old code even called its fallback "a plain 4/4 accent",
which is what it sounded like.

**Why compound meters group in three.** 6/8, 9/8 and 12/8 are dotted pulses, not one accent a bar:
6/8 is two groups of three. Accenting once a bar there is the bug restated. 3/8 is left simple —
three eighths are a single pulse, not three.

**Why bars and beats both stay.** Bars are the natural unit and what a reader counts. But a length
that does not sit on a bar line still needs saying — a solo running twenty-four beats over the same
four chords — and forcing that into bars means lying about the bar length. Beats win when a row
states both, because a raw count is someone naming a length no bar count could express.

**Why a signature per row rather than per song only.** A song that changes meter is ordinary, and a
bridge in four inside a song in six should click in four while it lasts. The tag runs until the next
one, exactly as a signature does on a stave, and it may sit on the blank line between verses where
a reader expects to find it — blank rows take no time (ADR-025) but still carry the change.

**Why the phase restarts at a change.** Accents are counted from the start of the current section,
not from beat zero. Otherwise a section whose predecessor did not divide evenly would inherit a
phase and accent the wrong beats — an off-by-a-bar that is audible and maddening.

**Why a beat stays a beat.** A beat is one unit of the denominator: an eighth in 6/8, a quarter in
3/4, with `tempo` counting those units. Nothing about existing timing moves, and songs stored
before meters existed read back as 4/4 — which is what they were played as.

**Cost.** Three fields on the schema instead of one, and `beatsPerLine` now overlaps with the
meter: a line of two bars of 3/4 can be said either way. `beatsPerLine` remains the default because
it is what an untagged line uses, but a song that tags its rows in bars will rarely touch it.

---

## ADR-027 — The count-in is measured in bars, and its first beat actually sounds

**Decision.** The count-in preference counts bars, not beats, and a bar is as long as the song's
meter says. One bar counts six in 6/8 and three in 3/4. Separately, the metronome's first scan of
a run starts from the beat boundary at or before the run began, and a click a few milliseconds late
is played immediately rather than dropped.

**Why bars.** A count-in exists to put you in the song's time before it starts. Four fixed beats
cannot do that in 6/8: the count runs out mid-bar, and the accent lands on the second click rather
than the first, because accents are counted from the downbeat backwards. Whole bars always divide
evenly into the accent pulse, so the count opens on an accent and closes on the downbeat, in every
meter, with no special casing.

**Two bugs, one report.** "It starts from the second beat" and "it ignores the meter" turned out to
be separate faults that compounded. The scheduler wakes on an interval, so its first window began
25ms after playback did and the click sitting exactly on the start fell into the gap before it —
the count-in lost its "one" and appeared to start on two. Underneath that, a four-beat count-in in
6/8 was accenting its second click. Fixing either alone would have left the count sounding wrong.

**Why play a late click rather than skip it.** The first scan of a run can never precede the run,
so the opening click is always fractionally late. Sixty milliseconds is the cutoff: below it the
click still belongs at the top of the count and playing it now is right; above it the beat belongs
to a stretch already gone by — after a seek — and playing it would flam against the next one.

**Migration is approximate, and cannot be otherwise.** Preferences saved in beats are read four
beats to the bar — the only bar length the app had when they were written. It rounds: six beats
becomes two bars, five becomes one. And a bar is now as long as the meter says, so even an exact
conversion changes the duration — one bar of 6/8 is six beats, not four.

That is the point rather than a flaw in it. A count-in in beats no longer describes a fixed length
of time, so there is nothing to preserve exactly; what carries over is the intent, that there is a
count-in and roughly how long. Nobody's setting resets, which is what the migration is for.

The one place rounding is overruled: anything above zero converts to at least one bar. One to three
beats would otherwise round to none, answering "I want a count-in" with silence — a wrong answer of
a different kind from a slightly wrong length.

**Cost.** A bar is a bigger step than a beat, so the count-in is coarser than it was: four beats of
4/4 can be asked for, three cannot. That is the trade for a count that always lands on the downbeat.
The field is labelled with the song's meter so the unit is not a guess.

**The ceiling is 24 bars**, raised from 4. Counting yourself in through a long intro, or setting up
a groove before a slow song, are both real; the limit exists to stop a typo becoming a ten-minute
wait, not to have a view about how long is sensible.

---

## ADR-028 — The app installs, works offline, and each release owns its cache

**Decision.** A web manifest, a set of icons and a service worker make NoChords installable on
Android and iOS. The worker precaches the app shell, serves it offline, and keys its cache on the
package version: `nochords-v0.2.0`. Releasing means bumping that version. All of the worker's
judgement lives in `lib/pwa.ts`, where tests can reach it.

**Why hand-rolled rather than a plugin.** `vite-plugin-pwa` and Workbox would bring a build-time
dependency and a runtime bundle to solve a problem this app states in about eighty lines. The
worker is compiled from `src/sw.ts` by a small plugin in `vite.config.ts`, which is also the only
place that knows the hashed asset names it needs to precache.

**Why the version names the cache.** A deploy changes some file names and not others. Without a
version, a cache accumulates a mixture of releases and there is no moment at which the old ones are
known to be finished with. Naming the cache after the release makes that trivial: on activate,
delete every `nochords-v*` that is not the current one. It also means a bad release can be undone
by shipping another one, rather than by asking people to clear site data.

**Why the shell only.** The precache holds the entry chunk, its styles, the icons and the manifest —
not the Firebase chunk, which is 750kB and which ADR-023 exists to keep off the first load. It
caches itself if it is ever fetched, which is to say only for people who sign in.

**Why cross-origin requests are untouched.** The worker handles same-origin GETs and nothing else.
Firestore's traffic is cross-origin: caching it would serve someone yesterday's songs, and
intercepting its stream would break sync outright. Songs already work offline through local storage
and Firestore's own cache, so the worker has no business in that path.

**Why updates wait.** A new worker does not call `skipWaiting`. It installs in the background and
takes over on the next cold start, so a deploy can never reload the page under someone in the
middle of a song. The cost is that a long-lived tab can sit on an old version until it is closed,
which is why the version is printed at the foot of the library.

**`Vary` must be ignored when matching.** Hosting sends `Vary: Origin`. A precached response is
stored against a fetch carrying no `Origin` header, while the module script and stylesheet the page
requests do carry one — so the default cache match misses, falls through to a network that is not
there, and the app loads its shell and then fails to boot. Every lookup passes `ignoreVary`. The
cache only ever holds same-origin GETs whose URL fixes their contents, so `Vary` buys nothing here.
This was found by killing the server and reloading, which is the only way it shows up.

**Cost.** Releasing now has a step that can be forgotten: ship without bumping the version and
installed apps keep the old cache under the old name. And a service worker is genuinely hard to
reason about — hence the pure module, and hence the offline test being run by hand against a dead
server rather than trusted to unit tests alone.

---

## ADR-029 — The app asks to be installed, because the browser will not

**Decision.** The library screen offers "Install app" when the browser hands over a
`beforeinstallprompt`, and on iOS says where the Share-menu item is instead. `lib/install.ts` holds
the decision; the hook only catches events.

**Why this is needed at all.** Shipping a manifest and a service worker makes an app installable,
not installed. Chrome removed its automatic banner years ago: it now fires `beforeinstallprompt` and
leaves the asking to the page, so an app that ignores the event is installable only through a menu
item most people never open. iOS fires nothing, and installing is a manual step in the Share sheet
that a page can only describe.

**Why the event is captured rather than left alone.** `preventDefault` on it keeps whatever the
browser might do out of the way and lets the page choose the moment. The event is single-use, so it
is held until the button is pressed and dropped afterwards, whichever way the choice went.

**Why the check for already-installed comes first.** A stale prompt would otherwise invite someone
to install the app they are currently running. `display-mode: standalone`, plus the older
`navigator.standalone` for iOS, is how that is known.

**Where it sits.** Next to the version at the foot of the library, not in the header. The header
already carries sign-in and New song, and a third button there would crowd the one screen that
should be a list of songs.

**Cost.** `beforeinstallprompt` is not standard and is Chromium-only, so the button appears for some
people and not others through no fault of theirs; the typed shim in the hook exists because
`lib.dom` does not describe the event.

---

## ADR-030 — Clicks are fired early by the output latency, and playback starts a beat-fraction late

**Decision.** Every metronome click is scheduled `outputLatency` seconds before its beat, and
playback begins 250ms after the press rather than instantly. The scheduler's lookahead window is
widened by the same latency so compensated clicks are still scheduled into the future.

**What was wrong.** A click scheduled at audio time T is not heard at T: it reaches the speaker at
T + the device's output latency, routinely a tenth of a second on a phone and far more over
Bluetooth. The screen has no such delay. So the count-in was heard late against its own countdown —
reported as the first click landing "between 4 and 3", which at 90bpm is about 330ms, squarely the
latency of an ordinary Android output path.

**Why the lead-in.** Compensation asks for the opening click *before* the run begins, which is
impossible if the timeline starts at the instant of the press: the click gets clamped and is heard
late by exactly the latency it was meant to lose. Starting everything a quarter of a second later
gives the scheduler that room. The delay applies to the countdown too, so the two cannot drift
apart, and 250ms before a count-in is imperceptible.

**Why the lookahead grew.** Pulling clicks earlier by the latency while scanning only 150ms ahead
would place them in their own past. The window is now `150ms + latency`, so the compensation always
has somewhere to move the click to.

**Why `outputLatency` with `baseLatency` as fallback.** `outputLatency` is what the device actually
adds and is the number that matters; `baseLatency` describes only the graph's own buffering, which
is the honest answer where a browser does not report the rest. Both are absent on some engines, and
zero then means behaving exactly as before.

**Cost.** The compensation is only as good as the number the browser reports, and Bluetooth latency
in particular is often understated — a click can still sound late on a headset that lies about
itself. Nothing here can be verified without a real device and a pair of ears; the tests cover the
arithmetic, not the hearing.

---

## ADR-031 — The import checks that it worked

**Decision.** Accepting the import writes every local song to the account, then reads the account
back and compares by id. The prompt stays until nothing is missing, saying how many did not make
it, and a flag in local storage remembers an unfinished import so a reload does not strand what is
left. `dismissImport` clears it: declining is an answer, not a failure.

**What was wrong.** Every write was wrapped in `.catch(() => {})` and the prompt was dismissed
before the first one went out. A partial import was indistinguishable from a complete one — the
question disappeared, some songs did not arrive, and nothing anywhere said so. The failure was
found by a user counting three songs on the device and one in the account.

**Why it went unnoticed for so long.** The project had no Firestore database at all. Auth is a
separate product and worked, so signing in succeeded; `persistentLocalCache` committed writes to
the browser and queued them for a server that would never accept them; and `getDocs` fell back to
that cache. The app therefore looked like it was syncing while nothing had ever left the device.
Every layer degraded gracefully, and the sum of graceful degradations was a feature that had never
worked once.

**Why reading back rather than trusting the writes.** A write that resolves has reached the local
cache, not necessarily the account — that is the whole point of an offline-capable client. Only the
account's own contents answer the question the user is actually asking, which is whether their
songs are somewhere other than this device.

**Why retrying is safe.** Each song is written under its own id, so the import is idempotent:
running it again overwrites rather than duplicating. That is what lets the offer stand until it
succeeds, and it is why the comparison is by id rather than by count.

**Why the offer returns at all.** ADR-022 offers the import only into an empty account, so that two
unrelated libraries are never concatenated. A partial import leaves the account non-empty, which
under that rule means the offer never comes back and the remaining songs have no way up. Two
narrow exceptions reopen it, and neither touches the two-device case ADR-022 was protecting:

- the flag, where this device began an import that did not finish;
- a **shared id** between the device and the account, which can only have got there from here,
  since songs are written under the id they already have. That one is retroactive: it rescues an
  import that failed before there was a flag to record it, which is exactly the case that led to
  this ADR — a device stranded with two songs and no way to offer them.

**Cost.** A device that begins an import and then goes offline for good keeps a flag nobody will
clear, so it asks again on each sign-in until dismissed. Asking twice is a far better failure than
losing songs quietly, which is what it replaces.

---

## ADR-032 — A line's length is bars, written `|n|`

**Decision.** A song's default line length is `barsPerLine`, and a line overrides it with `|n|` at
its end — four bars is `|4|`. `//n` is gone. The raw beat tag `/n/` still parses but is documented
nowhere. The editor's legend moved above the text area and speaks in the song's own numbers.

**Why bars rather than beats.** A bar is the unit the music is actually counted in, and it is the
one the metronome accents. Saying "six beats" for a line of two bars of 3/4 states the same fact in
a unit nobody counts in, and it stops meaning what it meant the moment the meter changes.

**Why pipes.** `//2` shared its slashes with the beat tag `/2/`, so the parser had to take bars
first and hope. A pipe is a bar line, which is what it marks.

**The consequence worth knowing.** A plain line's length now follows the meter it is in. Rising
Sun's closing rows are in `{3/4}`, where a bar is half of the 6/8 bar the rest of the song is in,
so they halved — and had to say `|2|` to keep the length they always had. That is the model being
honest rather than a bug: "one bar per line" means one bar, whatever a bar currently is.

**Migration.** A stored `beatsPerLine` is divided by the bar length of the song's own meter and
rounded, floor one, so a song keeps the length it had rather than the number it had. Six beats in
3/4 becomes two bars; six in 6/8, one.

**Why the marker in the player is nearly invisible.** A line that runs long says so in the margin
at a fifth of the lyric's opacity. Playing is reading lyrics; the number is for the one moment you
wonder why a line is hanging, and should cost nothing the rest of the time.

*Removed by ADR-061: "cost nothing" was not quite true — long lines ran underneath it, and the beat
strip now names the bar of the line you are on, live.*

**`/n/` is gone.** Any whole number of bars is expressible as bars, and a length that is *not*
whole bars displaces every downbeat after it — the accent phase counts from the start of the
section, so a seven-beat line in 4/4 silently moves every bar line that follows. The honest way to
write an odd bar is a meter change: `{7/8}` on that line and `{4/4}` on the next. A row that still
carries a stored beat count is read as the nearest whole bar, floor one; approximate on purpose,
since the counts being converted are precisely the ones that did not sit on a bar line.

A slashed number in a lyric is now ordinary text, which is the other half of the removal: nothing
silently eats `/12/` out of a line about a date.

**Bars per line is a playing control too.** It sits in the Play setup as well as the editor. It is
the setting you reach for while the chart is scrolling at the wrong rate, and having to leave Play
to change the rate at which Play scrolls is the wrong shape.

---

## ADR-033 — The notation guide is a page in the app, not a link out

**Decision.** A short page — beats, bars, time signatures, why 6/8 clicks twice a bar, and what each
piece of the app's notation means — reachable from the foot of the library and from the editor's
legend ("What is a bar?"). No external links.

**Why in the app.** It is installable and works offline (ADR-028). Someone practising on a train
with no signal is exactly the person who wonders what `{3/4}` does, and sending them to the web is
sending them nowhere. It also costs nothing: it is prose in the bundle, and the shell is precached.

**Why it teaches the app and the theory together.** The two are not separable here. "Bars per line"
means nothing without bars, and a definition of a bar that never mentions the click the user just
heard is a worse definition. Each concept is followed by where it shows up on screen.

**Why it is short.** Someone opens it because a word in the editor meant nothing to them and they
want to get back to the song. Six sections, one screen of reading. It is not a theory chapter, and
the moment it grows into one it stops being read.

**Two entry points, deliberately.** The editor legend is where the question arises — a term you are
about to type. The library footer is for browsing before there is a song to write. Neither is a menu
item, because the app has no menu and does not need one for two links.

**Cost.** It is prose, so nothing tests it: the claims about compound meter and the accent pattern
are true of the code today and could drift from it silently. They are written to match `meter.ts`,
and the fixtures are the examples it cites, which is the closest thing to a check it has.

---

## ADR-034 — Transposing steps; the meter is shown but not offered; the setup is grouped

**Three decisions about the Play controls, which had grown by accretion.**

**Transposing is a stepper, not a list.** `[−] Am [+]`, moving a semitone at a time and keeping the
mode. A list of keys invites picking A when the song is in Am, which is not a transposition but a
change of mode — the chords cannot survive it, and the app would have to either refuse or silently
produce nonsense. Minus and plus can only move by a semitone, so the question is never asked. The
label carries the distance from the original (`Key (+2)`), which is the number a capo needs.

**The meter is shown while playing, and cannot be changed there.** It decides what a bar is, so
changing it re-times every line of the song at once — a thing to do while writing, not while
playing. But it has to be *visible*, because "bars per line" and "count-in (bars)" both mean
nothing without it. Read-only is the honest middle.

**The setup is three groups: Display, Timing, Metronome.** It was one row of eight controls in the
order they were written, and two of the labels had grown parentheticals ("bars per line (of 6/8)")
to explain units the row could not otherwise convey. With the meter shown once in Timing, those
parentheticals go. Three questions, three groups, one heading each.

**Also.** The Play tempo slider went from 40–200 to 40–300, matching the editor. In a compound
meter the tempo counts eighths, so a 6/8 song at a natural pulse sits well above 200 — the slider
could not reach the tempo the editor could set, which made Play the worse place to adjust it.

**Cost.** The setup panel is taller than the row it replaces, so it covers more of the chart while
open. That is survivable because it collapses during playback (ADR-017), which is when the chart
matters.

---

## ADR-035 — The transport is a fixed bottom bar, and the screen stays awake while playing

**Decision.** Play, Restart and the elapsed time sit in a bar fixed to the bottom of the screen. The
setup panel opens upward out of it as a sheet, capped at 60vh. While a song plays, the app holds a
screen wake lock.

**Why the bottom.** It is where a native player puts its transport and where a thumb already is on a
phone. Pinned to the top it was reachable, but reaching for it meant crossing the whole screen, and
every native music app has trained the opposite expectation.

**Why fixed rather than sticky.** Sticky is bounded by its parent's box, so a transport that must
stay put for the whole scroll has to be fixed. That also decouples it from the panel: before this,
the pinned element was the *whole* controls block, which with the setup open was 409px of a 720px
viewport — most of a phone, permanently. Now the pinned part is 69px, and the panel hangs off it.

**Why the sheet is capped.** Opened on a phone the full panel is taller than the screen. Capping it
at 60vh with its own scroll leaves a line or two of chart visible, which is enough to keep your
place. A control panel that hides the thing it controls has lost the plot.

**Why the bar never wraps.** At 375px the four items came within three pixels of the width and the
time ellipsised to "2:…", which reads as broken rather than as tight. `nowrap` plus tighter spacing
below 430px fits them properly.

**Why the wake lock is tied to playback.** A chart you are reading from is a page you never touch,
so the phone dims and locks it mid-verse. The Screen Wake Lock API exists for this; it needs HTTPS,
which the installed app always is. It is held only while playing and only while visible: over a
paused song it is a flat battery, and while hidden the browser takes it back anyway — which is why
it is requested again on `visibilitychange` rather than assumed to survive.

**Failure is silent by design.** An unsupported browser, a refusal under battery saver, or a lock
the system reclaims are all normal. Each leaves the app exactly as it was before the feature
existed, which is a screen that dims — annoying, not broken.

**Cost.** A fixed bar overlays the chart's last lines; the sheet already reserves 60vh of bottom
padding, so nothing is unreachable. And the wake lock is the one feature here whose behaviour
cannot be verified from this machine — it needs a phone that dims.

---

## ADR-036 — Settings pin to the top, the transport to the bottom

**Decision.** The Play screen has two pinned strips with two different jobs. Settings — display mode,
key, timing, metronome — open from a strip at the top. Play, Restart and the elapsed time sit in the
bar at the bottom. The disclosure moved out of the transport, which now holds only transport.

**Why split them.** They are used at different moments and by different hands. The transport is
touched constantly and mid-song, so it belongs under a thumb (ADR-035). Settings are touched between
runs, deliberately, and often with the phone held up to read from — putting them under the same
thumb made the bottom bar a menu with a Play button in it. This is the arrangement every native
player has arrived at: transport below, everything else above.

**Why the settings strip is pinned rather than in the page header.** The app header scrolls away,
and a chart is long. Pinned, the panel opens from wherever you are in the song rather than only from
the top of it. It is `sticky` rather than `fixed` because its parent spans the whole chart, which
gets the same result without taking the strip out of the flow.

**Why the panel opens downward again.** It hung upward out of the bottom bar in ADR-035, which was
right while the disclosure lived there. Anchored to a strip at the top, down is the direction that
does not cover the thing you just tapped.

**Cost.** Two pinned strips take about 126px of vertical space between them, which on a phone is
real. The alternative was one strip holding both jobs, which is what this replaces.

**Later: two groups, not three.** The metronome moved up into the first row, which is now Playback
— mode, key, metronome, volume, count-in — with Timing below it. Three groups meant three headings
and three rows for eleven controls, and on a phone the panel needed its own scrollbar to show them.
Two rows fit without one. The toggle gained a "Metronome" label of its own, because "On" alone says
nothing once it sits between a key stepper and a volume slider.

---

## ADR-037 — The app is a fixed shell, not a scrolling document

**Decision.** `#root` is a column exactly `100dvh` tall with `overflow: hidden`. Each screen is a
head, a middle that scrolls itself, and — in Play — the transport as the last row. Nothing uses
`position: fixed` any more.

**What was wrong.** The transport was `position: fixed; bottom: 0`, which is correct on paper and
worked in every browser here. On the reporter's phone it did not: the bar was invisible until you
scrolled most of a screen, whether the settings panel was open or not.

*Corrected later:* this was written as an iOS problem. The phone was **Android**, and the mechanism
is well documented there — Chrome positions `fixed` against the layout viewport, which keeps the
height it has with the toolbar hidden, so a bar at `bottom: 0` sits below the visible area until
scrolling collapses the toolbar. Diagnosed here as "not reproducible, cause unknown" because the
platform was assumed rather than asked.

**Why not chase the bug directly.** A fix aimed at a mechanism I could not see would have been a
guess, and a guess I could not verify. The shell removes the dependency instead: a flex row at the bottom of a
viewport-height column cannot be mispositioned by anything, because nothing is positioning it.

**Why `dvh`.** `vh` on a phone is the viewport with the browser chrome *ignored*, which is exactly
the extra height that hides a bottom bar. `dvh` is the height you can actually see.

**Why every screen, not just Play.** One structure is easier to hold than two, and the library and
guide get the same benefit: their heads stay put and their content scrolls under them.

**It is also the shape of the native app.** A header, a scrolling middle and a bottom bar is what an
Expo shell would be built from, so this is a step towards that rather than away from it.

**Cost.** The document no longer scrolls, so anything expecting page scroll has to be inside a
`.screen__scroll`. A screen that forgets is a screen that cannot be scrolled at all — a loud
failure, at least, rather than a quiet one.

---

## ADR-038 — The title is edited where it is read

**Decision.** The song title is typed into the heading at the top of the screen, not into a Title
field in the editor's meta row. The field is gone. In Play the heading is plain text.

**Why.** The title was already displayed in the header, so the editor's field was a second copy of
the same fact, further down the page, with the real one in view above it. Editing in place removes
the copy and the question of which one is authoritative.

**Why it looks like a heading rather than a field.** It carries the heading's own type and no chrome
until you reach for it: a border on hover, a background and an accent border on focus. A page that
announces "this is a form" at the top is a page that reads as a form.

**Why only while editing.** In Play a stray tap on the title should do nothing at all. That mode
exists to be read from with an instrument in your hands, and a title that can be typed into by
accident is a title that will be.

**Cost.** The affordance is quieter than a labelled field — you have to notice the hover, or try it.
Against that, the thing you would type into is the thing you are looking at, which is the whole
point of editing in place.

---

## ADR-039 — Settings are grouped by how long a change lasts, and tempo is one control

**Two findings from comparing the Play and Edit surfaces.**

**Three lifetimes looked identical.** The Play panel's first row held a display mode forgotten on
the way out of the song, a key saved to that song, and a metronome, volume and count-in saved for
*every song on the device* — in one row, in identical fields, with nothing to distinguish them.
Changing the count-in for one difficult song changed it for all of them, silently.

The panel is now grouped by lifetime rather than by kind: **Chords** (this session), **This song**,
and **This device — every song**. The heading is the whole mechanism: it costs a line and answers
the only question the controls could not.

This undoes part of the compaction that put the metronome beside mode and key. That change was
right about the layout — three headings for eleven controls was wasteful — and wrong about which
controls belong together, because it grouped by size rather than by consequence.

**Tempo was two controls over two ranges.** A number field in Edit, 20–300; a slider in Play,
40–300. A song written at 30bpm met a slider that started at 40: it showed the tempo pinned at the
minimum and moved it on the first drag. Both are now the same number field over
`MIN_TEMPO`–`MAX_TEMPO`, so neither mode can express a value the other cannot. The slider went with
it: a tempo is a number you know or nudge by one, and dragging a 280-pixel track to land on 92 is
worse at that than two taps on a stepper.

**The asymmetry is resolved by subtraction.** Meter was editable in Edit and read-only in Play
while bars per line was editable in both, which the ADR-034 justification could not support. Bars
per line has now left Play entirely: how many bars a line holds is a property of how the song is
written down, decided once while transcribing, not something reached for while playing it. Play
keeps key, tempo and the meter it shows but cannot change.

**Cost.** The panel is three rows again rather than two. On a phone that is most of the gain from
the previous change given back — for a heading that says whether a setting follows the song or the
device, which is worth more than the line it costs.

---

## ADR-040 — The chord mode sits in the pinned strip, not the transport

**Decision.** Full / Nashville / Learning moved out of the settings panel and into the pinned strip
beside the Settings button. The heading it used to sit under is gone with it; the panel is now
*This song* and *This device*.

**Why it left the panel.** It is the one control reached for mid-song — switching to Learning at the
top of a verse, or back to Full when lost — and the panel closes when playback starts (ADR-017).
Changing what the chart shows meant reopening a panel that covers the chart.

**Why not the transport, which was the other candidate.** Two reasons. The bottom bar was already
within a few pixels of overflowing at 375px — the elapsed time had to be tightened to stop it
ellipsising — and a three-way control is another 220. And Learning has consequences: it conceals
chords and counts playthroughs. A thumb reaching for Play should not be able to land on it.

**Why the strip was the right home.** It was one button in 57px of otherwise empty space, it is
pinned so it survives scrolling, and it stays visible while playing — which is exactly when the
control is wanted. Verified with a song running: panel collapsed, modes still there.

**It also renames itself.** "View" named the surface rather than the subject; every option answers
one question, which is what the chords look like.

**Cost.** At 375px the strip needs 347 of 335 pixels, so the segments give up a little horizontal
padding below 430px rather than the row wrapping to two lines. That is the second control this
release to be tightened for a phone, which suggests the next one added will not fit.

---

## ADR-041 — Two rows of settings fit a phone, by sizing fields to what they hold

**Decision.** Every field in the Play panel is now as wide as its contents rather than a uniform
130px: 96px for a three-digit tempo, 72px for a meter, 130px where a label needs it. The metronome
toggle and its volume became icons. Both rows fit 375px on one line each, and the panel came down
from about 340px to 236.

**Why it did not fit before.** `field--narrow` set every field to 130px whatever it held, so a row
of three came to 430px in a 335px column and wrapped — a meter of two characters taking exactly as
much room as a key stepper. The metronome row missed by a single pixel.

**Why icons for the metronome and not the count-in.** The first two say what they are by their
shape: a slider beside a speaker is a volume, and a toggle that turns accent-coloured is on. A
count-in has no such shape, and "1" without a label says nothing at all — so it keeps its words and
the width they need.

**Faders, not a cog, for settings.** A cog says "configure the system". These are values to set
while you play.

**What was predicted and then happened.** ADR-040 noted that the phone header was full and the next
control added would not fit, and that the honest fix was icons rather than another few pixels of
padding. Two controls later, that is what this is. The tightening in ADR-040 was reverted: the icon
freed more room than it did.

**Cost.** Two controls now depend on being recognised rather than read, and one of them — the
metronome triangle — is a shape people know from the object rather than from software. It has a
`title` and an `aria-label`, which is not the same as being obvious.

---

## ADR-042 — The metronome opens on its own, from its own button

**Decision.** The pinned strip carries two disclosures side by side: a metronome and a set of
faders. Each opens its own section, independently — the metronome's settings can be open while the
song's are shut, and either can be open alone.

**Why separate.** They are reached for at different moments. The song's key and tempo are set once
when you sit down; the metronome is switched on and off, and its count-in adjusted, between
attempts at a passage. Making one panel serve both meant opening four controls to reach one.

**Why the metronome button carries two signals.** Its border says whether its panel is open; its
colour says whether the metronome is running. Those are different questions and both get asked —
"is the click on?" is answerable at a glance from the strip, without opening anything.

*Both signals stand, and are now drawn far enough apart to be read at a glance: a blue icon means
the beat is being heard, a filled blue button with the icon reversed out of it means the panel is
open. They were briefly reduced to one on the grounds that the beat strip carries the sound switch
already — but a signal you have to hunt for and a signal you cannot miss are not the same thing, and
"is the click on?" is worth answering from the strip of buttons. The settings button takes the same
filled treatment for its own panel.*

**Why the toggle inside says only On or Off.** The section heading says "Metronome"; repeating it on
the button was the compromise that a shared row forced (ADR-038), and the section removes the need.

**Cost, and a limit reached.** Two icons put the strip 10px over the 335 a phone gives it, so the
mode segments give their padding back — the third control tightened for a phone in three ADRs, and
the last that can be. The strip is now full: modes, two icons, no slack. Anything further needs
something to leave, not another few pixels.

---

## ADR-043 — Editing is a pencil you press, not one of two tabs

**Decision.** The `Edit | Play` segmented control in the song header is a single pencil button.
Pressing it enters editing; pressing it again returns to playing. It takes the accent colour while
editing, and its label alternates between "Edit song" and "Done editing".

**Why.** The two were never equal places. Play is where a song is used and where it opens (ADR-024);
editing is something you enter, do, and leave. A tab pair says "two halves of one thing" and spends
the width to say it — on a phone that width was pushing the title onto two lines.

**Why a pencil.** It is the one editing icon that needs no explanation, and it matches the strip
below it, which is now icons throughout.

**Why the state is on the button rather than in a label.** The editor is unmistakable when you are
in it — fields, a text area, an editable title. The button only has to say that pressing it again
gets you out, which the accent colour and the alternating label do.

**Cost.** A first-time visitor sees a pencil rather than the word "Edit". Against that, the header
now fits a long title on one line, which is what a phone actually shows.

---

## ADR-044 — The mode buttons show the mode, and the strip is five equal buttons

**Decision.** The three chord modes no longer say "Full", "Nashville", "Learning". They show what
each one does: the current key (`C#m`), the first chord as a numeral (`i`), and a brain. All five
buttons in the strip — three modes, two disclosures — share one width, sized to hold a
four-character minor key.

**Why labels that demonstrate.** "Nashville" names a system; `i` shows you what you will be reading.
The key label doubles as a readout, so the strip says which key the chart is in without opening
anything. And they are far shorter than the words, which is what made room for two disclosures on a
phone.

**Why one width for all five.** Their contents differ wildly — three characters, one character,
three different icons — and boxes that resize as the key changes read as broken rather than as
compact. Fixed at 52px, with the segments' padding cut so that five of them still fit the 335px a
phone gives the strip. The two disclosures get 12px between them and 44px of height, having been
squeezed against each other before.

**Icons come from Lucide.** `Metronome`, `Brain`, `SlidersVertical` and `Pencil`, imported as
components. Four hand-drawn attempts at a brain produced a circle with a line through it: legible
icons at 20px are a craft, and the repository is not the place to practise it. It costs a runtime
dependency and about 1kB gzipped for the four, tree-shaken.

**Cost.** The strip is now four icons and two glyphs with no words at all. Every one carries a
`title` and an `aria-label`, which is not the same as being self-evident — a first-time visitor has
to try them. Against that, they fit, and the mode buttons in particular teach by showing.

---

## ADR-045 — The header is a title bar and a title, and the strip's boxes are stated outright

**Decision.** The song header is two rows: back, the app's name centred, and the pencil — then the
song title on a row of its own. Every button in the settings strip has its width *and* height set
explicitly, with the platform's own button metrics turned off.

**Why the title gets its own row.** It shared a row with two controls, so a long title — "Lament For
The Fishermans Wife" — wrapped to two lines *between* them, and the row's height moved with the
length of the name. A title is the one thing on the screen whose length cannot be predicted, so it
gets the row that is allowed to grow.

**Why the app's name is there at all.** Installed, there is no browser chrome and no address bar:
nothing on the screen said which app this was. The middle of a title bar is where that belongs, and
the row had the space once the title left it.

**Why the boxes are stated rather than derived.** They were `min-height` plus padding, which came
out identical in Chrome on a desktop and visibly unequal on the phone, where the platform adds a
button's own metrics on top of whatever you ask for. Width, height, zero padding and `appearance: none` leave nothing for a
platform to add. Measured equal at 52×44 across all five.

**Cost.** A fixed box cannot grow for a longer label, so it is sized for the widest thing it will
hold — a four-character minor key. A five-character one would clip rather than expand, which is the
trade for boxes that do not move as you transpose.

---

## ADR-046 — The settings panel pushes the song down rather than covering it

**Decision.** The panel is in the normal flow, below the strip, instead of absolutely positioned
over the chart. Opening it moves the song down; closing it moves the song back. The 60vh cap and
its own scrollbar are gone with the overlay.

**Why.** Overlaid, it covered the line you were reading the moment you opened it — and on a phone it
covered most of them, which is why it needed a height cap and an inner scrollbar in the first place.
Those were both treatments for a problem that only existed because it floated. In the flow the chart
simply moves: 124px down when the panel opens, back up when it closes.

**What it costs.** Opening settings reflows the chart, so the line you were on moves. That is a
visible change rather than a hidden one, and it is undone by closing the panel — where an overlay
hid a line and gave no clue what it had covered.

**A loose end this creates.** The strip above it is still `sticky` while the panel is not, so
scrolling now slides the panel up under a toggle that stays put. The stickiness exists so the chord
modes stay reachable while the chart scrolls during playback (ADR-040), which is a real need; but
the two behaviours no longer agree, and that is worth resolving rather than leaving.

*Resolved by ADR-060: the panel joined the strip in the pinned header, so a button and the panel it
opens now behave the same way. The push-the-song-down behaviour survives where it was the point —
at the top of a song, opening a panel still moves the chart rather than hiding a line.*

---

## ADR-047 — The count-in is on screen before it counts

**Decision.** The count-in box appears as soon as the metronome is on and a count-in is set, showing
how many beats it will count. It lights up and counts down while counting, and returns to waiting
afterwards. It is no longer conditional on playing.

**Why.** It is a box in the flow, about a hundred pixels tall. Rendered only while counting, it
appeared at the downbeat and vanished at the first line — moving the chart down and then up again
in the two seconds you are least able to follow it, and least able to look away from it.

**Why it shows beats rather than bars.** The countdown counts beats, so the number waiting is the
number it will start from: 6 for a bar of 6/8, not 1. The label carries the bars — "count-in · 1 bar
of 6/8" — which is the setting, in the meter it is measured in.

**Why the colour changes.** Waiting it is muted with a plain border; counting it takes the accent.
That distinguishes a readout from a live count without moving anything, which is the whole point.

**Why `countingIn` still shows it regardless.** A count-in runs even with the metronome off — the
delay is silent, but it happens. The box stays conditional on `countingIn || (metronome on)` so that
case keeps its countdown rather than losing it to a tidier rule.

**Cost.** A hundred pixels of chart, permanently, for anyone who plays with the metronome on. The
count-in setting is right above it, so anyone who does not want the reminder can set it to zero and
have both back.

---

## ADR-048 — The transport is Play, the time, then restart

**Decision.** Play takes 40% of the bar and keeps its word beside a `ListMinus`; the elapsed time
fills the middle; restart is a `ListRestart` icon at the far end. The row spans the full width.

**Why Play keeps its label when everything else lost one.** It is the control pressed most, pressed
without looking, and pressed with an instrument in the other hand. It is also the only one whose
meaning changes — Play, Pause, Play again — which an icon alone cannot carry.

**Why restart is furthest away.** It is the one control here that undoes something: pressed by
mistake mid-song it costs you your place. Putting it at the opposite end from Play means a thumb
aiming for Play cannot reach it, which matters more than the symmetry of matching sizes.

**Why 40%.** Large enough to hit without looking on a phone, small enough that the time and restart
keep the rest of the bar.

**Cost.** Restart is now an icon like the others, so the same argument that keeps Play's word — "the
one you press without looking" — is what says restart does not need one. If it turns out to be
reached for as often as Play, it should get its word back.

---

## ADR-049 — The song text area grows; the screen scrolls

**Decision.** The editor's text area has no scrollbar of its own. It is resized to its content on
every change, and the screen's scroll area does the scrolling.

**Why.** At `min-height: 60vh` with its own overflow it swallowed the drag: a finger on the song
scrolled the song *inside the box*, never the page. So the fields above it never left the screen —
which read as a sticky panel — and the bottom of the editor could not be reached at all, because
reaching it required scrolling the container the text area had captured.

**Why growing rather than filling the screen.** Filling it would keep the fields pinned, which is
the thing being complained about. Growing means one scroller for the whole screen: drag anywhere,
the fields scroll away, and the song has the full height when you are deep in it.

**Cost.** A long song makes a very tall element, and the browser lays all of it out. At the size a
song is that is free; a text file would not be.

---

## ADR-050 — The shell is pinned to the viewport, not measured in viewport units

**Decision.** `#root` is `position: fixed; inset: 0` rather than `height: 100dvh`, `html`/`body` are
`overflow: hidden` with `overscroll-behavior: none`, and the viewport meta carries
`viewport-fit=cover`.

**Why.** `100dvh` was close but not exact. On Android Chrome the layout viewport keeps the height it
has with the toolbar hidden, while the visible area shrinks when the toolbar comes back — so a
column measured against the tall one puts its last row below what you can see. Opening a panel is
exactly the kind of interaction that brings the toolbar back, which is why it read as "the panel
pushes the transport away".

`svh` is the height with the toolbar showing, the smallest it gets, so the bottom row is always on
screen. The cost is a strip of unused space when the toolbar hides; in the installed app, where
there is no toolbar, all three units are equal and it costs nothing.

**Why not `position: fixed`.** It was the first fix tried and it is the wrong one here: `fixed`
resolves against the layout viewport, the tall one, which is the mechanism behind the original
vanishing transport (ADR-037). It would have reintroduced the bug it was meant to fix.

**Why `viewport-fit=cover` and `interactive-widget=resizes-content`.** The first makes
`env(safe-area-inset-*)` non-zero, so the padding the transport carries to clear the gesture bar
stops resolving to zero. The second makes the on-screen keyboard shrink the layout instead of
covering the editor.

**A pattern, and a correction.** Three layout bugs in a row were attributed to iOS in these notes.
The phone was Android throughout. The symptoms were real and reported accurately; the platform was
assumed from screenshots and never asked, and two of the three fixes were reasoned from the wrong
engine's behaviour. They happened to be right anyway — the shell in ADR-037 removes the dependency
on any of it — but the reasoning recorded for them was not.

**Cost.** Nothing scrolls the document any more, so any screen that wants scrolling must say so.
That is already true of every screen here (ADR-037), and it fails loudly rather than quietly.

---

## ADR-051 — The browser sizes the text area where it can

**Decision.** `.editor__text` carries `field-sizing: content`, so the browser grows the box to its
content with no script involved. The JavaScript measurement from ADR-049 stays as a fallback and
runs only where `field-sizing` is unsupported, clearing any height it had set.

**Why.** Measuring a text area means collapsing it to `auto` first, reading `scrollHeight`, then
setting the height back. Reported symptom: pasting made the view jump to the top of the song.
Collapsing the box is the obvious suspect — while it is short the page is briefly shorter than its
own scroll position — and `field-sizing` removes that step entirely rather than compensating for it.

**Said plainly: this is not a confirmed fix.** The jump does not reproduce on a desktop. I set the
scroll position to 900, collapsed the box by hand, and the position held; so the mechanism I first
patched around was not demonstrated, only assumed. What is demonstrated is that the browser now
sizes the box without collapsing it, which removes the suspected cause instead of correcting for it.

**Support.** `field-sizing` is Chrome 123+, which covers the phone this was reported from. Elsewhere
the fallback behaves as before, now with the scroll position preserved across the measurement —
belt and braces for a mechanism neither of us has seen.

**Cost.** Two code paths for one behaviour until support is universal, and the one that runs here is
not the one that runs on the reporter's phone. That is the wrong way round for testing, and it is
why this ADR says "suspected" rather than "fixed".


---

## ADR-052 — A tempo is a note and a number

**Decision.** `Song.tempo` keeps its number and gains `Song.tempoUnit`, one of `eighth`, `quarter`
or `dottedQuarter`. All timing runs through `lib/tempo.ts`, which converts by way of quarter notes:
a bar is `numerator × (4 / denominator)` quarters, a tempo beat is worth 0.5, 1 or 1.5 of them, and
one bar's length falls out of the two. `rowDurationMs` multiplies bars by that; nothing else in the
app divides 60000 by anything.

**Why.** A bare BPM is ambiguous the moment the meter is compound. "6/8 at 180" means eighths to one
musician and the dotted-quarter pulse to another, and the two differ by a factor of three — the
whole song at a third of the speed, which is not a subtle wrongness. Two fields say what one number
could not.

**Migration reads the old number as the meter's denominator, not as the conventional pulse.** A song
stored without a unit gets `eighth` in 6/8 and `quarter` in 3/4, because that is what the old engine
actually did: it counted the meter's own denominator at the given BPM. The conventional reading
would have been dotted-quarter for 6/8, and would have played every existing 6/8 song three times
too fast. Preserving how a song sounded beats migrating it to the tidier number.

**Consequences for meter changes.** A `{3/4}` section inside a 6/8 song used to keep the same beat
*length* — the beat quietly became a quarter without becoming any longer, so the section played at
triple speed in note terms and nobody could see why. With the unit pinned, a quarter is now two
eighths wherever it appears, and the section is a real hemiola. This is a behaviour change, not a
refactor: the Rising Sun fixture's closing `{3/4}` rows drop from `|2|` to `|1|` to keep the length
they had. Any song of the user's own with an inline change to a different denominator will play
those sections differently — correctly, but differently.

**The metronome now reads the schedule.** Its click times used to come from one beat length for the
whole song, which was consistent only because a beat was 60000/tempo everywhere. Now that a beat's
length depends on the meter running at the time, `beatsInWindow` walks the schedule and takes each
beat's time from the row it belongs to. The count-in runs on the opening row's beat.

**Changing the meter never rewrites the unit.** The default is chosen once — when a song is created,
or when an old one is migrated — and after that it is the writer's. There is no way to tell "chose
♩ deliberately" from "left it at ♩", so the only safe rule is not to touch it. A new song in 6/8 is
offered `♩.`; one migrated into 6/8 keeps `♪`.

**Cost.** Two fields where there was one, in every fixture, document and stored song. The unit
selector also costs a control in the player's setup row, which is already tight — it is 60px wide
and holds three glyphs.

---

## ADR-053 — The count-in shows the bar, not a number

**Decision.** The count-in is one bar of dots, sized by where the accent falls, filling left to
right as the clicks sound and starting again each bar; the label counts the bars down beside it
(`3/3 bars of 6/8`, then `2/3`). While it counts it carries the playing marker, which moves to the
first lyric line on the downbeat. Once spent it drops to half strength in place, and stays there
when playing is paused. Its height went from about 90px to 33px.

*Revised in v0.13.0: the first version drew every beat of the count and faded to nothing.*

**Why a bar and not a number.** A number counting 4-3-2-1 tells you how many beats are left, which
is not the thing you are waiting for — you are waiting for the downbeat, and in 6/8 you are also
waiting to feel where the two pulses fall. The dots say both at once: six of them, the first and
fourth larger, is a picture of the bar you are about to play. The accents come from `accentAt`, the
same function the metronome clicks on, so what is drawn cannot drift from what is heard.

**Why one bar cycling rather than the whole count.** A count-in runs to 24 bars (ADR-046), which is
288 dots at 12/8 — and even four bars of four is a row nobody counts at a glance. One bar is a shape
you can read; how many bars are left is a number, and the label is where numbers belong. Between
them they say more than any length of dotted line.

**Why it takes the marker until a line is sung.** Nothing is being sung yet, so marking the first
lyric line as current is a small lie — it says "here" before "here" is true. That holds from the
moment a song is opened, not only once counting starts: a song sitting at the top has a count-in
ahead of it, and the strip is what goes first. It hands the marker over at exactly the moment the
words start.

**Why fade rather than reset.** It used to show the full count again the moment playing began — a
four that had just finished counting down to one, reading as though it were about to start over. It
keeps its space, because that is the whole point of ADR-047: removing it would move every line at
the exact moment playing starts.

**Half strength, not invisible, and it stays that way through a pause.** The bars and the meter are
worth a glance mid-song, and a block that vanishes entirely is a block you cannot check. "Spent" is
now a fact about the song's position rather than about whether it happens to be playing — pausing
in the middle of a verse used to bring the full count back, which read as though pressing play again
would count you in from the top. It would not.

**Why smaller.** It was the largest thing on the playing screen and it matters for two seconds. The
chart it sits above is the thing being read.

**Cost.** A bar of 12/8 is still twelve dots, which is at the edge of what reads as a count rather
than a dotted line — but it is now the worst case rather than the starting point. And the count no
longer shows its own length as a picture: how long you have to wait is something you read rather
than see.

---

## ADR-054 — The chart shrinks to fit its longest line

**Decision.** The playing screen measures every line and sets one type scale for the whole song, so
the longest line fits on one row. `lib/fit.ts` does the arithmetic, `hooks/useFitScale.ts` takes the
measurements. It never goes below 0.62 of full size; past that the line wraps as before.

**Why.** A wrapped line puts a chord above the wrong word. The whole chord-over-lyric layout exists
so that a chord's position comes from the lyric beneath it (ADR-007), and wrapping breaks exactly
that. Smaller type is the lesser loss.

**One scale for the song, not one per line.** Per-line scaling would fit every line perfectly and
make the chart a ransom note. The longest line sets the size and the rest follow it.

**Measured by summing segments.** A line that has already wrapped reports the width of its box, not
of its text, so reading the line's own width would measure the symptom. Summing the segment boxes
gives the width the line wants, wrapped or not.

**The scale is read back off the element, never remembered.** A measurement only means something
next to the size it was taken at. A remembered value can be a step ahead of the DOM — an observer
firing twice before a paint is enough — and then every ratio is normalised against a size that is
not on screen and the chart hunts between two sizes. It was doing exactly that, pinned at 1 on a
375px screen where the widest line needed 0.74. What the element reports is by definition what was
measured.

**Cost.** Type size now depends on content, so two songs sit at different sizes and one long line
shrinks the whole song. Neither is free, and both beat a chord over the wrong syllable. The
measuring is also invisible to the test suite: `fitScale` is unit-tested, but whether a resize is
noticed at all depends on `ResizeObserver` delivery, which a hidden tab never performs — that part
was verified by hand at three widths, not by a test.

---

## ADR-055 — Lines already sung recede

**Decision.** Rows before the playing line drop to half strength.

**Why.** The chart is a page you are reading forward through, and on a phone most of what is on
screen is behind you. Dimming it makes the front of the song the part that is lit, so the eye lands
on the line being sung and the ones about to come without having to search for the marker.

**Half, not hidden.** Glancing back at the line you have just come off is one of the most ordinary
things to do while playing — you missed a word, or you want to see the chord you have just left.
Half strength stays readable; hiding would not.

**Cost.** Two levels of dimming now mean two different things on the same screen — a played line and
a spent count-in are both at half strength, and neither is a concealed chord, which is blurred
rather than dimmed (ADR-007). Three visual languages for three kinds of "not the thing you are
looking at" is one more than is comfortable.

---

## ADR-056 — The start URL is a different path from the file it serves

**Decision.** `firebase.json` carries a `Cache-Control: no-cache` rule for `/` as well as for
`/index.html`, and the service worker fetches navigations with `cache: 'reload'`.

**Why.** Reported symptom: the installed app kept showing v0.12.0 after v0.13.0 was deployed and
verified live, however many times it was fully closed and reopened.

The header rules match on **request path**, not on the file that ends up being served. The app's
`start_url` is `/`; the `**` rewrite serves `index.html` for it; and the rule written for
`/index.html` never applied to it. So the two paths carried different headers for byte-identical
content:

```
/            → cache-control: max-age=3600
/index.html  → cache-control: no-cache
```

An hour of HTTP caching on the one path the app actually opens. The worker's navigation strategy is
network-first, but a plain `fetch` reads the HTTP cache on its way out, so "the network" handed back
the same stale HTML — which names the old hashed bundle, which is cached `immutable` and so loads
instantly and correctly. Every layer did its job and the result was an app pinned to a release it
had already replaced.

**Why both fixes.** The header is the cause and fixes it for every client immediately, including
those running old workers. The `cache: 'reload'` makes the worker's own intent true rather than
dependent on hosting configuration, and would have made this a non-event. It only takes effect from
the release *after* the one that ships it, since the worker that serves a navigation is the one
already installed — which is precisely why the server-side half is not optional.

**What this cost.** Three releases were verified as live and correct at the origin while the phone
was still on an older one, and `curl` could not have caught it: curl has no HTTP cache. The check
that would have caught it is reading `Cache-Control` on the URL the app actually opens, which is now
in the release checklist.

**Not fixed here: the worker still waits.** A new version does not call `skipWaiting`, so it takes
over on a cold start rather than swapping under someone mid-song (ADR-028). That remains right, and
it is now nearly invisible: with fresh HTML a cold start loads the new bundle immediately whichever
worker is in control. The stale caches that pile up until a worker finally activates are the
remaining visible trace.

---

## ADR-057 — A song is written in chords; numerals are for playing

**Decision.** The editor writes chord names in the song's original key, and only chord names. Roman
numerals stay what they have always been: a display mode in the player (ADR-012), derived from the
stored chords and never a way of entering them. There is no notation toggle in the editor.

**Why this is recorded rather than simply not built.** It *was* built — a toggle beside the key that
switched the whole song text between `[Am]` and `[i]`, an inverse conversion, and machinery to stop
the round trip from respelling chords. It worked. It was tested and rejected, and a thing that was
tried and turned down is worth more written down than a thing that was never tried: the next person
to think "the editor should take numerals too" should know it has been to the keyboard already.

**What one notation buys.** The editor's text is the song (ADR-010) — what you typed is what is
stored, with no layer in between. A second notation makes that only conditionally true: the text
means one thing in one mode and something else in the other, and the same characters read against a
different key are a different song. Every question about the editor gains a "which mode were you
in?" clause.

**The specific sharp edges, since they are the reason to stay away.** A numeral cannot remember its
enharmonic: `F#` and `Gb` are one numeral, so converting back has to be told what the song already
says or it respells chords the writer never touched. And because numerals are read against the key,
changing the key while they are showing has to re-read the whole buffer — miss that and the next
keystroke reinterprets every numeral against the new key and rewrites the entire chart. Both were
solved. Both were solvable only by adding memory to a conversion that ought to be pure, which is the
shape of a feature pushing against the grain of the design.

**What this does not close off.** Numerals in the player are untouched and are the point of the
Nashville mode: read a chart in degrees while you play it. The prohibition is on *writing* them.

**Cost.** Someone who thinks in degrees has to write a key's worth of chord names to get a chart in,
and transposing a written song still means the player's stepper rather than a rewrite. That is the
price of the chart being one unambiguous thing.

---

## ADR-058 — Learning runs in three levels, and the first one teaches

**Decision.** Learning has three levels instead of six evenly-spaced percentages:

| Level | Music you have not played yet | Music that repeats | Opening chord of a line |
|---|---|---|---|
| 1 | nothing concealed | 15% | kept |
| 2 | 50% | 50% | kept |
| 3 | 80% | 80% | concealed like any other |

They still advance on their own with each completed playthrough, and now a control sets one
outright. Choosing a level writes the same playthrough count the progression uses, so picking one is
choosing where the automatic advance carries on from rather than a mode running beside it.

**Why the first level is not "0%".** The old first stage concealed nothing anywhere, which taught
nothing: the chart was simply a chart. Reading the changes once and then playing them from memory
with the page still in front of you is what actually commits a song, so the first verse and chorus
stay whole and only their repeats start to thin. The level teaches by the song's own structure
rather than by a stopwatch.

**A section is what sits between blank lines.** Blank rows are structure rather than music
(ADR-025), which makes them the only thing in a song that says where a verse ends. A section repeats
when its chords, in order, match a section already played — so verse 2 is a repeat of verse 1 even
though the words differ, which is exactly the sense in which you have played it before.

**The cost of that, stated plainly: a song written as one block gets nothing at level 1.** Two of
the three fixtures are written without blank lines, so they have one section, nothing repeats, and
the first level leaves them entirely visible until level 2 picks them up. That is the honest
behaviour — the app cannot see a verse boundary that was never written — but it means the first
level does nothing for a song that does not mark its sections.

**Each section is drawn from separately.** A share then means the same thing everywhere in the song
instead of landing wherever the shuffle happened to put it, and the seed moves with the section so
two identical verses do not blur in the same places.

**What did not change.** Concealment is still a pure function of `(rows, playthrough, seed)`, fixed
for a whole playthrough so nothing flickers while the song scrolls (ADR-002). Tapping a line still
reveals it without touching progress (ADR-018) — that is what makes a level something you can lean
on rather than fight.

**Cost.** Levels 2 and 3 are blunter than the old ladder: the jump from 50% to 80% used to be two
steps with 60% and 70% in between. Three levels that mean something beat six that only counted.

---

## ADR-059 — The beat is shown whether or not it is heard

**Decision.** The count-in strip becomes a beat strip: below both settings sections and pinned under
the buttons once they scroll away, running for the whole song rather than only the count, and
carrying the switch for its own sound. It reads left to right as meter, beats, bars — what the bar
is, where the beat is in it, and where that bar sits in the line — with the sound switch at the end. Seeing the beat
and hearing it are separated:

| | Sound on | Sound off |
|---|---|---|
| Count-in | counted, and clicked | counted, in silence |
| Song | dots move, and it clicks | dots move |

The metronome's own settings — tempo, volume, count-in length — sit together in the panel its button
in the top row opens (ADR-042 stands), and the count-in defaults to the song's bars per line.

**Everything on it reports the meter actually running.** A `{3/4}` line inside a 6/8 song says
`3/4`, draws three dots and accents one of them, because a strip that said `6/8` beside three dots
would be contradicting itself in the one place a reader looks to resolve exactly that (ADR-026).

**The bar counter runs through the song, not only the count.** Counting down through the count-in
(`4 bars left`, `3 bars left`) and up through the line (`bar 1/3`, `bar 2/3`), because each
direction is the one its moment asks for: a count-in is a wait, and what is left is the question; a
line is being played, and how far in you are is the question. Before a note is played the slot shows
the count-in's length instead, since there is no line to be in yet.

**Neither is a bare fraction, and that is the point.** `4/4` written beside `6/8` on the same strip
reads as a second time signature — in the one place on screen whose job is to say what the meter is.
A word carries the number out of that reading: `4 bars left`, `bar 2/3`.

**One dot at a time.** The lit dot travels rather than the row filling up behind it. A filled row
answers "how far into the bar am I", which is a thing you read; a single lit dot answers "where is
the beat now", which is a thing you see. The second is what a musician glancing up mid-line is
asking, and the bar counter beside it already answers the first. (Supersedes the filling described
in ADR-053, for the count-in as well as the song — one language for both.)

**Why the dots are not a metronome readout.** Reported while playing along: you want to see where
the beat is without a click going the whole time, and you want counting in either way. Those are two
wants, and one switch was answering both. The dots are now a picture of the beat — the same reading
the clicks come from, via `pulseAt` over the schedule, so the screen and the room cannot disagree —
and the switch decides only whether it is also audible.

**Why it is pinned, and where.** It scrolled away at the first line, which is exactly when you start
needing it, so it sticks directly beneath the buttons — at an offset measured from them rather than
assumed, since they wrap to a second row on a narrow screen. In the flow it sits *after* both
settings sections, because that is where a readout of the controls belongs; the two orders are the
same one while playing, when the panels shut themselves anyway.

**Why the switch is on the strip, and speaks of volume.** It governs the strip, so it lives on it,
and it is drawn as a speaker rather than a metronome: the question it answers is whether the beat is
*heard*, since it is on screen either way. The metronome button in the top row still opens the
metronome's settings, which is a different job — one control for the sound, one for the numbers
behind it.

**Why the count-in follows the song.** A count-in is a rehearsal of the thing about to start, so a
line's worth of bars is the length that tells you most — two bars of 3/4 for a song written two bars
to a line. It stays adjustable, and **Auto** is a real value rather than an empty field, because it
changes with the song. A stored count of one bar is read as Auto: there is no telling a deliberate 1
from the 1 everyone was given, and Auto is what that default was reaching for.

**What this supersedes, plainly.**
- ADR-047 — the strip no longer appears only when the metronome is on; it is always there, because
  it is no longer only a count-in.
- ADR-053's spent state — there is nothing to fade to, since the strip keeps working once the count
  is over. The half-strength "counted, and done with" state is gone.

**Cost.** Tempo now sits in a section beside two per-device settings, which blurs the grouping
ADR-039 drew between what belongs to the song and what belongs to the device — the price of putting
a metronome's controls where a musician looks for them. And the pinned header is taller: on a phone
the buttons and the strip together take about 110px before the chart begins.

---

## ADR-060 — What you set travels with the buttons

**Decision.** The settings and metronome panels move inside the pinned header, along with the beat
strip. The header is now the whole apparatus — buttons, whichever panel is open, and the pulse — and
the chart is the only thing that scrolls.

**Why.** Reported from practice: three verses into a song you want the key a semitone down, or the
tempo back a notch. The button was pinned and reachable, but the panel it opened was at the top of
the page, so reaching a control meant scrolling away from the line you were on and then finding it
again. A button that follows you and a panel that does not is half a solution.

**This closes the loose end ADR-046 left open,** in so many words: a toggle that stays put over a
panel that slides away was named there as something that ought to be resolved rather than left. It
is resolved by moving the panel rather than by unpinning the button, because the button's stickiness
is load-bearing (ADR-040).

**What survives of ADR-046.** At the top of a song, opening a panel still pushes the chart down
rather than floating over it — a sticky element occupies its space in the flow like any other. Only
once you have scrolled past it does the header start covering the chart, which is exactly the case
where covering is the point: you are looking at the control, not at the line beneath it.

**Cost, measured.** With both panels open on a 375×812 phone the header is 429px and leaves 165px of
chart — two lines. That is the extreme case (each panel is a tap from closed, and both close
themselves when you press Play), but it is real: open everything at once and the song is mostly
gone. The alternative was reaching controls by scrolling, which is what this replaces.

---

## ADR-061 — The chart claims the gutter

**Decision.** The bar-count note leaves the chart's right margin and becomes a small raised numeral
after the line's last word, and the chart's own padding drops from 16px to 8px with the sheet pulled
8px into the screen's gutter on each side. On a 375px phone a line has 335px to work with instead of
303px.

**Why, and what it was not.** Reported as "the bars column takes screen space and forces the text
smaller". The first half is the part worth acting on; the second is not what was happening. The note
was absolutely positioned, so it took no width at all — measured, a line was 303px whether or not
its row had one. What it did do was collide: at that width the longest line already ran to 338px,
underneath the note.

**So the note went, and the width came from where it actually was.** The type scale is set by the
longest line (ADR-054), which makes every pixel of horizontal padding a smaller word on every line.
Two gutters of 16px and a screen gutter of 20px were spending 72px of a 375px screen on whitespace.
Trimming to 8px and 12px measured out at 0.74 → 0.83 scale: 14.8px type to 16.6px, twelve per cent,
on the same phone with the same song.

**Only the chart reaches out.** The screen's gutter is unchanged for every other page; the sheet
takes a negative margin rather than the app losing its margins, because this argument only holds
where width is being converted into type size.

**Why the note moved inside the line rather than going away.** Its cost was never width; it was that
it floated, so the words could run under it. Written as part of the line, it is part of what the type
scale is fitted to (ADR-054) — a thing that cannot be overlapped because the fit has already made
room for it. It costs a few pixels on the rows that have one, and the longest line in a song is
rarely one of them: on Rising Sun the scale is 0.83 with the numeral and 0.83 without.

A bare numeral rather than "4 bars", because the word was three quarters of the width and said what
a number after a line of music already says. The full text is on its `title` for anyone who wants
it.

**A meter change is marked the same way, at the other end of the line.** A `{3/4}` line drew nothing
at all: the change arrived under you mid-song, with the beat strip switching to three dots at the
moment it happened and no warning before it. It is now a small `3/4` before the line's first chord —
before, because that is where a score puts a signature and because a mark read after the bar it
governs is read too late — and on the chord line rather than the lyric one, since a meter governs
the harmony. Same weight, same scaling, same reason for living inside the line: the fit has made
room for it.

**A measurement bug this exposed.** With 32 more pixels the fit landed exactly on the boundary and
two lines wrapped anyway. The cause was `offsetWidth`, which rounds to whole pixels: summed over a
dozen segments the rounding underestimates a line by a few pixels, so the scale computes as fitting
and the line wraps regardless. Rounding the scale down (ADR-054) cannot save that, because the error
is in the measurement rather than the arithmetic. Segments are now measured with
`getBoundingClientRect()`, which is fractional; the tightest line clears by 3px instead of 0.

---

## ADR-062 — The library waits until it knows whose songs it is showing

**Decision.** Nothing is loaded until the account is known. `isAwaitingAccount` says when that is:
while the sign-in check is running, and — once signed in — until the account's store has answered.
The screen shows one body at a time, so a list is never rendered over a question that has not been
settled.

**Why.** Reported symptom: opening the app flashed the device's songs before the account's arrived.
The cause was two silent fallbacks in a row. The library takes a `uid`, and while the sign-in check
was still running that `uid` was `null` — indistinguishable from signed out — so the device library
loaded and rendered. Then the account resolved, and the store itself is fetched on demand (ADR-023),
so there was a second window in which `cloudStore` was still null and the device library was again
the fallback. Two guesses, each reasonable alone, and the list was replaced twice on screen.

**A side effect worth naming.** That path also seeded the three example songs into the device's
storage for someone who had been signed in the whole time (ADR-024 seeds when a local library loads
empty). They then sat there as local songs, with an import offer eventually asking whether to upload
them. Waiting removes that too.

**Why a pure function for three booleans.** Because the rule is the fix. Written inline it is three
terms in an effect nobody re-reads; named and tested, it says what the screen is waiting for, and
the tests distinguish "no account" from "no answer yet" — the exact confusion that caused this.

**Cost.** A device with no account waits for the sign-in check before showing anything it already
has on disk. Measured on a configured build that is 34ms of "Loading your songs…" before the list,
which is the honest price of not showing the wrong list first.

---

## ADR-063 — The row is the card, and deleting is an editing action

**Decision.** A song in the library is one card with nothing beside it, and deleting moved out of
the list into the editor, under the song it deletes.

**Why.** The delete button sat in its own column on every row, permanently, for an action taken
once in a song's life — and it took width from the thing you actually read, the title. Deleting is
something you do to a song you are working on, which is what the editor is for.

**Why at the end of the editor.** Past the song text rather than up with the fields: the last thing
on the screen, behind a confirm, is the right amount of friction for the one action here that cannot
be undone. Deleting the song you are editing hands back the library rather than leaving an editor
with no song in it.

**Cost.** Clearing out several songs is now several trips through the editor instead of a column of
crosses. That is the trade: the common case (reading a list of songs) gets the width, and the rare
destructive case gets the extra steps.

---

## ADR-064 — One header row, and the account at the foot

**Decision.** The library is four parts down the screen: a header row of the app's name and **Sign
in**; **New song** at full width below it; the list; and a footer pinned to the bottom carrying the
sync line and the build number. The sync line says what signing in gets you rather than what not
signing in costs.

**Why.** The screen opened with three stacked bands: a status strip ("Songs are saved on this device
only"), the app's name at heading size, and a row of two buttons. That is 415px of an 812px phone
spent before the first song, on a screen whose entire job is a list of songs. The app's own name was
the loudest thing on it, and a rarely-used sign-in sat at the same weight as the one action people
came for.

**The mark is the icon file, not a copy of it.** The header shows `public/icons/icon.svg` — the
same drawing the installed app icons are generated from — rather than an inline copy of its paths.
A logo that exists twice is a logo that changes once. Beside it the name carries 1.6rem at 650 and
the mark 40px, which leads the row rather than matching it — at equal heights the name still read as
the smaller thing, because a button carries padding and a border and a word does not. It takes a
larger type size to weigh the same, and a little more than that to lead.

**Why New song gets its own width.** It is the one thing this screen is for. Sharing a row with
sign-in made the two look like a pair of equal options, which they are not: one is done constantly
and one is done once per device.

**Why the sync line belongs after the songs.** The moment you wonder whether these songs exist
anywhere else is the moment you have finished reading them — not before you have seen one. Put at
the top it was an announcement; put at the foot it is an answer to a question you might now have.
Signing in itself stays in the header, where you look when you arrive on a new device.

**Why the footer is pinned.** It holds the bottom of the screen rather than trailing the last song,
so a three-song library does not leave it stranded halfway up. No fixed positioning: the shell is
already a flex column with one scrolling middle (ADR-037), so a footer outside the scroller is
pinned by construction.

**Why the wording flipped.** "Songs are saved on this device only" states a limitation and offers
nothing; "Sign in to sync across devices" states the same fact as the thing you can do about it.
When Firebase is not configured the line disappears entirely rather than reverting to the
limitation, because there is then no offer to make (ADR-022).

**What went with it.** `storedIn` was the library's way of telling that band which sentence to
print. Nothing reads it now, so it is gone rather than left as an unused field on the hook.

**The header carries the action both ways; the footer only ever states a fact.** Signed in, the
header button signs you out — it does not disappear, leaving the only way out buried in a footer
link, which is what shipped in v0.17.0. The footer is helper text with no action in it at all.

The two are not the same kind of button. Signing in is an invitation and needs its words; signing
out is a utility whose shape is already known, so it is an icon, and a word for it would weigh as
much as the app's own name beside it.

Both read from one `accountState`, because this is the second time the two surfaces disagreed about
the same four-way question and inline conditions in two files is how that happens.

---

## ADR-065 — The beat is a synthesised shaker

**Decision.** The metronome plays one of three voices, chosen in its settings: a **shaker** (default)
of bandpass-filtered noise, a **woodblock** of a falling pitch, and a **beep** for a loud room. Each
is a pair of strokes described as parameters in `lib/metronomeVoice.ts` — the hook builds the audio
graph from the table and holds no opinion about how anything sounds. No samples.

**Every voice accents by weight, never by becoming another instrument.** Louder, and no more than a
fifth up. That rule is a test, and it caught the `beep` voice on the way in: it had been carried
over verbatim from the sound this replaces, keeping the near-octave that made the strong beat read
as a second instrument. Offering that as a choice would have been shipping the fault as a feature.

**Why not the square wave it replaces.** A square at 900Hz is the cheap-beeper timbre — all odd
harmonics, none of them decaying — and it announced itself over anything played with it. Worse, the
accent was 1600Hz against 900Hz, most of an octave, so the strong beat read as a *second
instrument* rather than as a harder stroke of the first.

**Why a shaker can be synthesised where a woodblock cannot.** A shaker is almost entirely noise.
There are no inharmonic partials to model, only a band of hiss and an envelope, which is exactly
what a filter and a gain node are. A bell or a block would need its partials placed by hand and
would still sound like a synthesiser pretending.

**Why not samples.** They would buy a specific recorded character, and cost the offline story: the
files would have to be precached, decoded before the first stroke on a path that is carefully
latency-compensated (ADR-030), and carry a licence to track. "Nothing to download" is worth more
here than one particular shaker.

**Tuned by measurement, since the author cannot hear it.** Rendered offline and measured: the first
attempt sounded — on paper — like a tick, because an exponential ramp to 0.0001 drops under hearing
at about half its nominal length, so a 0.08s decay was 36ms of audible stroke. The decays are set
from the *measured* audible tail (65ms strong, 49ms weak), the attack from the measured peak (5-6ms,
a swish rather than a snap), and the band from where a shaker under a slow ballad should sit.

**A different slice of noise each stroke,** because two shakes of a real shaker are never the same
sample twice, and a metronome repeating one identical burst is how a loop starts to sound like a
machine.

**Cost.** Every parameter here is a judgement made by measurement rather than by listening, and
"pleasant" is not a thing a spectrum tells you. The table is named and separate so that "brighter",
"longer" or "softer" is a one-number change rather than a redesign — and with three voices there are
three times as many numbers set by a method that cannot hear their result.

---

## ADR-066 — The metronome opens its own audio clock, and calls itself music

**Decision.** Two changes, both for iOS. The audio context is created and resumed inside the tap
that asks for sound — the Play button, and the beat strip's sound switch — rather than in the effect
that follows it. And `navigator.audioSession.type` is set to `playback` where the browser has one.

**Reported symptom.** No metronome on an iPhone with the app installed to the home screen.

**Why the gesture matters.** Safari starts an audio context only while the page has user activation,
and a React effect runs *after* the handler that scheduled it has returned — by which time the
gesture is over. The comment in the old code said "play() is that gesture", and it was wrong about
when the code ran. Chrome treats one gesture as unlocking the page for the rest of its life, which
is why this was fine on an Android for months and silent on the first iPhone. A frame of silence is
pushed through the graph during the tap as well: iOS counts a context as open once something has
actually played on it, and `resume()` alone does not always qualify.

**Why the session category matters.** Safari plays Web Audio as *ambient* sound by default, and
ambient is precisely what the ring/silent switch silences. A metronome someone pressed play on is
not a notification chirp, so it declares itself `playback` and keeps sounding with the switch
flipped, the way a music app does.

**The cost of saying `playback`, plainly.** It is not a mixing category: declaring it can interrupt
audio from another app. Someone practising against a backing track in another player may find this
takes the output. The alternative, `ambient`, mixes politely and is muted by the silent switch —
there is no category that does both, and for a metronome the switch matters more.

**Untested where it matters.** Neither half of this can be verified from here: there is no iPhone in
this loop, and no amount of unit testing distinguishes "the context opened" from "the phone was on
silent". The session call is tested as a branch (AS-01..03); the gesture ordering is an argument
from Safari's documented rule, not an observation.

---

## ADR-067 — Light and dark, and the device decides unless told otherwise

**Decision.** A third device preference, `theme`: `system`, `light` or `dark`, defaulting to
`system`. The stylesheet carries both schemes under one set of token names; `data-theme` on the root
element overrides `prefers-color-scheme`, and its absence lets the device decide. A three-icon
switch sits in the library's footer beside the version line.

**Why "system" sets nothing.** If the app resolved the device's scheme in JavaScript and wrote it on
the root, following a change at dusk would need a `matchMedia` listener, and getting it wrong would
pin the page to whatever the device said at load. Leaving the attribute off means the media query
answers, live, with no code at all. The two `theme-color` tags follow the same rule: one per scheme,
each behind its own media query, both repainted only when a choice is fixed.

**Why a script in `index.html`.** The setting lives in local storage and React reads it after the
first paint. Someone who chose dark on a phone set to light would see the page flash white on every
cold start. Eight lines before the stylesheet put the attribute on first; the hook only follows
changes after that. The script repeats the two colours rather than importing them, and a test
reads `index.html` to keep them in step (TH-05).

**Why three icons rather than one that cycles.** A cycling button hides where it goes next, and
"system" is the one state a sun or a moon cannot show on its own.

**Why the footer.** It is a preference you set once per device, like signing in, and it sits with
the other things that belong to the device rather than to a song. The player has no switch: a
chart on a music stand follows the device, and the device already knows when the room went dark.

**Cost.** The dark token block is written twice — once under the media query, once under the
attribute — because a selector cannot be both. `light-dark()` would collapse them, and leaves any
iPhone on iOS 17.4 or earlier with no colours at all.

---

## ADR-068 — Ink, paper, and one second ink

**Decision.** The app is designed as a printed songbook rather than as a generic dark web app:

- **Two colours, the way a songbook is printed.** Ink for everything, and one second ink —
  vermilion on warm paper in light, tungsten amber on warm charcoal in dark — used *only* for the
  music: chords, the key, the beat, the line being played. Controls are drawn in ink, and the
  button that matters most is solid ink rather than coloured.
- **Two typefaces.** Literata, a reading serif, for everything that belongs to the song — titles,
  lyrics, numerals, the key. Instrument Sans for everything that operates it, and for chords, set
  slightly narrow and heavy as a lead sheet sets them. Both are bundled through Fontsource.
- **Chords typeset, not just printed.** The root at full size, the quality and bass smaller beside
  it, and real ♯ and ♭ (`chordParts`, CT-01..06). Numerals are set in the serif.
- **Ruled, not boxed.** The library is a contents page — title, a line of detail, and the key where
  the page number would be — with hairlines between entries instead of a card per song.
- **Texture, faintly.** A few percent of grain over the whole page, and warm neutrals throughout:
  no pure black, white or blue-grey anywhere.

**Why one second colour, and only for the music.** On a music stand the eye has one job: find the
harmony. When the accent also marked buttons, toggles and links, a busy setup panel competed with
the chart for it. Restricting the colour to the music makes the chart the only coloured thing on
most screens, and makes Play — solid ink — the heaviest thing in the transport by weight rather
than by hue. The dark scheme is warm rather than blue-black because a blue-black screen on a stand
reads as a laptop, and an amber chord is easier on dark-adapted eyes than a cyan one.

**Why a serif for the words.** Lyrics are read in lines, at a distance, mid-song: that is the
problem a book face was drawn for. Literata was designed for long-form reading on screens, has
optical sizes (the large chart gets the tighter display cut automatically), and covers Cyrillic
and Greek — songs are not all in English, and a lyric falling back to another font mid-line would
look broken. Instrument Sans does not cover Cyrillic, which is why it is kept to the interface,
whose words are the app's own.

**Why chords are no longer monospaced.** Each chord is placed by the lyric under it (ADR-007), never
by column, so a fixed pitch bought nothing and cost width: a narrow proportional face lets the chord
line run a step larger on a phone. The editor's text area stays monospaced, because there the
brackets *are* aligned by column.

**Why roman numerals are in the serif.** In a sans, `III` is three vertical strokes — the same
shape as a bar line or a pipe. Serifs give each `I` its feet.

**Why bundled fonts.** A font service is a network request, and the app has to look like itself on
a stage with no signal (ADR-028). The Latin cut of each face is precached with the shell; other
scripts are fetched by `unicode-range` the first time a song needs them and cached then.

**Cost.**
- About 280 kB of fonts in the precache, on top of a shell of about 70 kB gzipped. Paid once per
  release, and not on every visit.
- ♯ and ♭ are not in either face, so they come from the system's symbol font. They look right on
  Apple devices and in Noto; on an unusual system they could look heavier than the letters.
- Chord widths changed, so a chart may fit at a slightly different scale than before (ADR-054) —
  the fit measures rendered text, so it adjusts itself, but a song that only just fitted may not.
- The grain is an overlay on top of the content, which keeps the pinned bars from showing as flat
  bands but also grains the text by a few percent. At this strength it reads as paper; much
  stronger and it would read as dirt.
- The app icon was recoloured to match, but the landing page in `site/` still carries the old
  palette.

---

## ADR-069 — A button that is on wears what the current line wears

**Decision.** Supersedes one rule of ADR-068. Selected and primary controls — the chord-mode
buttons, the open panel toggles, editing, Play, New song — are no longer filled with solid ink.
They take the current line's treatment instead: a wash of the second ink behind them, and their
edge and label in that ink. Everything else in ADR-068 stands.

**Why.** On a device, solid ink did not read as "on". A black block on paper, and a near-white
block on the dark scheme, were the highest-contrast things on the screen: they read as holes in the
page and outweighed the chart they sat above. A solid fill of the accent was tried next and was
still the brightest thing there. The wash is already the app's mark for "this one, now" — it is
how the line being played is shown — so a button that is on now says it in the same voice, and the
chart stays the loudest thing on the screen.

**Cost.** Play is no longer the heaviest thing in the transport by weight; it is told apart by its
word, its size and its colour instead. And the second ink is no longer only for the music: an
active button and a chord now share it, though one is an outlined box at the edge and the other is
type inside the chart.

---

## ADR-070 — The header's mark takes the page's colours; the drawing is still one

**Decision.** Amends ADR-064. The library header draws the quaver inline, on a tile washed in the
second ink with an edge and a note in that ink — the same treatment as a button that is on
(ADR-069). The installed icons keep their solid ink tile and amber note. The shapes live once in
`lib/mark.ts`, and a test reads the three icon SVGs and fails unless each carries exactly those
shapes (MK-01).

**Why.** Once the active buttons moved from solid ink to a wash, the icon's solid tile was the
darkest thing in the header and the one object on the page drawn in someone else's colours. An
`<img>` cannot take the scheme's tokens, so the mark could not follow the page into dark or light.
A home screen is a different surface — an icon there needs a solid ground of its own — so only the
header changes.

**What happens to ADR-064's rule.** "A logo that exists twice is a logo that changes once" still
holds, but the guarantee moved from the file system to the test suite: there are now two copies of
the geometry, and changing either one alone fails MK-01 instead of drifting silently.

**Cost.** The header mark and the home-screen icon no longer look identical — same note, different
ground. They are recognisably one mark, the way a logo printed in one colour and the same logo on
its solid badge are.

---

## ADR-071 — The footer is three rows, and the account line is gone

**Decision.** Amends ADR-064 and ADR-067. The library's footer is three centred rows, one kind of
thing each: the links (the notation guide, and installing where the platform allows it), the
appearance switch, and the version. The account line — "Sign in to sync across devices" signed
out, "Syncing to …" signed in — is removed, along with its component.

**Why.** The footer had grown into two rows of mixed things: a sentence about the account, then a
line holding a link, a version number, an install offer and a three-icon control side by side,
which wrapped unpredictably on a phone. Sorting it by kind gives each row one job, and puts the
version last and smallest, where something you look up rather than read belongs.

The account line was the weakest of them. Signed in, it named the account the header's sign-out
button already belongs to; signed out, it explained a "Sign in" button sitting at the top of the
same screen. ADR-064 put it there as helper text, and the helper turned out to be read once and
then only taken up space.

**Cost.** Nothing on screen now says *which* account is signed in. Someone with two Google accounts
has to sign out to find out. If that turns out to matter, the place for it is the sign-out button's
label or a menu behind it — not a sentence at the foot of the library.

---

## ADR-072 — Tapping the mark changes the second ink

**Decision.** An easter egg. The mark in the library header is a button: each tap steps the second
ink to the next of seven — vermilion, ochre, moss, teal, indigo, plum, rose, one for each mode from
Ionian to Locrian — and round again. The choice is a per-device setting, `accent`, applied before
first paint by the same script as the theme (ADR-067). The note gives a small struck animation on
each tap, and none under `prefers-reduced-motion`.

**How the colours change.** Each ink is two RGB triplets, one for paper and one for the night
background. The stylesheet's scheme blocks take `--accent-rgb` from `--ink-light` or `--ink-dark`
and derive every wash, rule and chord colour from it, so one attribute on the root re-inks the whole
app — and the seven inks cost one short rule each rather than seven copies of every token. Vermilion
has no rule at all: its triplets are the fallbacks, so a page with no attribute is a page in
vermilion, exactly as before this existed.

**Why each ink is tested for contrast.** The second ink is the colour of every chord. A pretty ink
that reads at 3:1 would make the chart worse for anyone who picked it, and nobody choosing a colour
by tapping a logo would know to blame it. Every light ink must reach 4.5:1 on paper and on the
lighter sheet, every dark one on the night background and its sheet (AC-03); the table and the
stylesheet are held to each other (AC-04).

**Why the mark, and why no menu.** It is the one thing in the app with no job, and it is already
drawn in the ink it would change, so the change shows where you tapped. A setting with a menu would
be a feature to explain and support; this is a discovery, and the README mentions it in one line.

**Cost.** Chords and the accent are now one colour in every ink but the default, where the chord
keeps its slightly deeper shade. The home-screen icon stays amber whatever the ink, because an
installed icon cannot follow a setting. And the button is labelled for screen readers — "Ink:
Vermilion. Tap for the next one." — which makes the egg a little less hidden for those users, on
purpose: an unlabelled button is worse than a spoiled surprise.

---

## ADR-073 — The fit listens to width only, and the chart has no optical sizes

**Decision.** Three changes to the chart's fit (ADR-054), for one bug:

- `.sheet` sets `font-optical-sizing: none`.
- The fit's `ResizeObserver` re-measures only when the chart's *width* changes.
- The fit re-measures when a web font finishes loading (`document.fonts`).

**Reported symptom.** On an iPhone, a song's chart sat empty with its scrollbar growing and
shrinking continuously: the page height never settled.

**Why it looped.** `fitScale` lands on its answer in one step because text width is proportional to
type size — measure once at any scale and the ratio says where to go. Literata, added in ADR-068,
has an optical-size axis, and the browser applies it automatically: smaller sizes are drawn wider
and looser than a scaled-down large size. Measured in Chrome, a line's width per unit of scale grew
by 0.3% between scale 1 and 0.62; with optical sizing off it was constant to a tenth of a pixel.
That small error was enough for the fit to step between two neighbouring scales instead of
settling. On its own that would have stopped after four passes. But each new scale changed the
chart's height, the observer saw a resize and reset the pass count, and the fit measured again —
forever. The observer had always answered height changes; they were harmless while widths were
proportional.

**Why fix all three.** Turning optical sizing off removes the cause. Ignoring height closes the loop,
so the next non-proportional thing — a font, a ligature, a rounding quirk on some engine — cannot
reopen it. And the height loop had been quietly doing one useful job: when the web font arrived and
the text changed width, the height changed too and the chart refitted. Listening to font loads
does that job on purpose.

**Cost.** Lyrics in the chart lose Literata's display cut at large sizes: they are drawn from the
text cut scaled up, slightly wider and lower in contrast than titles of the same size. Titles and
the library keep optical sizing. FT-07 holds the chart to this, because nothing else would notice
the property being removed until a phone started hunting again.

---

## ADR-074 — The mark is an empty pair of brackets, leaning; the name stands upright

**Decision.** The quaver is replaced by `[ ]`: two square brackets with nothing between them,
leaning 11°. The wordmark's "No" loses its italic and stands upright in the second ink. It applies
everywhere the mark appears — the home-screen icons, the header tile, the favicon (now the icon file
itself rather than a text glyph in a data URI) and the landing page.

**Why brackets.** `[Am]` is how a chord is written in this app, and the app exists to take the chord
away: what is left is `[ ]`. It is the name drawn rather than a picture of music. A quaver said
"notation" — composers, theory, a grammar app — when the app is about chords, and about chords
leaving. Other directions were drawn and set aside: a sharp reads as a hashtag at icon size, a chord
box is guitar-only and too busy at 16px, stacked noteheads drift back to notation, and a chord over a
lyric line is an illustration rather than a mark.

**Why it leans, and why the name no longer does.** Of eight variations — light, bold, tight, tall,
rounded, offset, regular and italic — the slanted one had the most character, because it rhymed with
the italic "No" beside it. With both slanted, the logo said the same thing twice. The lean moved to
the mark, which is the more memorable carrier, and the name stands upright so the logo has exactly
one gesture.

**Drawing.** On the icon's 512 grid: 272 tall and centred, stems 40 and feet 32 (horizontals drawn
lighter, as a typeface draws them, so both read as one weight), a wide gap between. The slant is
computed into the coordinates rather than applied as a transform, so every copy is a plain path that
MK-01 can compare. The header draws the same paths through a closer viewBox (`64 64 384 384`): a
home screen wants margin round a mark, but in a 38px tile beside the name the full grid read small
and light.

**Cost.** The quaver said "music" to someone who has never heard of the app; brackets need the name
beside them, or a moment with the app, to mean anything. That is the trade for a mark that belongs
to this app rather than to music software in general.

---

## ADR-075 — Icon URLs carry a version

**Decision.** Every reference to an icon — the manifest's three, the page's `apple-touch-icon` and
favicon, and the service worker's precache list — asks for `?v=2`. When the drawing changes, the
number goes up everywhere at once; MK-02 fails if any reference is left behind.

**Reported symptom.** After the mark changed to brackets (ADR-074), the installed app still showed
the quaver, although every icon file on the server was the new drawing.

**Why the files alone were not enough.** Each surface that shows an icon keys it by URL, and the URLs
had not changed. iOS takes the `apple-touch-icon` once, when the app is added to the home screen.
Android rebuilds an installed app's icon only when it notices the manifest has changed, and a
manifest whose icon entries are byte-for-byte the same has not. Hosting serves `/icons/` with an
hour's `max-age`, and the service worker revalidates in the background, so even a browser tab can
show the old drawing for a while. A new URL is the one signal all of them understand.

**Why a query string rather than new file names.** The files keep stable names, so the README's
`magick` commands and the icon SVGs that MK-01 reads stay where they are; bumping one number is the
whole of an icon release. The service worker matches cached entries on the full URL, query
included, so the precache has to list the versioned URLs — an unversioned entry would sit in the
cache answering nothing.

**Cost.** iOS still cannot be reached: an icon already on a home screen stays as it was until the
app is removed and added again. The version only guarantees that the *next* install gets the right
one.

---

## ADR-076 — A new library starts with one song

**Decision.** Amends ADR-024. A new library is seeded with House of the Rising Sun alone. Scarborough
Fair and If I Was a Blackbird remain development fixtures — `createFixtureSongs()` builds all three
for the acceptance tests — but `createExampleSongs()`, which seeds, returns only the songs named in
`SEEDED`.

**Why one.** Three songs read as a demo library someone else made: a first run spent deciding what to
delete. One song everybody already knows says "this is what a song looks like here" and leaves the
library to its owner. The Rising Sun is the one to keep: the best known of the three, in 6/8 so the
count-in and the beat strip have something to show. Its arrangement was rewritten at the same time:
every verse now ends on the C it resolves to and closes with a six-bar turnaround,
`[D] [F] [Am] [E] [Am] [E] |6|` — one line, a bar to each chord — in place of the old two-line
instrumental and the regrouped `{3/4}` ending. It shows the line-length notation on the song a new
user meets first, and the same turnaround after every verse is easier to learn than an ending that
appears once.

**Why the fixtures stay.** They are what EX-01..10 play: Scarborough's held verse endings, Blackbird's
G→A transposition, two waltzes against one 6/8. Dropping them from the seed is a decision about a
welcome; dropping them from the tests would be losing coverage for it.

**Cost.** Existing libraries keep the copies they were given — seeding only ever fills an empty
library — so the change reaches new devices and new accounts only.

## ADR-077 — On a wide screen the panels sit beside the chart

**Decision.** Amends ADR-060 for windows 900px and wider. The panels — This song, Metronome and the
learning level — render in a 340px column to the right of the chart instead of inside the pinned
header above it. The column scrolls on its own; the transport spans both columns. With both panels
shut the column goes and the chart takes the full width back. Below 900px nothing changes. Where
the panels render is decided by `useMediaQuery`, because CSS can restyle an element but cannot move
it out of the sticky header.

**Why.** On a desktop the panel above the chart pushed the song a third of the way down a screen
with half its width empty. ADR-046 put the panel in the flow so that it could never hide a line;
beside the chart it still hides nothing, and no longer moves anything either.

**Playback no longer shuts them, here.** On a phone the panels collapse when Play is pressed because
they take the screen the chart needs. In a column they take none of it, and shutting them would
widen the chart and re-fit every line (ADR-054) at the moment the song starts — the same shift out
from under the reader that the panels deliberately avoid on pause. So on a wide screen they stay as
they were.

**Why 900px.** At 900 the chart column keeps about 510px of measure, where the longest line of the
seed song still sets at full size. Narrower than that the column would cost the chart its type
size, which is the thing the screen is for.


---

## ADR-078 — The landing page lives at nochords.app

**Decision.** `nochords.app` (registered at Cloudflare, Cloudflare DNS) serves the landing page
from GitHub Pages. The apex holds GitHub Pages' four A and four AAAA records, `www` is a CNAME to
`anton-g-kulikov.github.io`, and every record is **DNS only** — not proxied. The custom domain is set
in the repository's Pages settings, with HTTPS enforced, and the domain is verified on the GitHub
account. The app itself stays on Firebase Hosting for now.

**Why `.app`.** `nochords.com` was registered in 2025 by someone else and is locked until 2028.
`.app` suits the product, and the whole TLD is on browsers' HSTS preload list, so it is HTTPS-only
by construction — which an installable web app requires anyway.

**Why not proxied.** GitHub provisions the certificate itself, by answering Let's Encrypt on the
domain. Behind Cloudflare's proxy that challenge goes to Cloudflare instead, the certificate never
issues, and because `.app` refuses plain HTTP outright the page would not load at all. DNS-only
leaves Cloudflare as the nameserver and nothing more.

**Why the setting and not a `CNAME` file.** Pages deployed by Actions ignores a `CNAME` file in the
artifact; the domain is a repository setting. It was set only after DNS resolved: setting it first
makes `github.io` redirect to a name that does not answer yet, and the existing page goes dark.

**Why verify the domain.** A verified domain can only be used by Pages sites on this account. If the
repository's setting were ever cleared, nobody else could point their own Pages site at
`nochords.app` in the gap.

**Cost.** The landing page and the app now live on different hosts — `nochords.app` and
`nochords-18219.web.app`. Moving the app onto the domain too (say `play.nochords.app` on Firebase) is
a separate decision, with its own cost: an installed app's origin would change, and local songs do
not follow an origin.

---

## ADR-079 — "Buy me a [song] book"

**Decision.** A support link to Buy Me a Coffee, worded "Buy me a [song] book", sits in the links
row at the foot of the library, after the notation guide, and in the landing page's footer. The
brackets are drawn in the second ink; "song" is ordinary text.

**Why the wording.** `[Am]` is how a chord is written in this app, and brackets are now its mark
(ADR-074). Put "song" in them and the line says what the money is for in the app's own notation —
a songbook — instead of borrowing a coffee joke from every other project.

**Why there.** The library's footer already holds the things that are about the app rather than
about a song: where to read more, how it looks, which build it is. An offer of support belongs with
those, quiet and after everything else, never in the player and never as a prompt that interrupts
playing. It opens in a new tab, or in the browser from the installed app, so tapping it does not
lose your place.

**Cost.** On Android, where "Install app" joins the same row, the links wrap to a second line. On the
landing page each footer link wraps as a whole, so the phrase is never cut after "Buy me a".

---

## ADR-080 — A new library starts with a song for each audience

**Decision.** Amends ADR-076. A new library is seeded with two songs: House of the Rising Sun and
Чёрный ворон. Both are ordinary songs under ADR-024 — editable, deletable, never restored.

**Why Чёрный ворон.** ADR-076 wanted one song the visitor already knows, and for a Russian speaker
the Rising Sun is not reliably it. Чёрный ворон is known to every generation — a Cossack song made
famous again by the film «Чапаев» (1934). Its text is in the public domain: it grew from Nikolai
Verevkin's 1831 poem into a folk song with no author to protect it. Almost no other song of that
recognisability is. The mid-century Soviet repertoire people first think of — «Трава у дома»,
«Притяжение Земли», «До свидания, Москва» — is under copyright in Russia until the 2060s–2090s,
and in the US as well, because those works had their copyright restored there in 1996 (the URAA).
A seeded song is the app distributing its text to every new library, so the rule that the fixtures
use only public-domain lyrics applies to it in full.

**Why both, not one chosen by language.** The app has no notion of the visitor's language, so both
songs are seeded for everyone. Each visitor narrows the list instead: the library's language filter
(ADR-081) leaves seeding alone, and two songs in two languages are what show it from the first run.
The two also differ in meter — 6/8 and 4/4 — so the count-in and beat strip show two shapes on a
first run.

**The arrangement.** Am, in 4/4 at 72 bpm, two bars to a line, each verse ending held for four
(`|4|`) and the four verses separated by blank lines so level 1 has repeats to thin (ADR-058).
The text is a common folk variant: four six-line verses, each singing its last two lines twice, and
the raven verse both first and last. The
chords — Am, Dm, E, G, C — are the fixture's own, not a transcription of any recording. The meter is
a choice: the song is sung both as a slow 4/4 and as a waltz, and no source settles it.

**Cost.** Two songs is a little more of a demo library than ADR-076 wanted, and an English-speaking
visitor meets a Cyrillic song they may not know. The language filter (ADR-081) is what pays that
back.
Existing libraries are unaffected, since seeding only ever fills an empty library.

---

## ADR-081 — The library can be filtered by the language a song is in

**Decision.** Once a library holds songs in more than one language, its running head offers
**All · English · Russian**. The choice filters the song list and nothing else: the app stays in
English, and the player, editor and seeding are untouched. A song's language is read from its
letters — Cyrillic against Latin, title and lyrics together, the majority deciding — by
`songLanguage` in `src/lib/language.ts`; it is not stored on the song. The choice is a device
setting, `libraryLanguage`, defaulting to "All".

**Why read rather than store.** Every song that already exists — written by hand, in someone's
Firestore account, seeded before this — would otherwise arrive unlabelled, and need either a
migration or a question nobody wants to answer while typing a song in. Reading the letters gets
all of them right on the day it ships. The cost is the limit of an alphabet: a Spanish song reads
as English and a Ukrainian one as Russian. A third language that shares an alphabet with one of
these is the point at which a stored field, with this reading as its default, becomes worth it.

**Songs with no words.** A song with no letters in it — the one New song has just made, or one of
chords alone — has no language, and every choice shows it. Otherwise making a song with "Russian"
chosen and stepping back before typing would make it vanish from the library it was just made in.
For the same reason the title the app gives a new song, "Untitled song", does not count: it is the
app's English, not the writer's.

**Only when there is a choice.** With one language in the library there is nothing to switch
between, so nothing is shown — and the remembered choice stands down until there is. Without that,
deleting the last Russian song with "Russian" chosen would leave a library that looks empty and
offers no way to say otherwise.

**Why "All" by default, not the device's language.** A first run that hid half the seeded library
because the phone is set to Russian would look like missing songs, not like a preference. The
switcher is where the choice is made; the device's language is not asked.

**Why seeding is left alone.** ADR-024 seeds once into an empty library and never restores. Choosing
which songs to seed by language would mean asking before the library exists, or seeding differently
on two devices of one account. Filtering a library that holds both costs neither.

**Where it sits.** In the library's running head, set in its small capitals with the chosen one in
the second ink — a contents page that can be read in either language, not a control panel above it.
Each choice keeps a 44px tap target by padding given back with a negative margin, so the head keeps
its height.

---

## ADR-082 — On a wide screen the strip keeps only the beat

**Decision.** Amends ADR-077, and on wide screens ADR-040 and ADR-042. At 900px and wider the sidebar
is always there, and holds everything that sets the song up: the chord display at its head, the
learning level under it while learning, then This song and the metronome. Above the chart only
the beat strip is left. The strip's two disclosure buttons are gone at that width — everything they
opened is already open — and so is the choice of whether the sidebar shows. Below 900px nothing
changes: the mode and the two buttons stay in the strip, and the panels open in the pinned header.

**Why.** ADR-077 moved the panels beside the chart but left their controls above it, so setting a
song up meant looking in two places, and the row above the chart was buttons for a column beside
it. With the sidebar permanent the chart's column is the song and its beat, nothing else. ADR-040
put the mode in the strip because it is reached for mid-song and the panel was shut while playing;
on a wide screen the sidebar is never shut, so the mode is as close at hand there.

**The learning level follows the mode.** It is the setting of one mode, so it sits directly under
the control that turns that mode on, rather than at the foot of the column below the metronome.

**Cost.** The chart is always 348px narrower on a wide screen; there is no closing the sidebar to
get the width back. At 900px that still leaves about 510px of measure (ADR-077), and on a desktop
the width beside a song was empty more often than it was wanted.

---

## ADR-083 — A song can carry its own count-in, and the beat is heard by default

**Decision.** Amends ADR-016 and ADR-059. A song has an optional `countInBars`, set in its editor
beside bars per line: a number, or `null` for **Auto**, one line's worth of bars. The metronome's
count-in keeps its meaning — a number set there wins for every song — but its Auto now means "what
the song says": the song's count-in if it has one, otherwise a line's worth. The seeded House of the
Rising Sun counts in four bars, at ♪ = 180. Separately, `metronomeEnabled` now defaults to `true`, with the shaker
still the default voice (ADR-065).

**Why on the song.** How long a run-up a song needs is a property of the song, not of the room.
ADR-059 got most of the way by following the line length, and it fails exactly where a line is
short: the Rising Sun's line is one bar of 6/8, and six quick eighths are over before the pulse has
settled. A device setting cannot fix that without lengthening every other song's count too.

**Why the device still wins.** ADR-016's reason stands for anyone who wants the same count before
everything, and it was already an explicit choice — a number there was typed on purpose. Letting a
song override it would make that setting silently mean less on some songs than others.

**Why old songs read as Auto.** A song written before the field existed was counted in by its line
length, so `null` is the value that keeps it sounding as it did. Storage and Firestore both read a
missing or invalid value as `null`; a number is clamped to the range the metronome offers.

**Why the sound starts on.** With the sound off the first Play is a silent count-in that only the
dots show, and the shaker — chosen to sit under a slow song — is a feature you have to find. Play is
already the gesture that opens the audio clock (ADR-066), so starting on costs nothing technically.
Only devices with no stored preference get it: a device that ever saved its settings stored the
`false` it had, and keeps it.

**Cost.** One more field on every song, and one more place a count-in can come from: the strip
shows the resolved number, but working out why it is two takes knowing about both settings. And a
first Play now makes a sound, which in a quiet room is a surprise rather than a discovery.

---

## ADR-084 — The Russian seed song is Дорогой длинною

**Decision.** Amends ADR-080. The second seeded song is Дорогой длинною in place of Чёрный ворон:
Konstantin Podrevsky's four verses as printed in 1927, with the chorus after each as it is usually
sung and the last chorus twice, in Gm and 4/4 at 120 bpm, four bars to a line, counting in two bars
(ADR-083). Чёрный ворон is no longer a fixture.

**Why this song.** ADR-080 wanted the song a Russian speaker already knows, and the mid-century
repertoire that is best known is under copyright. Дорогой длинною is the rare one that is not:
written in 1924 and printed in 1927, its words are by Podrevsky, who died in 1930, and its music by
Fomin, who died in 1948 — out of copyright in Russia since 2023 even with the wartime extension, and
in the US as a work published before 1928. It was sung through the whole century, and it is known
abroad as "Those Were the Days", so an English speaker meeting it in the library may know the tune
too. Raskin's English lyrics are a separate work under copyright; only the Russian text is used.

**Why the printed text, and the sung chorus.** Folk songs exist in variants, and ADR-080's choice of
one was a guess at what people sing. A romance has an author and a first printing, so the verses
follow it. The chorus is the exception: the printing has «погодой лунною» and «Да со старинною»,
and the song is sung «и ночью лунною» and «И с той старинною» — the words people will sing along to.
Both are Podrevsky's chorus, and neither is anyone else's copyright.

**The arrangement.** Gm with its own secondary dominants — G7 into Cm, A7 into D7 — and F and B♭ in
the chorus: the harmony of the romance as it is played, given by Anton for the first verse and
chorus and carried through the other verses on the same syllables.

**Why verse and chorus as separate sections.** Each verse and each chorus is its own block, so the
four verses share one chord pattern and the five choruses another, and learning level 1 has
repeats of both to thin (ADR-058) — the shape most songs people bring will have.

**Cost.** Libraries already seeded with Чёрный ворон keep it; seeding only fills an empty library.
At four bars a line it is a long song — nearly five minutes.

---

## ADR-085 — The tempo unit list names each note's value

**Decision.** Amends ADR-052. The tempo unit's options read `♪ – 1/8`, `♩ – 1/4` and `♩. – 3/8`: the
note, then what it is worth as a fraction of a whole note. Closed, the button still shows the note
alone. The three units are unchanged — none is added.

**Why.** A note shape is quick for someone who reads music and a guess for someone who does not;
"1/4" is the same fact said a second way, in the place the choice is made. The button keeps the
bare note because it already sits beside the number it qualifies, `♩ 80`, and is read there.

**How the button stays bare.** A native select shows its chosen option's text, and `♩. – 3/8` does
not fit the 46px button. So the select's own text is made transparent — `color` and, for Safari,
`-webkit-text-fill-color` — and the note is drawn over it from `tempoUnitSymbol`, ignoring pointer
events so the select underneath still takes the tap. The options set both properties back, for
browsers whose open list inherits them. Screen readers still hear the select's full option text.

---

## ADR-086 — The dotted quarter is no longer a tempo unit

**Decision.** Amends ADR-052 and ADR-085. A tempo counts eighths or quarters; `dottedQuarter` is
gone from `TempoUnit` and from the list. A song saved in it is converted in `sanitizeSong`, the one
door both stored JSON and Firestore documents come through, to the same speed in a unit still
offered: eighths at three times the number when that fits the field's 300 (♩. = 60 is ♪ = 180),
quarters at one and a half times otherwise (♩. = 120 is ♩ = 180). New songs in 6/8, 9/8 and 12/8
start in eighths.

**Why.** Nobody chose it. No seeded song used it, and the app only reached for it on its own for a
new song created in a compound meter — but new songs start in 4/4, and changing the meter never
changes the unit, so in practice it was picked by hand or not at all. Meanwhile it was the one
option whose value needed explaining: listed as `♩. – 3/8` (ADR-085) it reads like the time
signature 3/8, which is something else. Eighths say the same thing about 6/8 without the dot.

**Never the bare number.** Reading a saved `♩. = 60` as `♪ = 60` would play the song at a third of
its speed, and as `♩ = 60` at two thirds. The conversion keeps how the song sounds, as ADR-052's
migration did, at the price of the number changing on screen.

**Where it can move.** Eighths are exact. Quarters are exact for an even number and round half a
beat a minute for an odd one, and only past ♩. = 200 — three hundred quarter notes a minute — is the
tempo capped. A converted song is written back in its new unit the next time it is saved.

**Cost.** An app still running an older build reads `eighth` and `quarter` as it always did, so a
song converted on one device plays the same on another that has not updated yet.

---

## ADR-087 — The app lives at songs.nochords.app

**Decision.** Follows ADR-078. The app is served at `songs.nochords.app`, a custom domain on the
existing Firebase Hosting site, and every link that points at the app — the landing page's two
"Open the app" buttons, the README, the deploy workflow's environment URL, the release checklist's
live checks — names it. The project's own address, `nochords-18219.web.app`, keeps serving the same
build and is not redirected. Sign-in is unchanged: it opens a Google popup through
`nochords-18219.firebaseapp.com`, which works from any origin listed under Firebase Authentication's
authorised domains.

**Setup outside the repository.** In Firebase Hosting, `songs.nochords.app` is added as a custom
domain; the records it asks for go into Cloudflare as **DNS only**, for the reason ADR-078 gives —
behind the proxy the certificate never issues, and `.app` will not load without one. In Firebase
Authentication, `songs.nochords.app` is added to the authorised domains, or Google sign-in there
fails with `auth/unauthorized-domain`. The links were changed before this was done, and are not to
be released until the domain answers over HTTPS: a push to `site/` deploys the landing page at once.

**Why `songs.`** The app opens on a library headed "Songs"; the address says what is kept there.
`play.` was considered and is just as good; `app.nochords.app` says it twice. Either way it is
chosen once, because of the cost below.

**Why no redirect.** A browser keeps each origin's storage apart. Songs kept without an account
live in `nochords-18219.web.app`'s storage, as does the library of an app installed from there.
Redirecting would put them out of reach — the page that could read them would no longer load. Left
running, the old address still opens them; signing in there moves them into the account, and the
account brings them to `songs.nochords.app`.

**Cost.** Two addresses serve one app, and a library kept without an account does not cross from
one to the other on its own. An installed app keeps the address it was installed from; moving it
means signing in on the old one, installing from the new one, and removing the old icon.


---

## ADR-088 — The landing page shows a fretboard, edge to edge

**Decision.** Between the call to action and the three features, the landing page runs a photograph-
style fretboard across the full width of the page, through the nut and half the headstock — two of
its three pairs of tuners — cut at the right edge. It is one WebP (`site/fretboard.webp`, 1748×576,
97 kB) with a transparent background, so it sits on paper and on the
night scheme alike. The image is an original
AI-generated illustration, not stock.

**How it behaves.** The band's height follows the page width — `clamp(170px, 33.5vw, 680px)` — and the
image fills it with `object-fit: cover` pinned to the right. The band is kept narrower for its height
than the image (about 3:1), because past that `cover` would trim the tuner keys off the top and bottom
instead of frets off the left; only screens wider than about 2000px reach the cap and lose key tips. A narrower screen shows fewer frets,
never a thinner board, and half the headstock is always the last thing before the edge. The exact
half falls through the second pair of tuner keys, so the cut is in the gap after them instead. The
keys reach far above and below the board, which makes the band well over twice the board's height —
about 430px on a laptop. The band sits
outside the text column rather than reaching out of it with `100vw`, which counts a classic
scrollbar and would push the board under one.

**How it sits between the text.** The board fills only the middle of the image; above and below it
is air, except for the tuner keys at the far right. On screens wider than about 1000px the keys fall
outside the text column, so the band takes negative margins — a fifth of its height above, a bit more
below — and the text closes in to about 40px from the board. The band lets taps through and sits
under the text, since its box now overlaps the button above it. Narrower than that, the column
reaches into the keys' path, so the pull stops just short of the key tips and the board keeps about
60px of air on a phone.

**Why a fretboard and not the whole neck.** With the whole headstock in frame the image had to keep
its proportions, so spanning the page made it 400px tall on a laptop and 600 on a large screen.
Cropped to the board and half the headstock it can still span the page at a bearable height, and it reads as "this is about playing" before
a word of the page is read.

**What was tried first.** A drawn neck in the page's own inks, with an A minor fingering and one
finger fading, was set aside for a photographic image. An iStock image was used for a local mock-up
only and never committed: its preview licence does not cover publishing.

**Cost.** At the largest sizes the band is drawn from a 576-pixel-tall source at up to 680 CSS
pixels, so on a high-density screen it is upscaled and slightly soft. A larger render of the same
illustration would fix that without any change to the page.

---

## ADR-089 — The Russian seed song is Постой, паровоз

**Decision.** Amends ADR-084. A new library is seeded with House of the Rising Sun and Постой,
паровоз, which replaces Дорогой длинною; Дорогой длинною is no longer a fixture. The new song is in
C♯m — an inside joke; it is usually played in Am — and 2/4 at ♩ = 120, four bars to a line, the
three lines that end each phrase held for eight, and counts in by Auto — one line's worth. Its text
and the first verse's chords are Anton's, carried through the other verses on the same syllables.

**Why it is treated as public domain.** It is an urban folk song of disputed origin, sung for decades
before Leonid Gaidai put it in «Операция Ы» (1965). In 1996 the writer Nikolai Ivanovsky, born in
1928, told «Комсомольская правда» he had written it in 1946. That claim was never upheld, and the song
is treated as folk — no author whose copyright would run. This is a weaker footing than Дорогой
длинною had, with its known author long dead, and it is recorded here so that the call can be
revisited if an authorship claim is ever made good.

**Why this song.** It is the one most likely to be sung at a Russian table, which is the point of the
seed: a song the visitor already knows. Two seed songs, one per audience, is ADR-080's shape again.

**Cost.** The copyright footing is a judgement, not a fact. Libraries seeded with Чёрный ворон or
Дорогой длинною keep them; seeding only fills an empty library.

---

## ADR-090 — Songs are shared in a public repository, and copied in by hand

**Decision.** Songs to share live in a separate public repository, `anton-g-kulikov/nochords-songs`,
one Markdown file each under `songs/<language>/`. A file's header holds its settings, named as the
editor labels them — `original key`, `meter`, `tempo` (`♩ = 90`), `bars per line`, an optional
`count-in bars` — with `language`, `licence`, `source` and `arranged by`; GitHub shows that header
as a table. The song text sits in a single `text` block, which GitHub gives a copy button. The app
does not read the repository: people copy a song into a new song themselves. The landing page links
it in a "More songs" section and in its footer, the app's library footer links it as "More songs",
and the README links it beside the app.

**Why a repository.** It is an archive that is personal and public at once: Anton owns and merges
it, anyone can read and download it, and anyone can propose a song as a pull request, which is
reviewed before it is added. For people who do not use git, an issue form takes the same fields and
the song text, and its maintainer turns a submission into a file.

**Why copied by hand.** The app gains nothing to maintain — no import, no index, no network fetch —
and a person setting four fields and pasting one block is a minute's work. If that ever is not
enough, the header is already machine-readable.

**What it accepts.** Traditional songs, public-domain songs, and originals shared by their writers —
nothing else. Lyrics stay in copyright for decades after their author dies, and a public archive of
them is taken down; so is a modern version of an old song, however old the song. Every file names
its source, and a pull request ticks that it is one of the three. Arrangements — chord choice and
placement, timing, transcription — are licensed CC BY 4.0, credited to `arranged by`; an original
is CC BY 4.0 in full. It starts with the app's two seed songs, House of the Rising Sun and Постой,
паровоз, the second marked traditional with its disputed authorship stated in `source`.

**Why the checks use the app's parser.** Every pull request runs `scripts/check-songs.ts` against a
checkout of this repository, importing the chord, key, meter, tempo and line parsers rather than
copying them, so the archive cannot drift from what the app reads. Because the line parser never
refuses anything — an unknown chord or an unclosed bracket simply becomes lyric — the check fails on
exactly those: a chord the app cannot read, a stray `[`, `|`, `{` or `}`, and any setting the editor
does not offer.

**Cost.** The check depends on this repository's file layout: moving `src/lib/chords.ts`, `keys.ts`,
`meter.ts`, `tempo.ts` or `inline.ts`, or renaming their exports, breaks the archive's pull requests
until its script follows. Reviewing provenance is a maintainer's judgement, not something a check
can do.

---

## ADR-091 — The landing page's lower half shows instead of tells

**Decision.** Below the live chart, each section of the landing page puts a piece of the app beside
its words, under a serif headline:

- **How it works** — the same line, "call the Rising Sun", at levels one, two and three, with more
  of its chords blurred in each.
- **Notation** — what you type, in the editor's monospace, above what you play, as chord over lyric;
  and `|4|`, `{3/4}` and `♩ = 90` as small chips with a line each.
- **Metronome** — a 6/8 beat strip with its dot going round at ♪ = 160, still under
  `prefers-reduced-motion`, and the three sounds as cards, the shaker marked as the default.
- **Your songs** — on this device, everywhere you sign in, and the song archive, as cards rather than
  paragraphs, with the archive's links as a button and a link.
- A closing line set the way the app sets a song: "Play together, right now", over Bm, Bm/A and G —
  the chords of the chorus it answers, on the same syllables — then that chorus's A, hanging with no
  word under it, and a button, **With the app**, where its last phrase would be. It answers a famous chorus in the shape and the
  chords of its call, with the button where the third phrase falls. The words are the page's own —
  lyrics are licensed even a line at a time — and a chord progression belongs to no one.

**Why.** The top half had a voice — headline, fretboard, a chart that moves — and the lower half was
five sections of the same shape: a small-caps label and grey paragraphs between hairlines. It told
everything and showed nothing, which is the wrong way round for an app whose idea is visual. The
wording is kept; the pictures are drawn from the page's own chart pieces, so they look exactly like
the app.

**Cost.** The level cards are a third of the column wide, so their line is shortened to "call the
Rising Sun" — the full lyric wrapped, and a wrapped line puts a chord over the wrong word, which is
the one thing the app's own fit exists to prevent.

---

## ADR-092 — While editing, the pencil becomes a save button

**Decision.** Amends ADR-043. The header button that enters editing is a pencil, labelled "Edit
song"; while editing it is a check, labelled "Save", and pressing it returns to playing. It keeps
the accent colour while editing. It is no longer marked `aria-pressed`.

**Why.** A pencil says "edit", and in edit mode that is the one thing the button does not do — it
leaves. A check is how a title bar says "this is the way out, and it keeps what you did", which is
what the button is for.

**Why "Save" when nothing waits to be saved.** The song saves as it is typed, and that is
unchanged: leaving by the back arrow keeps everything too. "Save" is what people look for when they
are finished, and pressing it does keep what they did — it only stops being able to lose it.

**Why not `aria-pressed`.** A toggle announced as pressed or not keeps one name. This one now changes
name and picture with its state, so a screen reader hears "Edit song" or "Save" — the action — and
pressed would only contradict it.

---

## ADR-093 — The chart writes a line's length as the editor does

**Decision.** Amends ADR-061. A line whose length differs from the song's default ends, in the
chart, in `| 4 |` — the bar count between pipes, as it is typed, with a space inside each pipe —
rather than a bare `4`. It is set as the lyric is, in the same face, size and line height, so it
sits on the lyric's baseline like the line's last word, and it keeps ADR-061's faintness, 0.35
opacity. The pipes are hidden from screen readers, which hear "4 bars". The mark is kept on one
line.

**Why.** A bare numeral after a lyric reads as a footnote or a verse number. `|4|` is the notation
the writer typed in the editor, so the chart and the editor say the same thing the same way, and
someone who has only ever played a song learns the notation by seeing it.

**Why the meter mark is unchanged.** `4/4` already reads as a time signature on its own; braces
would add nothing a musician needs to recognise it.

---

## ADR-094 — The count-in only counts; an intro is written into the song

**Decision.** Supersedes ADR-059's Auto and ADR-083's per-song count-in. Every song starts with a
count-in of one bar of its opening meter — "1 2 3 4" in 4/4, "1 2 3 4 5 6" in 6/8 — or two bars,
a device setting chosen as `1 | 2` in the metronome panel (`Settings.countInBars: 1 | 2`, default
1). The beat strip names it "count-in" while it runs and "1-bar count-in" before Play. Bars to be
played before the singing are an **intro**, and an intro is part of the song: a line of chords with
no words at the top of its text, `[Am] [C] [D] [F] |4|`, which the notation already reads. There is
no intro setting. `Song.countInBars`, the editor's count-in field, Auto, and the 0–24 bar device
range are gone.

**Why.** A count-in is a count: the bar a band counts aloud so everyone comes in together. What the
setting had become — four bars of clicks before the Rising Sun, or "one line's worth" by default —
was an intro dressed as a count, and it could not say what the intro plays. Written into the song,
an intro has chords, a length, and a place in the chart, scrolls like any other line, and is
concealed while learning like any other line.

**Why one or two, and per device.** One bar is the count; two is for a slow song, or a player who
wants a bar to settle in. More than that is an intro. How long a player likes to be counted in is
theirs, not the song's, so it lives with the metronome's other device settings (ADR-016).

**What happens to stored values.** A song saved with its own count-in still loads; the field is not
read and is dropped the next time the song is saved. A device count-in of two bars or more becomes
2; anything else — none, one, Auto — becomes 1, since every song is now counted in. The Rising Sun
fixture loses its `countInBars: 4`; its intro is for its arrangement to write.

**Cost.** Someone who relied on a long count-in before a song with no intro written now gets one or
two bars, and has to write the intro into the song to get the rest back.

---

## ADR-095 — A song remembers its chord display

**Decision.** Amends ADR-039. The chord display — names, numerals or learning — is stored on the song
as `displayMode` and the song opens the way it was last left. The three buttons above the chart are
the setting; there is no other control. Songs saved before read as names, which is how every song
used to open. The seeded Постой, паровоз starts on numerals.

**Why on the song.** ADR-039 put the display in its own lifetime, "this session", forgotten on the
way out. In use it is a property of how you work on a particular song: one you are learning stays in
learning, one you play from the numbers stays in numbers. Opening every song on names made the most
common thing — picking up where you left off — a tap every time.

**Why Постой, паровоз opens on numerals.** It is written in C♯m as an inside joke (ADR-089), and
numerals are what make the key not matter: i, iv, V read the same in any key.

**Cost.** Changing the display now writes the song, so it syncs and dirties its record — the thing
ADR-016 kept the metronome's settings out of songs to avoid. A display is changed far less often
than a volume, and it is the song's to keep. ADR-039's "Chords" group now outlives the session. An
app from before this change that edits a synced song writes it back without the field, and the song
then opens on names until its display is chosen again.

---

## ADR-096 — A line of chords and no words is its chord row alone

**Decision.** Amends ADR-093. A row with chords and no lyric — an intro, a turnaround, written
`[Am] [C] [D] [F] |4|` (ADR-094) — is drawn as its chord row alone: the empty lyric row every other
line keeps under its chords is not drawn (`line--chords`). Its length mark is set as the chords are,
in their face and size, on their baseline, still at ADR-061's faintness. A row with words is
unchanged, and so is a row with neither, which stays the blank line between sections.

**Why.** Each line reserves a lyric row so that its chords sit over words. A line with no words kept
that row empty, so a two-line intro stood a whole lyric row apart, and the length mark — set as the
lyric, on the lyric's baseline (ADR-093) — landed on the empty row, under and after the chords it
measures. Without the row, intro lines stack as a chord chart's do, and the mark reads as the end of
the line it belongs to.

**Cost.** A chord-only line is shorter than a lyric line, so the chart's lines are no longer one
height; the playing line's highlight and the scroll follow each row's own box, as they already did.

---

## ADR-097 — A silent second, then the count-in in its own gentle tick

**Decision.** Amends ADR-094. Pressing Play to start a song begins a second of silence before the
count-in's first beat (`SILENT_LEAD_MS`, on top of ADR-030's quarter-second lead-in): the clock
starts at `-(countIn + 1000)`, the metronome plays no beat earlier than the count's own first, and
the strip and the timer show no beat until it sounds. Resuming mid-song is unchanged. The count-in
ticks in its own sound, `COUNT_IN_TICK`, whichever voice the song's beat uses: a steady sine,
1400 Hz on a plain beat and 1700 Hz on the "one", with a 3 ms attack.

**Why the silent second.** On a phone the audio context may only just have woken when Play is
pressed, and the first sound of a run has to be made before it can play. A count that starts on the
press can lose its "one" to that, and a count that comes in on two is worse than one that comes in
a second later. A second is long enough to be ready and short enough to read as "here it comes".

**Why its own sound.** The count is a cue, not the song. In the song's own voice the last count beat
and the first beat of the song sound alike, and the shaker — the default — is soft enough to be
taken for the song already playing. A pure, steady tone shares nothing with the shaker's noise, the
woodblock's falling knock or the beep's square buzz.

**Why gentle, and how that was set.** A pure tone puts all its energy near where hearing is keenest,
so at a voice's peak it sounds sharper than the voice. Rendered offline and measured, the first
draft (peaks 0.17/0.24 at 1600/1900 Hz) averaged about twice the shaker's level. At 0.10/0.14 and
1400/1700 Hz it averages about the shaker's (0.013–0.018 against 0.010–0.020 RMS at half volume),
peaks lower, and lasts about 30 ms against the shaker's 65–70: a tick. Like every voice it accents
by weight and a little pitch, within a fifth (ADR-065).

**Unchanged.** The count-in still follows the sound switch: with the metronome off it is shown, in
silence, as before.

---

## ADR-098 — The library footer's links take two lines

**Decision.** Amends ADR-071. The library footer's links are two lines rather than one that wraps
where it falls: "Bars, beats and meter" — with "Install app" or the iPhone's Share hint beside it
when there is one — then "More songs · Buy me a [song] book". The theme switch and the version
follow, as before.

**Why.** One line of four or five links wrapped at whatever width the phone happened to be, so the
same link landed on a different line on different screens. Two lines, each one kind of link — the
app itself, how to read it and install it; then what lies beyond it, more songs and support — break
the same everywhere, and keep the support link together with the archive it sits beside.

---

## ADR-099 — The iOS and Android apps are the web build in a Capacitor shell

**Decision.** Amends ADR-037. The store apps are Capacitor 8 shells (`ios/`, `android/`,
`capacitor.config.ts`, app id `app.nochords`) around the same `dist` the website serves.
`npm run native:sync` builds the site and copies it in, and `native:ios` / `native:android` open the
projects. One question, `isNative()` in `native.ts`, tells the build where it is running, and four
things change inside a shell:

- No service worker. The files are already on the device.
- No install offer. The app counts as installed.
- Auth starts with `initializeAuth` and IndexedDB persistence instead of `getAuth`.
- The shell's top is padded by `env(safe-area-inset-top)`, so the header clears the status bar.

**Why not Expo.** ADR-037 called the fixed shell "what an Expo shell would be built from". Expo is
React Native, which renders no HTML. Every screen, every rule in `styles.css` and the Web Audio
metronome would have to be written a second time, then kept in step with the first for good. Only
`src/lib` would carry over. A Capacitor shell runs the app as it is, so the layout ADR-037 describes
needs no translating at all.

**Why `isNative()` reads the bridge.** The shell injects `window.Capacitor` before the page runs.
Importing `@capacitor/core` to ask the same question added 8kB (3kB gzipped) to the main bundle of
every web visitor, for whom the answer is always no (ADR-023). Reading the global costs 138 bytes.

**Why no service worker in the shell.** It would be a second cache over files that are already
local. After a store update it could serve the previous release, which is the failure ADR-028
exists to prevent.

**Why `initializeAuth` there.** `getAuth` also loads Google's sign-in iframe from the auth domain.
In the iOS shell, whose page is `capacitor://localhost`, that load never completes, so the first
auth state never arrives. The library sat on "Loading your songs…" indefinitely. This was seen in
the simulator, and this change fixed it.

**Why the top inset, and why on every screen.** In a browser the inset is zero, because the
browser's own bar sits there. In the shells the page runs up under the status bar, and the clock was
drawn over the wordmark. One rule on `#root` covers every screen.

**Cost, and what is not done yet.**

- **Sign-in does not work in the shells.** Google refuses OAuth in an embedded web view, so
  `signInWithPopup` fails. It needs native Google sign-in
  (`@capacitor-firebase/authentication`), and on Android the signing key's SHA-1 has to be
  registered in Firebase.
- **The Android back button closes the app** from any screen, because nothing here uses history.
- **The icons and splash screens are Capacitor's placeholders.**
- **Android has been built but not run.** There is no emulator on this machine yet.
- **The audio session is still the web one.** ADR-066's silent-switch behaviour is still untested
  on an iPhone. Setting the session category natively would settle it.

---

## ADR-100 — The logo is the name in its brackets

**Decision.** Amends ADR-070 and ADR-074. In the app's header, on the song screen's running head and
on the landing page, the logo is `[ NoChords ]`: the mark's two leaning brackets, in the second
ink, with the name between them, upright and in ink as one word. The washed tile that held the
brackets beside the name is gone, and the "No" is no longer coloured. The home-screen icon and the
favicon are unchanged — the same brackets on a solid tile, with no room for the name.

**Why.** `[Am]` is how a chord is written in this app, so a name in brackets is a name in the chord's
place: the logo says "no chord here" without needing the tile to sit beside it. It also makes the
icon and the lockup one mark at two sizes — the brackets alone on a home screen, the brackets with
the name in them everywhere there is room. Of six variations drawn, the brackets carry the colour
and the name stays in ink, so the logo has one colour and one slant and the name reads as a word.

**Details.** Each bracket is its own small SVG, sized to the capitals' height. It is drawn in a
lighter cut of the icon's brackets — same lean and proportions, strokes thinned to the stems of a
semibold serif — because at first the icon's own heavy cut was used, and beside the type it read a
size too large and a weight too bold. The icon keeps the heavy cut it needs at 16px; MK-01 holds
every icon to one cut and MK-03 every lockup to the other. The brackets are set 0.07em lower than
the line box's centre: measured in Literata, that is where the capitals' middle sits, and the name
reads as centred between them only there. On the
song screen the brackets take the running head's grey, since the second ink belongs to the song
there. In the library the whole lockup is the easter egg's button (ADR-072): tapping it steps the
ink, and both brackets are struck on each change; its label names the app before the ink.

**Cost.** The header lost its only square target; the button is now the logo's own shape, which is
a little wider and less obviously tappable — acceptable for an easter egg.

---

## ADR-101 — The store apps sign in with the platform's own Google sign-in

**Decision.** Amends ADR-099. In the iOS and Android apps, Sign in opens the platform's own Google
sign-in through `@capacitor-firebase/authentication`. The plugin only fetches Google's ID token
(`skipNativeAuth: true`), and the Firebase JS SDK signs in with it through `signInWithCredential`.
The website keeps `signInWithPopup`. The plugin is imported only on the native path, inside the
Firebase chunk, so the website never fetches it.

Firebase knows the apps as `app.nochords`: one iOS app and one Android app, registered alongside the
web app. The Android one carries the debug key's SHA-1. Their configs, `GoogleService-Info.plist`
and `google-services.json`, come from `firebase apps:sdkconfig` and are not committed.

**Why the JS SDK holds the session.** Firestore, `watchAuth` and the cloud store all read the JS
SDK's user. Signing in natively as well would leave two sessions to keep in step. With the token
handed over, nothing downstream knows which way someone signed in.

**Why not the popup.** Google refuses OAuth inside an embedded web view, so `signInWithPopup`
cannot work in either shell.

**Backing out is not an error.** The plugin reports a cancel as a failure, in the platform's own
words. `isCancelledSignIn` recognises those words, and the cancel is passed on as the web's
closed-popup code, so `useAuth` stays quiet about it as it already does for a closed popup.

**Signing out signs out of Google too.** Otherwise the next sign-in skips the account chooser and
silently picks whoever signed in last.

**Why the configs stay out of git.** The repository is public, and the web key already lives in an
uncommitted `.env`. A fresh checkout has to fetch both files with `firebase apps:sdkconfig` before
the apps will build. Without the plist, the plugin's Google sign-in never answers at all.

**Smaller things it took.**

- **iOS URL scheme.** `Info.plist` registers the reversed client ID as a URL scheme, which Google
  sign-in requires.
- **App name.** `CFBundleName` is `NoChords`, not the target's name. iOS names the app by it in
  the "wants to use accounts.google.com" sheet, which said "App" before this.
- **Google only.** The Swift package links Google's SDK and not Facebook's, through the `Google`
  trait.
- **SPM symlink.** The plugin's symlink in `CapApp-SPM/symlinks` is ignored, because `cap sync`
  writes it as an absolute path into this machine's `node_modules`.
- **Signing team and encryption.** The signing team is `R9BBCR3NF6` (ANTON KULIKOV), and
  `ITSAppUsesNonExemptEncryption` is false: the app uses only HTTPS.

**Seen, and not yet seen.** In the iOS simulator, Sign in opens Google's sheet, and cancelling it
returns quietly to the library. The Android build compiles and resolves the web client ID that
Android's credential manager uses. Nobody has yet completed a sign-in on either platform, and
Android has not been run at all.

**Cost.**

- **A Play Store release needs one more fingerprint.** Its signing key's SHA-1 has to be added to
  the Android app in Firebase, or sign-in fails for anyone who installed from the Play Store.
- **App Review needs Sign in with Apple.** Guideline 4.8 requires it alongside Google. The App ID
  already has the capability. The code and the Firebase Apple provider do not.
- **App Review needs in-app account deletion.** Guideline 5.1.1(v) requires it, and nothing here
  offers it.

---

## ADR-102 — A help address, and Licence and Privacy pages

**Decision.** `help@nochords.app` is the support address. Cloudflare Email Routing is enabled for
`nochords.app` — three MX records, SPF and DKIM, added by Cloudflare beside the Pages A records — with
one rule, `help@nochords.app` forwarded to the maker's Gmail (already a verified destination), and the
catch-all left to drop. Two pages join the landing page on GitHub Pages, `nochords.app/licence/` and
`nochords.app/privacy/`, sharing `site/page.css`, a cut of the landing page's own styles. The address
and both pages are linked from the landing footer and from a third line of the library footer
(ADR-098); the README names them too.

**The licence.** NoChords' own code and design are all rights reserved. The repository is public so the
code can be read, which grants no right to reuse it; using the app is free. A song someone writes is
theirs, and the app claims nothing in it. The song archive stays CC BY 4.0 (ADR-090), and the fonts
(OFL 1.1) and libraries keep their own licences, named on the page.

**The privacy page says only what the code does.** No ads, analytics or tracking; songs in the
browser's storage without an account; with one, Google sign-in through Firebase Authentication (name,
email, photo link, an ID) and songs in Firestore that the security rules let only their owner read or
write; hosting logs at Firebase Hosting and GitHub Pages; mail forwarded by Cloudflare. Each claim was
checked against the code and `firestore.rules` when written, and has to be re-checked whenever any of
them changes.

**Why pages on the site, not screens in the app.** The App Store and Play Store need a privacy policy
at a public address, and a page on the site is one address for the stores, the landing page and the
app alike.

**Open.** There is no way to delete an account in the app: the privacy page says to write to
`help@`. Apple requires apps that create accounts to offer deletion inside the app (guideline
5.1.1(v)), so the iOS app will need it before review.

