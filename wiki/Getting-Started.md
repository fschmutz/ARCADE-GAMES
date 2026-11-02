# Getting Started

From a fresh clone to a green pull request, and the repository settings the
pack expects.

> Edit this page at `wiki/Getting-Started.md` in the repository. Changes made in
> the GitHub wiki UI are overwritten by the next sync.

## 1. Run the games

Requires Node 24 or newer and Google Chrome (Playwright drives the system
Chrome; only WebKit is downloaded).

```bash
git clone https://github.com/fschmutz/ARCADE-GAMES.git && cd ARCADE-GAMES
npm ci
npx playwright install webkit   # once, for the Safari-engine projects
npm run serve                   # http://127.0.0.1:4173/ARCADE-GAMES/
```

`scripts/serve.mjs` mirrors GitHub Pages: the site answers under
`/ARCADE-GAMES/`, and an unknown path gets the branded 404.

## 2. Install the hooks

```bash
pipx install pre-commit
pre-commit install
pre-commit run --all-files
```

`gitleaks` blocks secrets, `actionlint` blocks workflow files that would only
fail once pushed, and the two local hooks run `scripts/check-screenshots.sh`
and `scripts/check-doc-surface.sh`. The hook revisions are frozen to commit
SHAs, and Dependabot keeps them moving.

## 3. The checks every change passes

```bash
npm run check                   # lint, typecheck, unit tests, page contract, every e2e project
node scripts/check-latest.mjs   # every action and npm pin at its latest release (needs network)
```

In CI, every pull request runs:

| Check                                         | Workflow                | What it proves                                                                                  |
| --------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `Lint, typecheck, end-to-end`                 | `ci.yml`                | supply chain, `npm audit`, oxlint, strict TypeScript, unit tests, page contract, desktop Chrome |
| `E2E matrix (WebKit desktop, phones, tablet)` | `ci.yml`                | desktop WebKit, then layout and touch on a Pixel 7, iPhone 15, iPhone SE and iPad               |
| `workflow syntax`                             | `ci.yml`                | every workflow parses, the disabled bundle workflows included                                   |
| `template structure`                          | `ci.yml`                | the template's files are present, scripts executable, actions pinned, one doc surface           |
| `screenshots`                                 | `ci.yml`                | the README shows the site, and every image is referenced and small                              |
| `attribution guard`                           | `attribution-guard.yml` | every commit and the pull request text belong to a human on the allow-list                      |

`dependency review` and `label by path` run only on the pull requests they
apply to, so they are never required checks.

A visible change also updates the screenshots: `npm run screenshots`, then look
at every image before committing it.

## 4. Repository settings

The pack expects these on the live repository. `scripts/check-repo-settings.sh`
reads all but the Pages source and prints `ok`, `FAIL` or `DECLARED` for each:

| Where                              | Expected                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ |
| About                              | a description, at least one topic, and the Pages URL as the website      |
| Settings → General → Features      | Wikis and Issues on; Projects and Discussions off                        |
| Settings → General → Pull Requests | squash merge only; automatically delete head branches                    |
| Settings → Advanced Security       | secret scanning, push protection, and private vulnerability reporting on |
| Settings → Pages                   | source: GitHub Actions (the `Deploy to GitHub Pages` job)                |

```bash
./scripts/check-repo-settings.sh
```

`--apply` sets the About box and the feature and merge settings; it is the
owner's step. A setting that does not hold here on purpose is declared with its
reason in `.github/repo-settings-exceptions.txt`.

## 5. Apply the ruleset

`.github/rulesets/main.example.json` is **documentation, not enforcement**.
`scripts/apply-ruleset.sh` plans by default, and checks every required check
against the job names the workflows really produce:

```bash
./scripts/apply-ruleset.sh                # what it would do, and nothing else
./scripts/apply-ruleset.sh --apply        # create it, or update it in place
```

It requires the six checks in the table above except the path-filtered ones.
The repository admin role is a bypass actor: the owner pushes to `main`
directly, and everyone else goes through a pull request, a CODEOWNERS review
and the required checks. Requiring a check that never reports blocks every pull
request, so fix anything the plan prints as `UNKNOWN` before applying.

## 6. Publish the wiki

The wiki repository already exists, so the sync works from the first push that
touches `wiki/`. Run it by hand (Actions → `wiki` → _Run workflow_ on `main`)
whenever a push was skipped: the paths filter needs a before/after comparison,
and a force push has none.

If a run fails with a 403 while pushing, Wikis have been turned off again, or
the job lost `permissions: contents: write`.

## Where to go next

- [Home](Home) — the games, the screenshots, how this wiki is generated
- [Bundles](Bundles) — what is on, what is off, how to switch
- The house template this pack is adopted from, `ScaleMeNow/GITHUB-TEMPLATE`,
  carries the full guide for a repository made from scratch
