# Contributing

Thanks for wanting to help. Bug reports, ideas and pull requests are welcome.

This repository is read and written by its owner, outside contributors, and
several AI assistants. The conventions below exist so all of them produce work
in the same shape. If you are an AI assistant, [`AGENTS.md`](AGENTS.md) is the
same contract written for you, and it is the one to read first.

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

## Setup

```bash
pipx install pre-commit
pre-commit install
```

`pre-commit` runs the hygiene set plus the two gates that matter here: `gitleaks`
for secrets and `actionlint` for workflow files. The same checks run in CI on
every push and pull request.

```bash
pre-commit run --all-files
```

## Branches and pull requests

In multi-branch repositories (`dev`, `preprod`, `prod`, where a push deploys),
`main` in this file means every deploy branch, kept at one SHA.

- **The owner pushes directly to `main`.** That is the norm in BAM
  repositories; the ruleset example lists the admin role as a bypass actor so
  it stays possible once a ruleset is live.
- **Everyone else opens a pull request**, and so does the owner when a ruleset
  without that bypass protects `main`. A CODEOWNERS review is required — see
  `.github/CODEOWNERS`.
- Branch off `main`. Name the branch for the change: `feat/<slug>`,
  `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
- Fill in the pull request template. The checklist is the review, not decoration.
- Keep pull requests reviewable. A diff nobody can hold in their head gets
  approved on trust, which is not review.
- CI must be green: lint, typecheck, unit tests, page contract, the end-to-end
  suite on desktop Chrome, desktop WebKit, phones and a tablet, and the template
  checks (workflow syntax, template structure, screenshots, attribution guard).
- Squash on merge, so `main` stays linear.

## Commits

- Atomic, split by concern. One commit per concern.
- Conventional commits: `feat(scope):`, `fix(scope):`, `docs(scope):`,
  `chore(scope):`.
- Explain _why_ in the body when it is not obvious from the diff.
- No `Co-Authored-By` trailers, and no assistant attribution in commit messages.
- Never amend or force-push a commit that is already on `main`.

## Attribution

The author of record is the human who owns the change, and CI checks it. The
`attribution guard` job runs `scripts/attribution-guard.sh` on every pull
request and fails it when a commit's author or committer address is not in
`.github/attribution-allow.txt`, when the name beside that address reads as a
tool, when a message carries a `Co-authored-by:` trailer naming anybody else or
an assistant footer, or when the pull request title or body carries agent
markers, an agent run link, an "Open in …" footer image, or a "Generated with …"
line.

- **A footer in the title or the body is the cheap fix.** It touches no commit:
  `gh api -X PATCH repos/OWNER/REPO/pulls/N -f body="$(cat body.md)"`.
- **A wrong author in the history is not.** Fixing it rewrites the branch, so
  ask the repository owner first and force-push the pull request branch only.
- **Adding an address to the allow-list is its own reviewed commit**, with a
  reason. Never widen it to turn a check green, and do not delete the file to
  get past it — the guard warns and falls back to the built-in owner.
- **`name:FULL NAME` is for a real person** whose name collides with a tool's,
  and for nothing else.

Before you commit, check whether a teammate or another assistant has uncommitted
work in the tree — several of them share these repositories.

## Secrets

Never commit a credential, token, private key, AWS access key, or customer
identifier. `gitleaks` is a hard gate: if it fires, the finding is the bug.

If a secret does reach a commit, stop and report it — see [SECURITY.md](SECURITY.md).
Deleting it in a later commit does not remove it from history.

## Screenshots

Screenshots are mandatory ([ADR-0002](wiki/ADR/0002-Screenshots-Are-Mandatory.md)).
The README's `## Screenshots` section links images under `docs/screenshots/`
(`.png`, `.jpg`, `.webp`, at most 600 KB each, with real alt text), and every
image there is referenced from the README or a wiki page.
`scripts/check-screenshots.sh` enforces it in CI and in pre-commit.

- Update the screenshot in the same pull request as the visible change:
  `npm run screenshots` recaptures every image from the real site.
- Fictional data only — no customer names, real people, account ids, or
  credentials. Look at the image before committing it; no scanner reads a PNG.
- A repository with genuinely nothing to show declares it in
  `.github/screenshots-exempt`: the first non-comment line is the reason. That
  file goes through review like any other exception.

## The wiki

`wiki/` is the single source of truth for the GitHub wiki. Edit pages there,
review them in a pull request, and CI mirrors them on merge
(`.github/workflows/wiki.yml` → `scripts/wiki-sync.sh`).

**Do not edit pages through the GitHub wiki UI** — the sync overwrites them.

One page, one subject, and a name that reads as a title: the filename becomes the
wiki page name, with `-` rendered as a space.

## Workflows

- Keep CI lean. A new workflow needs a reason that a job in `ci.yml` cannot meet.
- Declare `permissions:` explicitly, starting from `contents: read`.
- **Pin every action to a full commit SHA**, with the version as a trailing
  comment:

  ```yaml
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  ```

  A tag is mutable: `v7` moves, and a compromised release moves it onto your
  runner with your token. CI enforces this — the `template structure` job fails
  on any `uses:` that is not 40 hex characters. Dependabot reads the comment and
  keeps the SHA moving, so pinning does not mean freezing.

  Resolve a SHA with `gh api repos/OWNER/ACTION/git/ref/tags/vX.Y.Z --jq '.object.sha'`
  (dereference `.object.sha` once more when the tag is annotated).

- `actionlint` catches the syntax; it does not catch a careless bump. Read the
  diff of an action upgrade the way you would read any other dependency.

## Rulesets

`.github/rulesets/main.example.json` documents the intended branch protection. It
does not apply itself. When you change it, apply the change to the live ruleset in
the same pull request cycle, or the file becomes fiction.

A multi-branch repository (`dev`, `preprod`, `prod`) applies
`.github/rulesets/multi-branch.example.json` instead, with its own build checks
added to `required_status_checks`.

```bash
./scripts/apply-ruleset.sh            # plan
./scripts/apply-ruleset.sh --apply    # create, or update in place
./scripts/apply-ruleset.sh -f .github/rulesets/multi-branch.example.json   # multi-branch
```

## Bundles

`.github/bundles/` holds files that are deliberately inert — every one of them
ends in `.disabled` or `.example`, and CI fails if one loses its suffix.

Do not activate a bundle as a drive-by. Enabling one is its own pull request:
re-resolve the pinned SHAs (Dependabot does not scan that directory), read the
header comment, and say in the description why this repository needs it. The
map and the reasoning are in the README and on the `Bundles` wiki page.
