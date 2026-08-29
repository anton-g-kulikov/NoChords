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
worked in every browser here. On iOS it did not: the bar was invisible until you scrolled most of a
screen, whether the settings panel was open or not. Reported from a phone, not reproducible on this
machine — no transformed ancestor, no containing block, the bar flush at the viewport bottom in
Chrome at every scroll position.

**Why not chase the iOS bug.** A fix aimed at a mechanism I cannot see would be a guess, and a
guess I could not verify. The shell removes the dependency instead: a flex row at the bottom of a
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
minimum and moved it on the first drag. One `TempoField` now serves both — a number and a slider
side by side over `MIN_TEMPO`–`MAX_TEMPO` — so a tempo can be dragged to or typed, and neither mode
can express a value the other cannot.

**What is deliberately still asymmetric.** Meter is editable in Edit and read-only in Play, while
bars per line is editable in both, and the ADR-034 justification for that ("changing it re-times
every line") applies just as well to bars per line. It is a real inconsistency, left standing until
it is decided rather than papered over.

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

