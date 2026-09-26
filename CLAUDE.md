# CLAUDE.md

Guidance for AI assistants working in this repository. Human contributors: see
[CONTRIBUTING.md](CONTRIBUTING.md), which says the same things.

## What this is

Three browser games (Snake, Pac-Man, a car racing game called Course) deployed to
GitHub Pages at https://fschmutz.github.io/ARCADE-GAMES/. Plain HTML, CSS and native ES
modules: no framework, no runtime dependency, no build step. `site/` is the deployed tree.

## Layout

```
site/index.html, 404.html, sitemap.xml, llms.txt, manifest.webmanifest, sw.js
site/assets/arcade.js   DOM lookup, storage, theme, overlay, option pickers, input, canvas fit
site/assets/audio.js    Web Audio synthesis (no audio files), mute toggle
site/assets/fx.js       particles, shake, flash, floating text, vibration (reduced-motion aware)
site/<game>/rules.js    pure rules and data, no DOM: unit-tested
site/<game>/<game>.js   canvas game loop
tests/unit/             node --test: rules + page contract (pages.test.js)
tests/e2e/              Playwright: arcade.spec.js (desktop Chrome + WebKit), touch.spec.js (phones, tablet)
scripts/serve.mjs       local server mirroring Pages (/ARCADE-GAMES/ prefix, custom 404)
scripts/check-latest.mjs  supply-chain gate
scripts/make-og.mjs     renders the social preview image
```

## Commands

```bash
npm ci
npm run serve        # http://127.0.0.1:4173/ARCADE-GAMES/
npm run check        # lint + typecheck + unit + page contract + all e2e projects
npm run og           # regenerate site/assets/og.png after changing scripts/og-card.html
node scripts/check-latest.mjs   # needs network; GITHUB_TOKEN lifts the API rate limit
```

## Rules that are enforced (do not work around them)

- **Strict CSP on every page**: no inline script, inline style, inline handler or third-party
  origin. JSON-LD data blocks are the only inline `<script>`.
- **Page contract** (`tests/unit/pages.test.js`): title, description, canonical, Open Graph,
  Twitter card, JSON-LD whose `url` equals the canonical, one `h1`, the credit line
  `Lino from Marrakech`, every local reference resolving, sitemap = indexable pages,
  service-worker precache = existing files. New page or new asset: update the sitemap and
  the `PRECACHE` list in `site/sw.js`, and bump its `CACHE` version.
- **Supply chain**: exact npm pins; actions pinned to a full SHA with `# vX.Y.Z`; both at
  latest stable. An exception is a named entry in `.dependency-holds.json` with its reason,
  mirrored as an `ignore` in `.github/dependabot.yml`. Remove the hold when it clears.
- **Chromium in Playwright is the system Chrome** (`channel: 'chrome'`); only WebKit is downloaded.
- **Language**: in-game and page text in French (with accents, no em-dashes); code, comments,
  commit messages and docs in English.
- **Branch protection** requires the CI jobs `Lint, typecheck, end-to-end` and
  `E2E matrix (WebKit desktop, phones, tablet)`. Renaming a job means updating the rule.

## After a deploy

CI smoke-tests every sitemap URL and the 404 once Pages has deployed. Then look at the
live pages, desktop and phone size, dark and light: a green pipeline does not prove the
page is readable.
