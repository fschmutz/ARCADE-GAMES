# Security

This repository is **public**. Everything in it, its history, its issues and its
wiki is readable by anyone, so nothing sensitive belongs in any of them.

## Scope

Arcade is a static site: no server, no account, no data leaves the browser
except the page requests themselves. Scores and settings stay in the browser's
local storage. The repository holds the site's source (`site/`), its tests, and
the CI that deploys it to GitHub Pages. It holds no credentials and needs none:
the deploy uses the workflow's own short-lived token.

## Reporting a vulnerability

**Do not open a public issue.** Issues here are readable by everyone, which
defeats the purpose of reporting privately.

1. **GitHub private vulnerability reporting**, the Security tab → _Report a
   vulnerability_, or directly
   [github.com/fschmutz/ARCADE-GAMES/security/advisories/new](https://github.com/fschmutz/ARCADE-GAMES/security/advisories/new).
   This is the channel for this repository: it is public, and private
   vulnerability reporting is enabled on it.
2. **Email Falco Schmutz** at <fschmutz@premaccess.com> if you cannot use
   GitHub. Include what you found, how to reproduce it, and how far the
   exposure reaches.

Expect an acknowledgement within two business days. If the finding is a live
exposure — a leaked credential, an access grant that should not exist — say so
in the first line and email as well as filing, so it is not waiting in a queue.

## What is already in place

- Strict Content Security Policy on every page: no inline script or style, no
  inline handler, no third-party origin.
- No runtime dependency: the deployed site is only the files in `site/`.
- Every action is pinned to a full commit SHA with the version in a trailing
  comment; the `template structure` CI job fails on anything looser, and
  `scripts/check-latest.mjs` fails CI when a pin falls behind its latest
  release. A tag is mutable, and a moved tag runs someone else's code with this
  repository's token.
- `npm audit` in CI at any severity, and
  `.github/workflows/dependency-review.yml` blocks a pull request that
  introduces a high or critical advisory.
- Dependabot keeps the `github-actions`, `pre-commit` and `npm` pins moving
  weekly. A Dependabot pull request is a dependency change and gets read like
  one.

## Secrets

- Secrets never belong in the tree, in a workflow file, or in an issue.
  Workflows read them through `secrets.*` only, and workflow `permissions:`
  start at `contents: read` and are widened per job.
- `gitleaks` runs in `pre-commit` and blocks the commit. Do not weaken it to
  warn-only to land a change; fix the change.
- Secret scanning and push protection are enabled on the repository. **Do not
  add a secret-scanning workflow** — a second scanner duplicates the finding,
  bills runner minutes for it, and gives two places to silence an alert from.

## Rotation

If a credential may have been exposed through this repository, rotate it before
the incident is considered closed. Deleting it in a later commit does not remove
it from history.
