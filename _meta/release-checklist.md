# Release Checklist

What has to be true before a change reaches the deployed app, and in what order. Each step exists
because skipping it has gone wrong at least once.

## 1. Verify

```bash
npm run typecheck && npm test && npm run build
```

All three, not just the tests. Typecheck catches the callers a signature change broke; the build is
the only thing that exercises the service-worker plugin.

## 2. Update the artifact that owns the changed concept

Not "write docs" — update the one place that owns what changed:

| What changed | What to update |
|---|---|
| A decision, or a tradeoff someone will question later | a new ADR in `architecture-decisions.md` |
| Behaviour under test | the case table in `test/test-documentation.md` |
| Anything a user sees or types | `README.md` |
| Task state | `project-task-list.md` |

A case added to a test file and not to the table is a case nobody can find. An ADR written after the
fact is a decision nobody can question.

## 3. Commit granularly

One topic per commit, each standing on its own:

- Split by what changed conceptually, not by file. Several logical changes in one file means saving
  the final version, writing the earlier commit's intermediate state, verifying at that state, then
  restoring — not lumping them together.
- **Verify each commit's own state**, so no commit contains tests that contradict its own code.
- Order so each commit works: the web manifest had to land before the service worker that
  precaches it, because `cache.addAll` rejects wholesale on a single missing file.
- Say why in the message, not what. The diff already says what.

## 4. Bump the version

```bash
npm version patch --no-git-tag-version    # or minor
```

Then commit it as `chore: release vX.Y.Z`.

**This is not optional.** The service worker names its cache after the version (ADR-028). Ship
without bumping and every installed app keeps serving the previous release from a cache that still
looks current — and there is no way to tell them otherwise, short of asking people to clear site
data.

## 5. Deploy by pushing

```bash
git push origin main
```

CI builds and deploys every push to `main`. A local `npm run deploy` is not a release: the next
push overwrites it, which is exactly how three keyless builds reached production — each one a push
of mine quietly redeploying over a manual deploy I had just verified.

The build needs `VITE_FIREBASE_API_KEY`, which in CI comes from the repository variable of that
name, not from your `.env`. Without it the bundle contains no Firebase whatsoever (ADR-023) and
sign-in vanishes with nothing failing. The workflow now checks the built bundle and refuses to
deploy rather than shipping that.

## 6. Verify what is actually live

The deploy succeeding does not mean the right thing is deployed — and check *after CI has
finished*, not after a local deploy, or you are looking at bytes that are about to be replaced.

```bash
B=https://nochords-18219.web.app
js=$(curl -s $B/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js')
curl -s $B$js | grep -c firebaseapp        # 1 = sign-in shipped, 0 = built without the key
curl -s $B/sw.js | grep -o '"[0-9]*\.[0-9]*\.[0-9]*"' | head -1   # the version now cached
curl -s -o /dev/null -w '%{content_type}\n' $B/manifest.webmanifest  # must be manifest+json
```

That last one matters: hosting rewrites `**` to `/index.html`, so a missing file answers `200` with
the app shell. Checking the status code proves nothing — check the content type.

On a phone, hard-reload once before judging anything: a page with no service worker needs a fresh
navigation to pick one up.
