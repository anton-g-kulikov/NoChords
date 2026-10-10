# Security and performance audit: rendering user input

Date: 2026-10-10. Against main at 05d8462 (v1.1.0); line references are to that commit. Scope: every path by which text a person types, pastes, stores, or syncs reaches
the screen, the scheduler, or Firestore. Read: all of `src/`, `firestore.rules`, `firebase.json`,
`index.html`, the service worker. Probed: parser and scheduler with adversarial inputs under
Vitest; the dev build in a browser; the production site's response headers.

## Resolution

Every finding was fixed on `claude/user-input-rendering-audit-4aba8e` in the days after the audit,
one commit per finding, each reviewed by the audit session against the finding it closes. The
line references below are to the pre-fix code and are kept as the record of what was found; the
commits are where the code is now. ADR-108 records the decisions.

| # | Finding | Fixed in | Follow-ups |
|---|---------|----------|------------|
| 1 | Unbounded meter and bar count | ead1bb2 | c8a50e5 (tempo clamp, whole bars, earlier `{n/d}` kept) |
| 2 | No security headers | c2a36db, report-only | d4cb642 (`style-src 'self'`, wake lock guarded); enforcing waits on the manual sign-in pass in ADR-108 |
| 3 | Firestore rules unconstrained | b9ce632, not yet deployed | 1f41c43 (client caps rows at 1000 and text at 200,000 first) |
| 4 | Per-frame re-render | fed354d | |
| 5 | Unvalidated song id | 1c83c84 | |
| 6 | Theme script trusts storage | f0699c6 | |
| 7 | No title cap | bd8be72 | 1f41c43 (cut by characters, keys normalised) |
| 8 | Language rescans | b785d9c | bd5aea4 (test counts work, not time) |
| | ADR-108 and test documentation | abfa219 | |

On the finished series (abfa219): typecheck clean, 419 tests pass, and the audit's probes no longer
reproduce. One residual, found while reviewing 1f41c43 and left for a follow-up: the 200,000
character text cap keeps ordinary songs far under Firestore's 1 MiB document limit (a chord every
13 characters encodes to about 0.53 MiB), but a pathological paste with a chord every three or four
characters encodes to 1.2 to 1.5 MiB and would still be refused by Firestore. The durable fix for
that whole class is to tell the person when a write is refused instead of swallowing it in the
library's flush; a lower text cap (around 100,000) closes this instance on its own.

## Summary

The classic injection surface is clean. There is no `innerHTML`, no `dangerouslySetInnerHTML`, no
`eval`, no user-controlled `href` or `style` string, and every piece of stored or synced data is
funnelled through one validator (`sanitizeSong`) before it reaches React. All chord and markup
regular expressions run in linear time on 100 k-character hostile strings. The Firestore rules are
deny-by-default and scope every document by the owner's uid in the path.

What is not clean is **bounds**. The inline notation lets a song say `{99999999/4}` or `|999999999|`,
the validator lets a stored song carry `barsPerLine: 1e308`, and three consumers trust those numbers:
the beat strip draws one DOM node per beat in the bar, the metronome scheduler loops over every
beat of a row on every 25 ms tick, and the schedule multiplies them into durations. One line of
song text freezes the tab. The second gap is that the production site sends no Content Security
Policy and no framing or MIME-sniffing headers, so React's escaping is the only layer between a
future rendering bug and script execution.

| # | Finding | Severity | Kind |
|---|---------|----------|------|
| 1 | Unbounded meter numerator and bar count hang the player | High | Performance / DoS |
| 2 | No CSP, `frame-ancestors`, `X-Content-Type-Options` or `Referrer-Policy` on hosting | Medium | Security |
| 3 | Firestore rules do not constrain document shape or size | Medium | Security / cost |
| 4 | Per-frame re-render re-parses every chord in the song | Medium | Performance |
| 5 | Song id from local storage is used unvalidated as a Firestore path segment | Low | Robustness |
| 6 | Inline theme script trusts `localStorage` without the app's allow-list | Low | Security hygiene |
| 7 | Title has no length cap, anywhere | Low | Robustness |
| 8 | Library language detection rescans all lyrics three times per render | Low | Performance |

---

## 1. Unbounded meter numerator and bar count hang the player (High)

**Where.**
- [src/lib/inline.ts:23](../src/lib/inline.ts#L23) and [:26](../src/lib/inline.ts#L26): `|(\d+)|` and `{n/d}` accept any digit string; [:38-47](../src/lib/inline.ts#L38-L47) keep any finite positive value.
- [src/lib/meter.ts:29](../src/lib/meter.ts#L29): `parseMeter` requires `beatsPerBar >= 1` and nothing else.
- [src/lib/storage.ts:55-59](../src/lib/storage.ts#L55-L59), [:85](../src/lib/storage.ts#L85), [:142-148](../src/lib/storage.ts#L142-L148): `bars` and `barsPerLine` are accepted as any finite number, including negative and `1e308`. The same validator reads Firestore, so a song written on one device reaches every other.
- Consumers: [src/components/BeatStrip.tsx:51](../src/components/BeatStrip.tsx#L51) and [:71](../src/components/BeatStrip.tsx#L71) render `pulse.beatsPerBar` spans; [src/lib/metronome.ts:186-191](../src/lib/metronome.ts#L186-L191) loop `for (offset = 0; offset < entry.beats; …)` for every row overlapping the lookahead window, on every 25 ms tick ([src/hooks/useMetronome.ts:217-259](../src/hooks/useMetronome.ts#L217-L259)); [src/lib/playback.ts:118-119](../src/lib/playback.ts#L118-L119) multiply into `beats` and `durationMs`.

**Measured.**

| Input | Effect |
|-------|--------|
| `{99999999/4}[C]la` | `beats = 99 999 999`, `pulse.beatsPerBar = 99 999 999` dots to render; `beatsInWindow` 216 ms per 25 ms tick |
| `[C]la\|999999999\|` | `beats = 3 999 999 996`; `beatsInWindow` **15.1 s per 25 ms tick** with the click on |
| `{20000/4}[C]la la la` in the browser | 20 000 `.beat-strip__beat` nodes, 82 ms per frame, song length "888:53" |
| stored `barsPerLine: 1e308` | `durationMs = Infinity`, `beats = Infinity`; `formatTime` shows `Infinity:NaN` |
| stored `rows[].meter: "1000000/4"` | accepted |

A song is shared by pasting text (the public archive, ADR-090), so this is reachable by anyone a
person copies a chart from, not only by the person themselves. With the metronome sound on (the
default, ADR-083) the second payload makes the tab unresponsive the moment Play is pressed.

**Fix.** Bound the numbers at the three doors and make the scheduler arithmetic, not iterative:
- `parseMeter`: reject `beatsPerBar > 32` (the editor offers at most 12; 32 is generous for anything written).
- `parseInlineRow` and `sanitizeRow`/`sanitizeSong`: cap `bars` and `barsPerLine` at the editor's own maximum of 64 ([src/components/SongEditor.tsx:130](../src/components/SongEditor.tsx#L130)); reject non-integers and negatives rather than passing them to `Math.max` guards downstream.
- `beatsInWindow`: compute the first and last offset in the window directly, `Math.max(0, Math.ceil((fromMs - entry.startMs) / beatMs))` to `Math.min(entry.beats, Math.ceil((toMs - entry.startMs) / beatMs))`, so cost is proportional to beats in the window, not beats in the row.
- `BeatStrip`: clamp `showing` as a last line of defence.
Tests to add: a parser test that `{999999/4}` and `|9999|` fall back to the song default, and a metronome test that `beatsInWindow` on a 1e9-beat row returns in under a millisecond.

## 2. No security headers on hosting (Medium)

**Where.** [firebase.json:15-61](../firebase.json#L15-L61) sets only `Cache-Control`. Confirmed live on `https://songs.nochords.app/`: the response carries `strict-transport-security` and nothing else.

**Risk.** Today nothing renders HTML from user input, so this is not exploitable now. It is the layer that turns a future mistake (a Markdown renderer for lyrics, a dependency that sets `innerHTML`, a stored-XSS bug in a Firebase SDK) from "script runs with the user's Firestore token" into "blocked and reported". Without `frame-ancestors` any site may frame the app; the destructive actions are behind `window.confirm` and a re-auth popup, so clickjacking impact is low, but the header is free. Without `X-Content-Type-Options: nosniff` an asset served with the wrong type can be sniffed as script.

**Fix.** Add a `"source": "**"` block to `firebase.json` with:

```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'sha256-<hash of the index.html theme script>'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com; font-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firebaseinstallations.googleapis.com; frame-src https://nochords-18219.firebaseapp.com https://accounts.google.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Run it report-only for a release to catch what Firebase Auth's popup flow and the native shells
(`capacitor://localhost`) need, then switch to enforcing. `style-src 'unsafe-inline'` can be
dropped if the two `style={{…}}` props in `Player.tsx` and the textarea height in `SongEditor.tsx`
are confirmed to go through the CSSOM (React does; worth verifying in the report-only phase). The
inline script in [index.html:20-37](../index.html#L20-L37) either gets a hash or moves to a tiny
external file.

## 3. Firestore rules do not constrain document shape or size (Medium)

**Where.** [firestore.rules:14-17](../firestore.rules#L14-L17): `allow read, write: if request.auth.uid == userId`, nothing about `request.resource.data`.

**Risk.** Isolation between users is correct. But any signed-in user, or a script holding their token, can write an unlimited number of documents of up to 1 MiB each with any fields. That is a storage and bandwidth bill against the project with no ceiling but Firebase's project quotas. Secondarily, a document that is not a song is silently dropped on every other device (`readSongs`), and because one bad row rejects the whole song ([src/lib/storage.ts:173](../src/lib/storage.ts#L173)) a single corrupt row written by an older client makes the song vanish from the library with no message.

**Fix.** Validate on write, mirroring `sanitizeSong` and the exact field list `songToDoc` emits
([src/lib/songDoc.ts:20-45](../src/lib/songDoc.ts#L20-L45)). The list must include `openedAt`,
which v1.1.0 added for library sorting (ADR-106) and which every current client writes as a number
or `null`; a rule without it would reject every save.

```
function isSong(d) {
  return d.keys().hasOnly(['id','title','originalKey','currentKey','tempo','tempoUnit',
                           'barsPerLine','meter','displayMode','learningPlaythrough',
                           'openedAt','rows'])
    && d.id == songId
    && d.title is string && d.title.size() <= 200
    && d.tempo is number && d.tempo >= 20 && d.tempo <= 300
    && d.barsPerLine is int && d.barsPerLine >= 1 && d.barsPerLine <= 64
    && (d.openedAt == null || d.openedAt is number)
    && d.rows is list && d.rows.size() <= 1000;
}
allow create, update: if request.auth != null && request.auth.uid == userId
                      && isSong(request.resource.data);
```

Per-row validation inside a list is not expressible in rules; the row count cap plus the 1 MiB
document limit bounds the worst case. Consider Firebase App Check for the web app as a second
abuse control. Document the rule changes as an ADR (ADR-108), since ADR-021 promises a one-liner. Any field added to `Song` later must be added to the rule in the
same change, or saves start failing on deploy.

## 4. Per-frame re-render re-parses every chord (Medium)

**Where.** [src/hooks/usePlayback.ts:108-124](../src/hooks/usePlayback.ts#L108-L124) sets `elapsedMs` state every animation frame. That re-renders `Player`, which re-renders every `SongRowView` ([src/components/Player.tsx:590-615](../src/components/Player.tsx#L590-L615)); each row re-sorts its chords in `rowSegments`, re-runs `transposeChord` or `toNashville` per chord in `chordSymbolFor`, and re-runs the `chordParts` regexes ([src/components/SongRowView.tsx:43-62](../src/components/SongRowView.tsx#L43-L62)). `const now = Date.now()` at [Player.tsx:266](../src/components/Player.tsx#L266) changes every render, so a `React.memo` on the row would not help as written.

**Measured.** Not isolated: the 82 ms frame above was dominated by finding 1. The per-chord work is microseconds each, so a 60-line, 200-chord song costs well under a frame on a laptop. On a low-end phone, in the mode this app is for (a chart propped on a stand, screen on, playing for minutes), it is sustained CPU on every frame for work whose inputs change only on a key or mode change.

**Fix.** Memoise what does not move per frame: compute the per-row segments and display symbols in a `useMemo` keyed on `[song.rows, song.originalKey, song.currentKey, mode]`; derive a `revealedRowIds` set once per render and pass a boolean, so `SongRowView` can be `React.memo`'d; keep `activeIndex` as a class on the `<li>` (already the case). The frame loop then re-renders a list of memoised rows, which React skips.

## 5. Song id used unvalidated as a Firestore path segment (Low)

**Where.** [src/lib/storage.ts:134](../src/lib/storage.ts#L134) accepts any non-empty string as `id`; [src/lib/cloudStore.ts:45](../src/lib/cloudStore.ts#L45) and the import path in `useSongLibrary` pass it to `doc(db, 'users', uid, 'songs', song.id)`.

**Risk.** Self-inflicted only (requires editing `localStorage`). An id containing `/` makes the SDK throw; the error is swallowed, the song never uploads, and the import offer returns on every load with no explanation. Ids matching `__.*__` are reserved by Firestore and rejected server-side the same way.

**Fix.** In `sanitizeSong`, require `/^[A-Za-z0-9_-]{1,128}$/` for `id` (the app's own ids are `song-<base36>-<n>-<base36>` and always match), or regenerate ids during import.

## 6. Inline theme script trusts `localStorage` (Low)

**Where.** [index.html:25-27](../index.html#L25-L27) copies `settings.accent` into `data-accent` on the root if it is any string, whereas the app validates it with `isAccentName` ([src/lib/accent.ts:45](../src/lib/accent.ts#L45)).

**Risk.** Same-origin storage, attribute value only, no selector injection possible through `dataset`. Purely hygiene, and it matters when finding 2 hashes this script: keep it small and strict. Check against the seven names inline.

## 7. Title has no length cap (Low)

**Where.** [src/App.tsx:179-185](../src/App.tsx#L179-L185) has no `maxLength`; `sanitizeSong` accepts any string; the title is rendered in the library list, the header `<h1>`, the delete confirm, and scanned by `songLanguage`.

**Fix.** `maxLength={200}` on the input and truncate (do not reject) in `sanitizeSong`, in step with the rule in finding 3.

## 8. Language detection rescans all lyrics per render (Low)

**Where.** [src/components/SongList.tsx:80-82](../src/components/SongList.tsx#L80-L82) calls `offersLanguageChoice`, `effectiveLanguageFilter` (which calls it again) and `filterByLanguage`, each of which runs two Unicode-property regexes over every song's title and lyrics ([src/lib/language.ts:45-52](../src/lib/language.ts#L45-L52)). Since v1.1.0 the result is also sorted on every render by `sortSongs`, which is cheap and not the concern here.

**Measured.** 22 ms for 20 000 lines. A real library of fifty songs is about a millisecond, so this is a tidy-up: `useMemo` a `Map<songId, SongLanguage | null>` over `songs` and feed it to the three helpers.

---

## Checked and found sound

- **HTML injection.** No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `srcdoc`, or `DOMParser` anywhere in `src/`. All user strings reach the DOM as React text children or `title`/`aria-label` attributes, which React escapes.
- **Links.** Every `href` is a constant; every external link has `rel="noopener noreferrer"`.
- **Regular expressions.** `SUFFIX_RE`, `CHORD_RE`, `LETTER`, `NUMERAL`, `CHORD_TAG`, `BARS_TAG`, `METER_TAG`, the Cyrillic/Latin counters: all under 1 ms on 100 k-character adversarial inputs (`C` + 100 000 × `m` + `!`, 100 000 slashes, 30 000 × `maj`). No nested quantifiers over overlapping alternatives.
- **Bulk text.** Pasting 20 000 lines parses in 47 ms; one keystroke in a 20 000-line song re-parses in 18 ms; a 2 MB single line in 2 ms; a million unbalanced brackets in 7 ms. `textToRows` on every keystroke is fine at any realistic size.
- **Numeric inputs.** `commitValue` rejects exponents, trailing dots and out-of-range values; `msPerBar` floors the tempo at 20 so a stored `tempo: -5` cannot divide by zero; `levelFor` and `ruleFor` clamp a stored `learningPlaythrough` of any sign.
- **Storage trust boundary.** `localStorage` and Firestore share `sanitizeSong`; settings share `sanitize` with an allow-list for every enum. Unknown `displayMode`, `tempoUnit`, `theme`, `accent`, `metronomeVoice`, `librarySort` fall back to defaults. The v1.1.0 `openedAt` field is read as a finite number or `null` and only ever compared, never rendered.
- **Secrets.** `.env.example` only; the Firebase API key is public by design and the config says so. No credentials in git.
- **Service worker.** Cross-origin and non-GET requests pass through untouched; opaque responses are never cached; each release owns its cache.
- **Account deletion.** Requires fresh re-authentication, deletes songs before the user, batches at 500.

## Suggested order of work

1. Finding 1: bounds in `parseMeter`, `parseInlineRow`, `sanitizeSong`, and the arithmetic `beatsInWindow`. Small, test-covered, closes the only reachable hang.
2. Finding 2 in report-only mode with the next deploy; enforce one release later.
3. Finding 3 alongside finding 7, with an ADR amending ADR-021.
4. Findings 4, 5, 6, 8 as housekeeping.
