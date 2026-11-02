# AGENTS.md

The house contract for every AI assistant working in this repository — Cursor,
Claude Code, Copilot, Codex, and whatever replaces them next.

This file is the single contract. `CLAUDE.md` and `.github/copilot-instructions.md`
are pointers to it, not second opinions. When they disagree with this file, this
file wins; fix the pointer.

Humans: the same rules apply to you, in longer form, in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

**Multi-branch repositories.** In a repository with several deploy branches
(`dev`, `preprod`, `prod`, where a push deploys), `main` in this file means
every deploy branch, kept at one SHA.

## 1. Start from the remote tip, never from what is on disk

Several people and several assistants share these repositories, and a cloned
working copy is stale the moment it is made.

```bash
git fetch origin main
git log --oneline origin/main -5
```

Read `origin/main`, branch from `origin/main`, and diff against `origin/main`.
If a file you were told about is missing from the checkout, the checkout is
behind — fetch before you conclude the file does not exist.

Before you write anything, check whether someone else already has uncommitted
work in the tree. `git status` costs nothing and prevents the worst class of
collision.

## 2. Direct to `main` for the owner, pull requests for everyone else

- **The owner pushes directly to `main`.** That is the norm in BAM
  repositories, and the ruleset example allows it: the repository admin role is
  a bypass actor. An assistant working for the owner commits atomically on
  `main` and hands the owner the push; it does not push on its own initiative.
- **Everyone else uses a branch and a pull request** — contributors other than
  the owner, and anyone at all when a ruleset without that bypass protects
  `main`. Branch off `main` and name the branch for the change: `feat/<slug>`,
  `fix/<slug>`, `docs/<slug>`, `chore/<slug>`. One pull request per concern; a
  diff nobody can hold in their head gets approved on trust, and trust is not
  review.
- Never force-push `main`, and never force-push a branch that someone else may
  have pulled.
- Do not merge your own pull request, do not enable auto-merge, and do not
  dismiss a review. A human decides when something lands.

## 3. Respect CODEOWNERS

`.github/CODEOWNERS` says who reviews what. Changing a file under `/.github/`,
`SECURITY.md`, `LICENSE`, `.github/gitleaks.toml`, or `.pre-commit-config.yaml`
changes the rules everyone else works under, so those paths are reviewed
separately and deliberately.

Never edit `CODEOWNERS` to route a review around its owner, and never weaken a
ruleset, a required check, or a secret-scanning gate to make a pull request
mergeable. If a gate blocks the change, the gate has found something.

## 4. No secrets, ever

- No credentials, tokens, private keys, AWS access keys, connection strings, or
  customer identifiers in the tree, in a workflow file, in an issue, or in a
  commit message.
- `gitleaks` is a hard gate. A finding is the bug — fix the change, never relax
  the config to land it.
- Secrets live in AWS Secrets Manager or SSM Parameter Store and are referenced
  by name. Workflows read them through `secrets.*` only.
- If a secret does reach a commit, stop and report it — see
  [`SECURITY.md`](SECURITY.md). Deleting it in a later commit does not remove it
  from history.

Example and placeholder values must be unmistakably fake. `EXAMPLE-NOT-A-REAL-SECRET`
is a placeholder; a plausible-looking key is a liability even when it is invalid.

## 5. Point at doctrine, do not clone it

House doctrine, platform runbooks, and the production CI estate live in the
repositories that own them. Link to them.

- Do not copy a production platform's workflow estate into a repository made
  from this template. It is sized for a production platform and bills runner minutes
  on a repo that has nothing to build yet.
- Do not copy customer trees, customer configuration, or customer names into
  this repository or into anything generated from it.
- Do not vendor another repository's documentation here so it can drift. A link
  that is occasionally stale beats a copy that is silently wrong.

Applies to bundles too: enable a bundle because this repository needs it, not
because another repository has it. See [`wiki/Bundles.md`](wiki/Bundles.md).

## 6. Write in English

Every file, comment, commit message, pull request description, issue, and wiki
page in this repository is written in English, regardless of the language of the
conversation that produced it. Falco reads and reviews these repositories in
English, and a mixed-language tree is unreviewable.

Write plainly. Explain _why_ where the diff cannot. Skip the marketing voice.

## 7. Commits

- Conventional commits: `feat(scope):`, `fix(scope):`, `docs(scope):`,
  `chore(scope):`, `ci(scope):`.
- Atomic, split by concern. One commit per concern.
- **No `Co-Authored-By` trailers and no assistant attribution.** Not in the
  commit message, not in the pull request body, not in a file header. The author
  of record is the human who owns the change.
- Never amend or force-push a commit that is already on `main`.

This one is enforced, not requested. The `attribution guard` job reads every
commit in the pull request, plus its title and body, and fails on an author or
committer address that is not in `.github/attribution-allow.txt`, on an author
or committer **name** that reads as a tool even when the address is fine, on a
`Co-authored-by:` trailer naming anybody else, and on an assistant footer — a
"Generated with …" line, an agent run link, the body markers a tool wraps a
description in. Commit as the human who owns the change, with that human's
name as well as their address, write the title and the description yourself,
and do not touch the allow-list to get a green check: adding the identity you
are running as, or deleting the file, is the one thing the rule exists to stop.

## 8. Before you open the pull request

```bash
pre-commit run --all-files
```

Then fill in the pull request template honestly. The checklist is the review,
not decoration: if you did not verify something, say so under _Notes for the
reviewer_ rather than ticking the box.

## 9. Scope discipline

Do what was asked. Do not reformat files you were not asked to touch, do not
rename things in passing, do not add a dependency to save three lines, and do
not add a workflow that a job in `ci.yml` could have done.

If the task turns out to need something outside its scope, say so and stop —
an unexpected change is worse than an unfinished one.

## 10. Screenshots are mandatory

Every repository shows what it looks like (ADR-0002), and
`scripts/check-screenshots.sh` fails CI and pre-commit when it does not.

- **When anything visible changes, update the screenshot in the same pull
  request** — the page, the CLI output, the report, the form. The check catches
  a missing or orphaned file; only you can catch a stale one.
- **Never put customer data in a screenshot.** No customer names, real people,
  account ids, hostnames, tokens, or production data. Capture from fictional
  fixtures, and look at the image before you commit it — `gitleaks` cannot read
  a PNG.
- Images live in `docs/screenshots/` (`.png`, `.jpg`, `.webp`, at most 600 KB),
  regenerated here with `npm run screenshots`,
  are linked from the README `## Screenshots` section with real alt text, and
  every one is referenced somewhere. Delete an image when you drop its link.
- Do not create `.github/screenshots-exempt` to get a pull request green. It is
  for repositories that genuinely have nothing to show, its reason is reviewed,
  and adding it is the owner's decision, not yours.

## 11. This repository: Arcade

Four browser games (Snake, Pac-Man, a car racing game called Course, and a
Breakout called Casse-briques) deployed to GitHub Pages at
<https://fschmutz.github.io/ARCADE-GAMES/>. Plain HTML, CSS and native ES
modules: no framework, no runtime dependency, no build step. `site/` is the
deployed tree. The repository is public and MIT-licensed.

### Commands

```bash
npm ci
npm run serve        # http://127.0.0.1:4173/ARCADE-GAMES/
npm run check        # lint + typecheck + unit + page contract + all e2e projects
npm run og           # regenerate site/assets/og.png after changing scripts/og-card.html
npm run screenshots  # regenerate docs/screenshots/ from the real site (system Chrome)
node scripts/check-latest.mjs   # needs network; GITHUB_TOKEN lifts the API rate limit
pre-commit run --all-files      # gitleaks, actionlint, hygiene, screenshots, doc surface
```

### Rules that are enforced (do not work around them)

- **Strict CSP on every page**: no inline script, inline style, inline handler
  or third-party origin. JSON-LD data blocks are the only inline `<script>`.
- **Page contract** (`tests/unit/pages.test.js`): title, description,
  canonical, Open Graph, Twitter card, JSON-LD whose `url` equals the
  canonical, one `h1`, the credit line `Lino from Marrakech`, every local
  reference resolving, sitemap = indexable pages, service-worker precache =
  existing files. New page or new asset: update the sitemap and the `PRECACHE`
  list in `site/sw.js`, and bump its `CACHE` version.
- **Game rules are pure.** `site/<game>/rules.js` holds rules and data with no
  DOM and is unit-tested; the canvas loop stays in `site/<game>/<game>.js`.
  Shared behaviour goes in `site/assets/` (`arcade.js`, `audio.js`, `fx.js`),
  never copied into a game.
- **Supply chain**: exact npm pins; actions pinned to a full SHA with
  `# vX.Y.Z`; both at latest stable (`scripts/check-latest.mjs` fails CI
  otherwise). An exception is a named entry in `.dependency-holds.json` with its
  reason, mirrored as an `ignore` in `.github/dependabot.yml`. Remove the hold
  when it clears.
- **Chromium in Playwright is the system Chrome** (`channel: 'chrome'`); only
  WebKit is downloaded.
- **Language**: in-game and page text in French (with accents, no em-dashes);
  code, comments, commit messages and docs in English (§6).
- **Required checks**: the `main` ruleset (`.github/rulesets/main.example.json`)
  requires `Lint, typecheck, end-to-end`,
  `E2E matrix (WebKit desktop, phones, tablet)`, `workflow syntax`,
  `template structure`, `screenshots` and `attribution guard`. Renaming a job
  means updating the ruleset and applying it.
- A new feature comes with its tests; a bug fix comes with the test that would
  have caught it.

### After a deploy

CI smoke-tests every sitemap URL and the 404 once Pages has deployed. Then look
at the live pages, desktop and phone size, dark and light: a green pipeline does
not prove the page is readable.

## Repository map

| Path                 | What it is                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| `site/`              | The deployed site: `index.html`, `404.html`, sitemap, manifest, `sw.js` |
| `site/assets/`       | Shared modules: `arcade.js`, `audio.js`, `fx.js`, icons, `og.png`       |
| `site/<game>/`       | `rules.js` (pure, unit-tested) and the canvas loop `<game>.js`          |
| `tests/unit/`        | `node --test`: rules and the page contract (`pages.test.js`)            |
| `tests/e2e/`         | Playwright: `arcade.spec.js` (desktop), `touch.spec.js` (phones, iPad)  |
| `scripts/serve.mjs`  | Local server mirroring Pages (`/ARCADE-GAMES/` prefix, custom 404)      |
| `scripts/*.mjs`      | Supply-chain gate, social preview and screenshot capture                |
| `scripts/*.sh`       | Template helpers, copied byte for byte: never fork them here            |
| `wiki/`              | The documentation surface. Edit here, never in the GitHub wiki UI.      |
| `wiki/Bundles.md`    | What is on by default, what is an example, how to switch                |
| `.github/workflows/` | Active workflows. Everything here runs.                                 |
| `.github/bundles/`   | Deliberately **inactive** files: `*.disabled`, `*.example`              |
| `.github/rulesets/`  | Branch-protection shape. Documentation, not enforcement.                |
| `docs/screenshots/`  | Screenshots, and nothing else — `docs/` holds no prose                  |
