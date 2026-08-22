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
