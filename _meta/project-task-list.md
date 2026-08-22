# Project Task List

Temporal tracking for NoChords. System behavior lives in `system-documentation.md`;
test intent lives in `../test/test-documentation.md`.

## Active Task

### TASK-001 — NoChords MVP

- **Title:** Implement the NoChords MVP (editor, playback, display modes, learning concealment)
- **Goal:** A musician can manually enter a song, play through it repeatedly with automatic
  scrolling, and reach a playthrough where all chord cues are concealed.
- **Success criteria:**
  - A song can be created, edited, reloaded from `localStorage`, and deleted.
  - Pasting multiline lyrics produces one editable row per line.
  - Playback advances rows on tempo and honours each row's `pauseSeconds`.
  - Changing the current key transposes displayed chord names.
  - Nashville output is identical before and after a key change.
  - Learning playthroughs conceal 20/40/60/80/100% of chord occurrences.
  - `Reset learning progress` returns concealment to 0%.
- **In scope:** Items 1–10 of the implementation brief, plus the development fixtures and their
  acceptance criteria in `example-songs.md`.
- **Out of scope:** Everything in the PRD "Out of Scope" list — catalog/search, audio playback,
  streaming integrations, chord detection, automatic chord positioning, tabs, chord diagrams,
  ear training, mobile apps, accounts/backend, adaptive spaced repetition.
- **Blocking subtasks:** none outstanding.
- **Deferred follow-ups:** see "Backlog" below.

### TASK-002 — Reveal a line's concealed chords on tap

- **Title:** Tap a line in learning mode to reveal its concealed chords
- **Goal:** When a concealed chord is needed mid-song, get it back without leaving learning mode or
  losing progress.
- **Success criteria:**
  - A tap on a line in learning mode reveals *every* concealed chord on that line, not just the one
    under the finger.
  - The reveal is immediate — no wait to disambiguate it from a double tap.
  - The reveal is temporary and expires on its own, including while playback is paused.
  - A double tap still seeks to the line, as a single tap does in the other modes.
  - Tapping in Full and Nashville modes behaves exactly as before.
  - Learning progress is untouched: revealing is not un-concealing.
- **In scope:** the reveal interaction, its expiry, and the seek gesture change in learning mode.
- **Out of scope:** revealing a single chord rather than a line (the target is too small on a
  phone); a permanent reveal; keyboard activation of rows; changing the concealment selection.
- **Blocking subtasks:** none.
- **Deferred follow-ups:** keyboard and screen-reader access to the reveal — the row is a clickable
  `<li>`, and giving it a button role would collide with the global Space play/pause binding.

### TASK-003 — Numeric fields cannot be cleared

- **Title:** Fix number inputs that snap back when emptied
- **Goal:** Be able to change a number to one with a different digit count.
- **Bug:** `Number(event.target.value) || song.tempo` reads an emptied field as `0`, which is
  falsy, so the old value is restored on the keystroke that clears the field. Deleting the last
  digit of `90` leaves `9` and deleting `9` restores `9`, making 80 unreachable. The same shape
  affects beats-per-line and count-in.
- **Success criteria:**
  - A field can be cleared to empty and typed into freely.
  - 90 → 80 and 4 → 12 both work by ordinary editing.
  - An empty or out-of-range field commits nothing rather than a wrong value.
  - Leaving a field empty restores the last good value rather than persisting a blank.
  - A value changed elsewhere (the tempo slider) still updates the field.
- **In scope:** the three numeric fields — tempo, beats per line, count-in.
- **Out of scope:** the range sliders, which cannot reach an invalid state.
- **Blocking subtasks:** none.

## Subtask Status

| # | Subtask | Status |
|---|---------|--------|
| 1 | Project skeleton, data model, metacoding workflow install | Done |
| 2 | Test documentation and test plan | Done |
| 3 | Chord parsing and transposition | Done |
| 4 | Nashville conversion | Done |
| 5 | Learning concealment selection | Done |
| 6 | Playback schedule (tempo + per-row pauses) | Done |
| 7 | Local persistence | Done |
| 8 | Song editor UI | Done |
| 9 | Player UI, display modes, transposition control | Done |
| 10 | UX cleanup and responsive layout | Done |
| 11 | Inline `[Chord]lyric` notation and positioned chord anchors (ADR-007) | Done |
| 12 | Per-row beat counts (ADR-008) | Done |
| 13 | Minor-key Nashville degrees (ADR-009) | Done |
| 14 | Example songs loadable from the library | Done |
| 15 | Browser acceptance run against a production build | Done |
| 16 | Firebase Hosting configuration | Done |
| 17 | GitHub Actions CI: verify on every push/PR, deploy `main` to Hosting | Done |
| 18 | Whole song edited as one text area (ADR-010) | Done |
| 19 | Beats-only timing, `/n/` line length, no seconds (ADR-011) | Done |
| 20 | Nashville as roman numerals (ADR-012) | Done |
| 21 | Softer concealment blur; first chord of a line kept until the last stage (ADR-013) | Done |
| 22 | Metronome: synthesised clicks on a lookahead scheduler (ADR-014) | Done |
| 23 | Count-in as negative elapsed time, with an on-screen countdown (ADR-015) | Done |
| 24 | Metronome volume and count-in length as per-device settings (ADR-016) | Done |
| 25 | Controls collapse to a transport bar while playing (ADR-017) | Done |
| 26 | TASK-002: tap a line to reveal its concealed chords (ADR-018) | Done |
| 27 | TASK-003: numeric fields can be cleared and retyped (ADR-019) | Done |

## Backlog

Deferred deliberately — not required by the MVP brief.

- Section markers (a held line covers the MVP requirement).
- Reordering lines by drag; the text area makes cut-and-paste the current answer.
- A time signature per song, which would let the count-in default to one bar rather than a beat
  count the user picks.
- Metronome subdivisions (eighths, triplets) and a distinct count-in sound.
- Learning progress is inside the collapsed setup panel while playing (ADR-017), so the counter is
  not visible at the moment a playthrough completes.
- Import/export of songs as files.
- Component-level unit tests in a DOM environment; the components are currently covered by the
  browser acceptance run rather than by the unit suite (see `../test/test-documentation.md`).
- Committing the browser acceptance driver as a checked-in end-to-end suite.
- Undo for row deletion.
- Editing a row while it is playing re-derives learning concealment indices (ADR-002 cost).
- A more rigorous Roman-numeral convention for minor keys, as `example-songs.md` anticipates.
- Pin `firebase-tools` to a known-good major in CI; it currently resolves to latest on each run, so
  an upstream release could change deploy behaviour without a commit here.
- Firebase Hosting preview channels for pull requests.
- `actions/upload-artifact@v5` still runs on Node 20 and warns on every run. checkout and
  setup-node were cleared by moving to v5; this one needs whatever major migrates it. Non-breaking
  today — the runner forces it onto Node 24.
