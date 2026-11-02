## What changes for the player

<!-- One or two sentences. What changes, and why. Link the issue if there is one. -->

## Kind

- [ ] Feature
- [ ] Fix
- [ ] Docs / wiki (`wiki/`)
- [ ] Repository configuration (workflows, CODEOWNERS, Dependabot, rulesets)
- [ ] Bundle enabled or removed (`.github/bundles/`)
- [ ] Chore / dependencies

## How it was checked

- [ ] `npm run check` is green locally
- [ ] New or changed behaviour has a test (unit in `tests/unit/`, end-to-end in `tests/e2e/`)
- [ ] Looked at it in a browser, desktop and phone size
- [ ] `pre-commit run --all-files` passes
- [ ] CI is green
- [ ] No secrets or credentials in the diff
- [ ] Wiki pages edited in `wiki/`, not in the GitHub wiki UI
- [ ] Screenshots in `docs/screenshots/` updated if anything visible changed (`npm run screenshots`)
- [ ] Workflow changes declare least-privilege `permissions:`
- [ ] `CHANGELOG.md` updated under `Unreleased` if this is user-visible
- [ ] Ruleset changes applied to the live ruleset, not only to the JSON file
- [ ] New or moved actions pinned to a full commit SHA with a version comment
- [ ] Enabling a bundle: pins re-resolved, and the description says why this repo needs it
- [ ] Commits are atomic and conventional, with no `Co-Authored-By` trailers
- [ ] No assistant footer in this description, and every commit is authored by a human on `.github/attribution-allow.txt`

## Notes for the reviewer

<!-- Anything that is not obvious from the diff: what you checked, what you did
     not check, and what you would look at first if this broke. -->
