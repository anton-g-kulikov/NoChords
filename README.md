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

The whole song lives in one text area, one line per lyric line. Chords go inline, in brackets,
where they fall in the words:

```
[Am]There is a [C]house in New [D]Orleans,
[Am]It's called the [E]Rising [Am]Sun.
[Am]It's been the [C]ruin of many a [D]poor boy,
[Am]Great God, and [E]I for [Am]one./12/
```

Every line lasts the song's **beats per line** unless it says otherwise: end a line with `/12/` to
hold it for twelve beats, which is how you write a pause at the end of a verse.

Timing is beats throughout — there are no seconds anywhere, so changing the tempo rescales the
whole song, held lines included. Just type; everything saves as you go.

## Playing

Press **Play** (or <kbd>Space</kbd>) and the chart scrolls itself, highlighting the active row.
Click any row to jump to it. Three display modes:

- **Full** — chord names in the current key.
- **Nashville** — roman numerals relative to the song's original key, with case carrying quality:
  `G C D Em` in G reads `I IV V vi`, and stays that way no matter what key you transpose to.
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

The **first chord of every line stays visible** until the final stage, so you keep your place in the
line while the detail goes. That means the share actually hidden can fall short of the nominal
stage — the bar reports what is really concealed, not the stage number.

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

### Continuous deployment

`.github/workflows/deploy.yml` typechecks, tests, and builds on every push and pull request. A push
to `main` that passes then deploys to Hosting automatically. Pull requests are verified but never
deployed, and the deploy publishes the artifact the verify job built, so what ships is what passed.

One-time setup — create a deploy service account and give it to GitHub as a secret:

1. In the [Google Cloud console](https://console.cloud.google.com/iam-admin/serviceaccounts?project=nochords-18219)
   for `nochords-18219`, create a service account (e.g. `github-deploy`).
2. Grant it **Firebase Hosting Admin** (`roles/firebasehosting.admin`) and **Cloud Run Viewer**
   (`roles/run.viewer`, which the CLI expects when resolving hosting config). Nothing broader.
3. Create a JSON key for it and download the file.
4. In the repository, go to **Settings → Secrets and variables → Actions → New repository secret**,
   name it `FIREBASE_SERVICE_ACCOUNT`, and paste the entire contents of that JSON file.
5. Delete your local copy of the key.

That key is a real credential: it never belongs in this repository, in the client bundle, or in a
chat window. The workflow reads it only as an environment variable, writes it to a temporary file
for the CLI, and deletes it in an `always()` step.

To deploy from CI under a different project, change `.firebaserc`.

## Not in scope

Song catalogue or search, audio playback, streaming-service integration, automatic chord detection
or positioning, tabs, chord diagrams, ear training, accounts, and cloud sync.

## Credits

The example songs are traditional public-domain texts (Scarborough Fair, I Am a Young Maiden /
If I Was a Blackbird, House of the Rising Sun). Their chord placements and timings are original
test arrangements written as development fixtures, not transcriptions of any recorded arrangement.
