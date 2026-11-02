# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Follow [`AGENTS.md`](AGENTS.md).** It is the house contract for every assistant
working in this repository, and it is the file to read first and in full. This
page adds only the Claude-specific notes; it does not restate or override it.

The short version, so nothing is a surprise: fetch `origin/main` before you read
or branch, the owner pushes to `main` directly (you commit, the owner pushes)
while other contributors use pull requests, no secrets in the tree,
respect `.github/CODEOWNERS`, write everything in English (in-game and page text
stays French), and no `Co-Authored-By` or assistant attribution in commits. The
Arcade rules (strict CSP, the page contract, pure `rules.js`, supply-chain pins,
system Chrome in Playwright, the required checks) are in `AGENTS.md` §11.

## Claude-specific notes

- **Plan mode on anything that touches `/.github/`.** Workflows, `CODEOWNERS`,
  rulesets, and the gitleaks config change the rules everyone else works under.
  Show the plan before the diff.
- **Prefer reading to guessing.** This tree is small enough to read end to end.
  A grep across it costs less than a wrong assumption about what is in it.
- **Never run `git commit --amend`, `git push --force`, `git rebase` on a pushed
  branch, or `gh pr merge`** unless the instruction to do so was explicit.
- **Do not add "generated with" footers** to commits, pull request bodies, issue
  comments, or files. `AGENTS.md` §7 is not negotiable, and the
  `attribution guard` job fails the pull request on the footer, on a
  `Co-authored-by:` trailer naming anyone outside
  `.github/attribution-allow.txt`, and on an author or committer address that
  is not on that list.
- **Subagents inherit this contract.** If you delegate, restate the constraints;
  a subagent that has not read `AGENTS.md` will happily invent a `docs/`
  directory.
- **One documentation surface.** `wiki/` is it. The only thing allowed under
  `docs/` is `docs/screenshots/` (images, ADR-0002); CI fails on anything else
  there — that is deliberate, not a bug to work around. GitHub Pages serves the
  games from `site/`, not documentation.
- **Screenshots are mandatory** (`AGENTS.md` §10). After a visible change, run
  `npm run screenshots` and Read every PNG before committing it.
- **Bundles are opt-in by design.** Files under `.github/bundles/` end in
  `.disabled` or `.example` on purpose. Do not "fix" them by activating them;
  see [`wiki/Bundles.md`](wiki/Bundles.md) for how enabling is meant to work.

## How the pieces fit

- **`ci.yml` is the gate**, beside `attribution-guard.yml`, which exists only
  because it needs the `edited` trigger. Its Arcade jobs
  (`Lint, typecheck, end-to-end`, the E2E matrix, the Pages deploy) prove the
  games; its template jobs (`workflow syntax`, `template structure`,
  `screenshots`) prove the repository. `template structure` holds a literal list
  of every file the template promises (the `PATHS` heredoc): adding, renaming or
  removing one of them means editing that list in the same commit.
- **`scripts/*.sh` and `scripts/tests/*.sh` are the template's**, copied byte
  for byte from `ScaleMeNow/GITHUB-TEMPLATE`. Change them there and copy them
  again; never fork them here. They must stay executable
  (`git update-index --chmod=+x`).
- **`wiki/` is mirrored, not merged.** `scripts/wiki-sync.sh` (via `wiki.yml` on
  push to `main`) makes the GitHub wiki match `wiki/` exactly, overwriting UI
  edits and deleting pages removed here.

`scripts/apply-ruleset.sh` defaults to a plan; `--apply` changes live branch
protection and is the owner's step, never CI's and never yours unprompted.

## Checks you can run

```bash
npm run check                               # lint, typecheck, unit, page contract, all e2e projects
pre-commit run --all-files                  # gitleaks, actionlint, hygiene, screenshots, doc surface
scripts/check-screenshots.sh                # the screenshot rule on its own
scripts/check-doc-surface.sh                # the one-doc-surface rule on its own
scripts/check-repo-settings.sh              # the live GitHub settings: About, features, merge, ruleset
scripts/tests/attribution-guard-test.sh     # the attribution guard, against its fixtures
scripts/tests/check-doc-surface-test.sh     # the doc-surface check, per link not per line
scripts/apply-ruleset.sh                    # the ruleset plan: every required check must print ok

# CI-only checks, reproduced locally
for f in .github/bundles/*/*.yml.disabled; do actionlint - < "$f"; done
grep -rnE '^\s*(-\s+)?uses:' .github/workflows/ | grep -vE '@[0-9a-f]{40}'   # must print nothing

gh run list --limit 5                       # what CI thought of the last pushes
```
