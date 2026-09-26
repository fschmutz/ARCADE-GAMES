# Contributing

Thanks for wanting to help. Bug reports, ideas and pull requests are welcome.

## Run it

```bash
npm ci
npm run serve      # http://127.0.0.1:4173/ARCADE-GAMES/
npm run check      # everything CI runs, except the WebKit matrix
npx playwright install webkit && npx playwright test   # full device matrix
```

Requires Node 24 or newer and Google Chrome.

## Ground rules

- **No runtime dependency and no build step.** `site/` is deployed as is. Plain HTML, CSS
  and native ES modules.
- **Game rules go in `site/<game>/rules.js`** (pure, no DOM) with a unit test in
  `tests/unit/`. The canvas loop stays in `site/<game>/<game>.js`.
- **Shared behaviour goes in `site/assets/`** (`arcade.js`, `audio.js`, `fx.js`), never copied
  into a game.
- **Every page keeps the page contract**: title, description, canonical, Open Graph,
  JSON-LD, strict CSP, one `h1`, the credit line. `tests/unit/pages.test.js` enforces it.
- **In-game text is French**, code, comments and docs are English.
- **Pin exact versions.** CI fails when a dependency or an action is behind its latest
  release; if one genuinely has to wait, declare it in `.dependency-holds.json` with the reason.
- A new feature comes with its tests; a bug fix comes with the test that would have caught it.

## Pull requests

Keep them focused. CI must be green: lint, typecheck, unit tests, page contract, and the
end-to-end suite on desktop Chrome, desktop WebKit, phones and a tablet.
