# Arcade

Three browser games, playable on desktop and mobile, even offline:

| Game | What you do | Modes |
|---|---|---|
| **Snake** | Eat the apples, grab the golden apple (3 points, blinks out after 6 s), never bite your tail. | Classic, Zen (walls wrap, nothing kills you), Portals (two teleporting pairs). 1, 3 or 5 apples. Four speeds. |
| **Pac-Man** | Clear the maze while four ghosts hunt you, each with its own arcade chase logic. Bonus fruit twice a level (cherry 100 up to key 5000), ghosts 200 / 400 / 800 / 1600 in a row, arcade cornering (press the turn early to cut the corner). | Classic (3 lives, extra life at 10 000), Chrono 3 min (each catch costs 10 s). |
| **Course** | Weave through cars, vans and trucks, some of which change lanes. Near misses score and chain into a combo multiplier; nitro recharges on its own. | Highway, Two-way (oncoming lanes, wrong-way bonus), Daily challenge (same traffic for everyone that day). Four speeds. |

**Play:** https://fschmutz.github.io/ARCADE-GAMES/

The in-game text is in French. Best scores are kept in the browser per game, mode and speed.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys, or `Z` `Q` `S` `D` (AZERTY) / `W` `A` `S` `D` | Swipe (Snake, Pac-Man), hold left or right half of the road (Course) |
| Nitro (Course) | `F` or `N`, hold | Hold the Nitro button |
| Pause | `Space` | |
| End run (Snake) | `Escape` | |
| Start / replay | `Enter` | Tap the button |
| Speed / mode | `1` to `4` | Tap the option |
| Sound on / off | `M` | Tap the speaker |

## How it is built

- Plain HTML, CSS and native ES modules. No framework, no runtime dependency, no build step: `site/` is what gets deployed.
- Shared modules in `site/assets/`: `arcade.js` (theme, storage, overlay, option pickers, input), `audio.js` (every sound synthesised with the Web Audio API, no audio files), `fx.js` (particles, screen shake, flash, floating text, phone vibration; motion effects switch off when the device asks for reduced motion).
- Each game splits pure rules (`rules.js`, no DOM, unit-tested) from the canvas game loop.
- Strict Content Security Policy on every page: no inline script, no inline style, no third-party origin.
- Installable web app with a network-first service worker, so a new deploy shows on the next load and the games still open offline.
- Type-checked in strict mode with TypeScript 7 over JSDoc, linted with oxlint, unit tests with the Node test runner, end-to-end tests with Playwright.

## Develop

Requires Node 24 or newer and Google Chrome.

```bash
npm ci
npm run serve      # http://127.0.0.1:4173/
npm run check      # lint + typecheck + unit + end-to-end tests
```

Every push to `main` runs the same checks in GitHub Actions and, when they pass, deploys `site/` to GitHub Pages.

## Credits

Lino from Marrakech

## License

[MIT](LICENSE)
