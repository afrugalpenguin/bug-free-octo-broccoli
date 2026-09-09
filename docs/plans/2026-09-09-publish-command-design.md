# One command to publish

*2026-09-09. Issue #69.*

Change a food, run one command, and the live site is right.

```sh
node tools/publish.mjs
node tools/publish.mjs "fix(foods): pack data for passata"
node tools/publish.mjs --dry-run
```

## Why

GitHub Pages serves `docs/` from `main` and publishes whatever is committed,
without checking that the page matches `data/`. There are no pre-commit or
pre-push hooks and no CI - only the global `commit-msg` hook. So a forgotten
`node tools/build.mjs` puts stale numbers on a live site, silently. That
happened between #66 and #63 and took #68 to fix.

Four commands in the right order is the problem. One command is the fix.

## The pipeline

In order, stopping at the first failure and committing nothing:

1. **Preflight.** On `main`? Message valid? Anything modified outside `data/`,
   `docs/` and `tools/`? All checked before any work, so a bad message costs
   nothing.
2. **`git pull --ff-only`.** If `main` has moved, find out now rather than after
   a build.
3. **Audit.** `audit.mjs` exits non-zero on FAIL. This is the real gate - I am
   not reviewing the data myself, so this stands in for the review.
4. **Build.**
5. **Tests.** Both suites, against the page just built.
6. **Commit and push to `main`.**

Staging is explicit - `data/`, `docs/`, `tools/` - never `git add -A`, so an
untracked scratch file cannot ride along.

### Straight to main, deliberately

This skips the branch and PR workflow I use everywhere else. That is the
decision, not an oversight. I am not reviewing data changes, so a PR would be a
rubber stamp on numbers I have not read; the audit is what actually checks
anything. `main` is unprotected and I am the only committer.

## The timestamp

`build.mjs` rewrites a footer timestamp every run, so a no-op rebuild looks like
a change. The page is compared to HEAD ignoring that line:

| Situation | What happens |
|---|---|
| Nothing changed | Revert the page, say so, exit 0 |
| Data changed, page unchanged | Commit the data, revert the timestamp-only page |
| Real changes | Commit both |

Running it twice in a row is safe and the second run is a no-op, rather than an
empty or timestamp-only commit.

## The message

Optional. A message I pass is used verbatim. Omitted, one is derived from the
files that changed:

| Changed | Message |
|---|---|
| page only | `chore(data): rebuild the page` |
| `foods.json`, `products.json` | `chore(data): update foods and products` |
| anything in `tools/` | `chore(tools): update the build` |

Both paths are validated against the hook's real rule -
`^(feat|fix|docs|refactor|test|chore|build|ci|perf|style)\(.+\): .+`, 72
characters, and no attribution trailer - so a generated message can never be the
thing that breaks my own hook. The derived message is truncated to fit.

## Verification

The command's job is a side effect on `main`, which cannot be tested by running
it. So the decision logic is pulled out as pure exported functions:

```js
export function validateMessage(msg)           // -> {ok, reason}
export function fallbackMessage(changedFiles)  // -> "chore(data): ..."
export function isTimestampOnly(before, after)
```

`tools/test-publish.mjs` covers them without touching git:

- `validateMessage` accepts a good message and rejects the four ways the hook
  actually fails - missing scope, unknown type, 73-character subject, and an
  attribution trailer.
- `fallbackMessage` always returns something `validateMessage` accepts,
  including with no files and with a list long enough to blow 72 characters.
- `isTimestampOnly` is true for a footer-only diff and false when a macro line
  moved - the exact distinction that went wrong today.

`--dry-run` does everything except commit and push, which is how the real
pipeline gets checked end to end without publishing.
