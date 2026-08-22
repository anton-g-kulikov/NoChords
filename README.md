# NoChords

Learn songs by progressively hiding chord cues while playing through lyrics at a controlled tempo.

Type a song in once, play it back with the chart scrolling itself, and let the chords fade out over
repeated playthroughs — 20%, 40%, 60%, 80%, then all of them — until you can follow the lyrics
alone. No account, no backend; songs live in your browser.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Development server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run deploy` | Build and deploy to Firebase Hosting |

**Add example songs** on the library screen loads three traditional songs to try it out.

## Writing a song

Each lyric line is one row. Chords go inline, in brackets, where they fall in the words:

```
[Am]There is a [C]house in New [D]Orleans,
```

Per row you also set **beats** (how long the row lasts at the song tempo) and an optional **pause**
in seconds held after it — useful at the end of a verse.

Entry is keyboard-first: <kbd>Enter</kbd> opens the next line, <kbd>Backspace</kbd> on an empty line
removes it, and pasting a block of lyrics creates one row per line. Everything saves as you type.

## Playing

Press **Play** (or <kbd>Space</kbd>) and the chart scrolls itself, highlighting the active row.
Click any row to jump to it. Three display modes:

- **Full** — chord names in the current key.
- **Nashville** — scale degrees relative to the song's original key. `G C D` in G reads `1 4 5`,
  and stays `1 4 5` no matter what key you transpose to.
- **Learning** — chord names with a share of them blurred out.

Transposing changes only what is displayed. Chords are stored in the key you wrote them in, so
transposing is lossless and repeatable, and Nashville numbers never move.

## Learning mode

The counter tracks completed playthroughs and maps to how much is hidden:

| Completed playthroughs | 0 | 1 | 2 | 3 | 4 | 5+ |
|---|---|---|---|---|---|---|
| Chords concealed | 0% | 20% | 40% | 60% | 80% | 100% |

Which chords get hidden is chosen at random when a playthrough starts and stays fixed for its whole
duration — nothing flickers as you scroll. Hidden chords keep their space on the page, so the chart
never reflows as you progress. **Reset learning progress** puts you back to 0%.

## How it is built

React + TypeScript + Vite, no other runtime dependencies. All the real logic is in pure modules
under `src/lib/`, with React kept to rendering and event wiring:

```text
src/
  lib/         chords, nashville, inline notation, learning, playback, storage, display
  hooks/       usePlayback (the clock), useSongLibrary (state + persistence)
  components/  SongList, SongEditor, Player, SongRowView, KeySelect
  types/       the Song / SongRow / ChordAnchor contract
test/          unit tests + test-documentation.md
_meta/         architecture decisions, task list, example-song fixtures
```

Timing is a precomputed schedule rather than a render-loop side effect, so the clock could be
replaced by real audio synchronisation without touching the timing logic. Persistence goes through
an injectable storage port, which is where a backend would slot in.

Design decisions and their tradeoffs are recorded in
[`_meta/architecture-decisions.md`](_meta/architecture-decisions.md); test intent and coverage in
[`test/test-documentation.md`](test/test-documentation.md).

### Workflow

This repository is developed under the
[metacoding](https://github.com/anton-g-kulikov/metacoding) workflow — ground in the repo, capture
scope, write test intent and failing tests before implementation, one bounded task at a time,
verify, then update the artifact that owns the changed concept.

The skill installs per-checkout and is gitignored, so install it in your own clone with:

```bash
npx metacoding init --template react --vendor claude-code
```

The durable artifacts it works against are committed: `_meta/` for decisions and task state,
`test/test-documentation.md` for test intent.

## Deploying

The app is a static bundle, hosted on Firebase Hosting. It makes no Firebase SDK calls, so there is
no Firebase config or API key in the client and nothing secret in this repo — `firebase.json` only
describes how to serve `dist/`.

The target project (`nochords-18219`) is pinned in `.firebaserc`, so deploy needs no flags. Deploy
authentication is per-developer and never committed:

```bash
npx firebase-tools login     # once, opens a browser
npm run deploy               # builds, then deploys hosting
```

The site is served at `https://nochords-18219.web.app`.

`firebase.json` serves hashed assets under `/assets/**` with a one-year immutable cache and
`index.html` with `no-cache`, so a deploy takes effect immediately without stale chunks. All paths
rewrite to `index.html`, so a direct link to any URL loads the app.

To deploy from CI, mint a token (`npx firebase-tools login:ci`) and pass it as the
`FIREBASE_TOKEN` secret — never as a file in the repo.

## Not in scope

Song catalogue or search, audio playback, streaming-service integration, automatic chord detection
or positioning, tabs, chord diagrams, ear training, accounts, and cloud sync.

## Credits

The example songs are traditional public-domain texts (Scarborough Fair, I Am a Young Maiden /
If I Was a Blackbird, House of the Rising Sun). Their chord placements and timings are original
test arrangements written as development fixtures, not transcriptions of any recorded arrangement.
