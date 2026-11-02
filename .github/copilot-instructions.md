# Copilot instructions

The full house contract is [`AGENTS.md`](../AGENTS.md). Read it when a change is
bigger than a line. What follows is the same contract, compressed to what fits
in a suggestion window.

## Always

- **Fetch first.** Work from `origin/main`, not from whatever the checkout holds.
  In multi-branch repositories (`dev`, `preprod`, `prod`), `main` means every
  deploy branch, kept at one SHA.
- **Owner direct, everyone else by pull request.** The owner pushes to `main`
  directly (admin bypass in the ruleset); other contributors branch
  `feat|fix|docs|chore/<slug>` and open a pull request. Never push on your own
  initiative, never force-push `main` or a shared branch, never self-merge.
- **English.** Every file, comment, commit, and issue, whatever language the chat
  was in.
- **Conventional commits**, one concern each: `feat(scope): ...`.
- **No `Co-Authored-By`, no assistant attribution**, anywhere. The
  `attribution guard` job checks every commit and the pull request body against
  `.github/attribution-allow.txt` and fails on anything else.
- **No secrets.** No tokens, keys, connection strings, or customer identifiers —
  not in code, not in workflows, not in comments. Placeholders must be obviously
  fake, like `EXAMPLE-NOT-A-REAL-SECRET`. `gitleaks` blocks the commit, and a
  finding is the bug.
- **Respect `.github/CODEOWNERS`.** Never reroute a review, weaken a ruleset, or
  relax a gate to make a pull request mergeable.
- **Screenshots are mandatory.** Update `docs/screenshots/` when anything visible
  changes; never show customer data in one; never add
  `.github/screenshots-exempt` to get green.

## Never

- Add documentation under `docs/`. `wiki/` is the only documentation surface;
  `docs/screenshots/` holds images and nothing else, and CI fails on anything
  else under `docs/`.
- Activate anything under `.github/bundles/`. Those files end in `.disabled` or
  `.example` deliberately — see [`wiki/Bundles.md`](../wiki/Bundles.md).
- Copy the BAM-PROD-ENGINE CI estate, house doctrine, or customer trees into
  this repository. Link to the repository that owns them instead.
- Add a workflow when a job in `.github/workflows/ci.yml` would do.
- Pin an action to a tag. Every `uses:` is a full commit SHA with a version
  comment; CI enforces it.

## This repository: Arcade

Four browser games on GitHub Pages; `site/` is deployed as is. Details in
[`AGENTS.md`](../AGENTS.md) §11.

- **Strict CSP on every page**: no inline script, inline style, inline handler,
  or third-party origin. JSON-LD data blocks are the only inline `<script>`.
- **Page contract** (`tests/unit/pages.test.js`): title, description,
  canonical, Open Graph, Twitter card, JSON-LD `url` = canonical, one `h1`, the
  credit line `Lino from Marrakech`. A new page or asset updates the sitemap and
  the `PRECACHE` list in `site/sw.js`, and bumps its `CACHE` version.
- **No runtime dependency, no build step.** Game rules in `site/<game>/rules.js`
  (pure, no DOM, unit-tested); shared behaviour in `site/assets/`.
- **Exact pins, at latest stable**, npm and actions alike; an exception is a
  named hold in `.dependency-holds.json`, mirrored in `.github/dependabot.yml`.
- **Playwright uses the system Chrome** (`channel: 'chrome'`).
- In-game and page text in French (accents, no em-dashes); everything else in
  English.
- `npm run check` before a pull request; `npm run screenshots` after a visible
  change.

## Workflow conventions

```yaml
permissions:
  contents: read # start here, widen per job, never at file scope
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

## Before opening a pull request

Run `pre-commit run --all-files`, then fill in the pull request template
honestly. If you did not verify something, say so rather than ticking the box.
