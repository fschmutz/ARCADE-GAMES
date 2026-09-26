# Security policy

Arcade is a static site: no server, no account, no data leaves the browser except the
page requests themselves. Scores and settings stay in the browser's local storage.

## Reporting a vulnerability

Please report privately through
[GitHub private vulnerability reporting](https://github.com/fschmutz/ARCADE-GAMES/security/advisories/new),
not in a public issue. You will get an answer within a week.

## What is already in place

- Strict Content Security Policy on every page: no inline script or style, no third-party origin.
- Every GitHub Action pinned to a full commit SHA; CI fails when a pin falls behind its latest release.
- `npm audit` in CI, Dependabot security updates, secret scanning with push protection.
- No runtime dependency: the deployed site is only the files in `site/`.
