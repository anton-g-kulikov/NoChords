# NoChords

Learn songs by progressively hiding chord cues while playing through lyrics at a controlled tempo.

Type a song in once, play it back with the chart scrolling itself, and let the chords fade out over
repeated playthroughs — 20%, 40%, 60%, 80%, then all of them — until you can follow the lyrics
alone. Works signed out with songs in your browser; sign in with Google and they follow you
between devices.

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
| `npm version patch\|minor` | Bump the release, which names the offline cache |
| `npm run deploy` | Build and deploy to Firebase Hosting |
| `npm run deploy:rules` | Deploy the Firestore security rules |

A new library starts with three traditional songs already in it, so there is something to play with
on the first run (ADR-024). They are ordinary songs — edit or delete them like any other (deleting is at
the foot of the editor); deleting them is remembered, and they do not come back. To change what everyone's first run contains, edit
the fixtures in [`src/lib/examples.ts`](src/lib/examples.ts) and deploy; existing libraries keep the
copies they already have.

**Sign in to sync across devices**, at the foot of the library, signs in with Google and moves the
library to Firestore.
Opening a song from the library lands on **Play**; a newly created one opens in **Edit**.

## Writing a song

The whole song lives in one text area, one line per lyric line. Chords go inline, in brackets,
where they fall in the words:

```
There [Am]is a [C]house in New [D]Orleans,
They [Am]call the [C]Rising [E]Sun,
And it's [Am]been the [C]ruin of [D]many a poor boy,
Dear [Am]God, I [E]know I was [Am]one.|3|
```

Every line lasts the song's **bars per line** unless it says otherwise: end a line with `|4|` to
give it four bars, which is how you write a pause at the end of a verse. A bar is as long as the
song's **meter** says, so one bar is six beats in 6/8 and three in 3/4 — and a line's length
follows the meter it is in.

Songs that change meter say so inline. Open a line with `{4/4}` and the signature runs from there
until the next one, so a bridge in four inside a song in six clicks in four while it lasts — and the
line shows it while you play, a small `4/4` before its first chord. A line
whose length differs from the song's default says so with a small raised number after its last word
— written into the line rather than floating beside it, so the words never run under it (ADR-061).

Tempo is a note and a number — `♩ = 90`, or `♪ = 180` — because a bare BPM does not say what it is
counting. In 6/8 that is the difference between the eighth and the dotted-quarter pulse, a factor of
three; both readings are offered and play identically. Timing is bars and beats throughout — there
are no seconds anywhere, so changing the tempo rescales the whole song, held lines included. Just
type; everything saves as you go.

**New to any of this?** The app has a short page on bars, beats and time signatures, and what each
part of the notation means — at the foot of the library, or "What is a bar?" under the editor. It
works offline like everything else (ADR-033).

## Playing

Press **Play** (or <kbd>Space</kbd>) and the chart scrolls itself, highlighting the active row.
Click any row to jump to it.

The app is a fixed shell — a header, a middle that scrolls, and the transport as the bottom row —
so the controls sit where a native player puts them and where your thumb already is, without
depending on fixed positioning (ADR-037). Settings — mode, key, timing, metronome — open from a strip pinned at
the top, and the panel opens inside that pinned header, so a key change three verses in happens
where you are rather than at the top of a page you would have to scroll back to (ADR-060). They
never share space with the controls you touch mid-verse (ADR-036). While a song plays the app holds a screen wake lock, so the phone
does not dim halfway through (ADR-035).

When playback starts the setup controls fold away, leaving just Play/Pause, Restart and the time —
on a phone that takes the header from 475px to 69px, which is the difference between seeing none of
the song and seeing seven lines of it. **Setup** brings them back at any point; pausing deliberately
does not, so a momentary pause never shifts the chart.

Three display modes:

- **Full** — chord names in the current key.
- **Nashville** — roman numerals relative to the song's original key, with case carrying quality:
  `G C D Em` in G reads `I IV V vi`, and stays that way no matter what key you transpose to.
- **Learning** — chord names with a share of them blurred out.

Transposing changes only what is displayed. Chords are stored in the key you wrote them in, so
transposing is lossless and repeatable, and Nashville numbers never move.

## Metronome

A strip sits pinned under the buttons: the meter, then a row of dots — one per beat of the bar,
with the one sounding lit — then which bar of the line you are in. The count-in comes first,
counting its bars down, then the song, counting the line's bars up and starting the dots again at
every barline. A `{3/4}` line says 3/4 and draws three dots, since it reports the meter actually
running. It is a picture of the beat, so
it runs whether or not anything is clicking, and the switch beside it is what decides that. Turn the
sound on and every beat clicks, accented on the first of the bar; turn it off and you are still
counted in and still shown the beat, in silence.

**Tempo**, **volume** and **count-in** live together in the metronome settings. The count-in is how
many *bars* to count before the song starts, or 0 for none — a bar is as long as the song's meter
says, so one bar counts six in 6/8 and three in 3/4, and the count lands on the song's own downbeat.
It is set to **Auto** by default, which means one line's worth of bars: the length you are about to
play is the length worth counting.

**Sound** offers three voices: a shaker of filtered noise (the default, and the one that sits under
a slow song), a woodblock, and a beep for a loud room. Each accents by playing the same sound harder
rather than by changing pitch. They are synthesised rather than sampled, so there is nothing to
download, and the strokes are scheduled onto the audio
clock ahead of time rather than fired from the animation loop — measured beat-to-beat error is
0.00ms, and a stuttering frame rate cannot make the click flam. Each one is fired early by the
device's output latency so that it is *heard* on the beat rather than a tenth of a second after it
(ADR-030), which is also why playback begins a quarter of a second after you press it.

Sound, volume and count-in are per-device rather than per-song, since how loud a click should be
depends on where you are playing, not on what. Tempo sits with them because it is the first thing a
metronome is asked for, but it belongs to the song.

## Learning mode

Learning runs in three levels, and a **Level** control sets one directly. They also advance on their
own with each completed playthrough, so picking one is choosing where that carries on from:

| Level | Music you have not played yet | Music that repeats | First chord of a line |
|---|---|---|---|
| 1 | shown whole | 15% hidden | kept |
| 2 | 50% hidden | 50% hidden | kept |
| 3 | 80% hidden | 80% hidden | hidden like any other |

Level 1 is the one that teaches: the first verse and chorus stay whole, and only when the music comes
round again do chords start to go. A section is what sits between blank lines, and it counts as a
repeat when its chords match a section already played — so verse 2 repeats verse 1 even though the
words differ. **A song written as one block, with no blank lines between verses, has no repeats to
find, so level 1 leaves it fully visible** (ADR-058).

Which chords get hidden is chosen at random when a playthrough starts and stays fixed for its whole
duration — nothing flickers as you scroll. Hidden chords keep their space on the page, so the chart
never reflows as you progress. **Reset learning progress** puts you back to level 1.

**Lost a chord? Tap the line** and its concealed chords come back for a few seconds, then fade out
again. Revealing is a glance at the answer, not a change of state — your progress is untouched, and
nothing stays revealed. A whole line rather than the one chord you tapped, because a chord is far
too small a target on a phone. Double-tap to jump playback to a line while in learning mode; in the
other modes a single tap still does it.

The **first chord of every line stays visible** at levels 1 and 2, so you keep your place in the line
while the detail goes. That means the share actually hidden can fall short of the nominal
level — the bar reports what is really concealed, not the stage number.

## Installing it

NoChords is installable. On Android the library screen offers **Install app** — browsers stopped
prompting on their own, so the page has to ask (ADR-029). On iOS there is no API for it: use
Share → Add to Home Screen, which the app says in the same place. Installed, it opens without
browser chrome and starts offline: the app shell is precached, and songs are already local (or in
Firestore's own cache when signed in).

A service worker keeps a cache named after the release — `nochords-v0.2.0` — and deletes every
older one when it takes over. **Bump the version before deploying**, or installed apps will keep
serving the previous release from a cache that still looks current:

```bash
npm version patch --no-git-tag-version    # or minor
npm run deploy
```

The full sequence — verify, update the artifact that owns the change, commit granularly, bump,
deploy, then check what is actually live — is in
[`_meta/release-checklist.md`](_meta/release-checklist.md).

A new release installs in the background and takes over on the next cold start, never mid-song. The
version at the foot of the library screen is how you tell what an installed app is actually running.

Icons are generated from the SVGs in `public/icons/`:

```bash
magick -background none icon.svg -resize 512x512 icon-512.png
```

## How it is built

React + TypeScript + Vite, plus Firebase for sync and Lucide for icons. All the real logic is in
pure modules
under `src/lib/`, with React kept to rendering and event wiring:

```text
src/
  lib/         chords, nashville, inline notation, learning, playback, metronome,
               meter, storage, settings, display, pwa
  sw.ts        the service worker, compiled to /sw.js at build time
  hooks/       usePlayback (the clock), useMetronome (audio), useSongLibrary, useSettings
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
`test/test-documentation.md` for test intent. Releasing follows
[`_meta/release-checklist.md`](_meta/release-checklist.md).

## Accounts and sync

Signed out, songs live in this browser's local storage and nothing goes over the network.

Sign in with Google and your library moves to your own Firestore documents, syncing between
devices and working offline through Firestore's local cache. Signing in for the first time with
songs already on the device offers to copy them up; it asks rather than assuming, because
uploading silently is wrong on a borrowed phone and ignoring silently looks like data loss.

Editing does not write on every keystroke — writes settle for 800ms first, and flush when the page
is hidden.

**Security.** Songs are stored at `users/{uid}/songs/{songId}`, and
[`firestore.rules`](firestore.rules) allows read and write only where the signed-in uid matches the
path. Firestore is reached straight from the browser, so the client is not a trust boundary: those
rules are the only thing that actually keeps one account's songs away from another. They are
committed here rather than living as console state.

The Firebase web config in `src/lib/firebase.ts` is public by design — it identifies the project
and grants nothing on its own. The API key comes from `VITE_FIREBASE_API_KEY` (see `.env.example`).
Build without it and the app contains no Firebase at all: sign-in is not offered and everything
stays local.

**Bundle cost.** The SDK is fetched only if someone signs in. The app chunk is 55.8kB gzip; the
Firebase chunk is 183.6kB and is never requested by a signed-out visitor.

## Deploying

The app is a static bundle, hosted on Firebase Hosting. **Pushing to `main` is what deploys** —
see Continuous deployment below. A local `npm run deploy` works, but the next push overwrites it,
so it is for trying something out rather than for releasing.

The client does carry a Firebase web config, including the API key from `VITE_FIREBASE_API_KEY`.
That value is public by design: it names the project and grants nothing on its own, and
`firestore.rules` is what actually keeps one account's songs from another. The service account used
to deploy is a real credential and is a different matter entirely.

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

The build needs `VITE_FIREBASE_API_KEY` in CI, or it produces a bundle with no Firebase in it at
all and sign-in silently disappears from the deployed app. It is public by design, so it is a
**variable**, not a secret:

```bash
gh variable set VITE_FIREBASE_API_KEY --body "<the key from .env>"
```

A push to `main` that would ship without it fails the build rather than deploying, because the app
works perfectly well without sign-in and nothing else would notice.

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
