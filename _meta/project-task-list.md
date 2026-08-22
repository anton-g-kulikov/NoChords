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
| 17 | GitHub Actions CI: verify on every push/PR, deploy `main` to Hosting | Done — needs the `FIREBASE_SERVICE_ACCOUNT` secret before the first deploy succeeds |

## Backlog

Deferred deliberately — not required by the MVP brief.

- Section markers and section-level pauses (row-level pauses cover the MVP requirement).
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
