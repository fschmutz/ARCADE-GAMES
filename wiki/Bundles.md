# Bundles

What this template ships, what runs on day one, and what is present but
switched off.

> Edit this page at `wiki/Bundles.md` in the repository. Changes made in the
> GitHub wiki UI are overwritten by the next sync.

## The idea

A template has two ways to fail. It can ship too little, and every repository
reinvents release automation by hand, differently. Or it can ship everything
active, and a repository that has nothing to build inherits a production
platform's CI bill on its first day — the BAM-PROD-ENGINE failure, eighteen-plus
workflows sized for something else entirely.

So everything is here, grouped into named bundles, each with a declared default:

- **On** — an active file in its normal place. It runs.
- **Off** — an inert file under `.github/bundles/`, suffixed `.disabled` or
  `.example`. GitHub reads it as neither a workflow nor a community file. It is
  present, readable, reviewed, and one `git mv` away from working.

CI enforces the second half: the `template structure` job fails if any file
under `.github/bundles/` loses its suffix, so a bundle turns on deliberately or
not at all.

The reasoning is recorded in [ADR-0001](ADR/0001-Ship-Enhancements-As-Bundles).

## The map

| Bundle                     | Default                                   | How to enable                                                                                                                                                                            | How to remove                                                                                                                                 |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Core**               | **on**                                    | Always present. It is the template.                                                                                                                                                      | Do not. Removing it leaves a repository with no CI and no docs surface.                                                                       |
| **B — Agent**              | **on**                                    | Active already: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`                                                                                                              | `git rm AGENTS.md CLAUDE.md .github/copilot-instructions.md`, then drop them from the `template structure` path list in `ci.yml`              |
| **C — Supply chain**       | **on**                                    | Active already: SHA pins plus `.github/workflows/dependency-review.yml`                                                                                                                  | `git rm .github/workflows/dependency-review.yml`. Keep the pins — the CI check that enforces them is three lines of grep.                     |
| **D — Triage**             | **on**                                    | Active already: `labels.yml`, `labeler.yml`, and their two workflows                                                                                                                     | `git rm .github/labels.yml .github/labeler.yml .github/workflows/label-sync.yml .github/workflows/labeler.yml`                                |
| **E — Governance**         | **on** (files) / **opt-in** (enforcement) | Files are present. Enforcement is one deliberate command: `./scripts/apply-ruleset.sh --apply`                                                                                           | `git rm -r .github/rulesets scripts/apply-ruleset.sh wiki/ADR wiki/Architecture-Decisions.md`, and delete the live ruleset if you created one |
| **F — Release**            | **off**                                   | `git mv .github/bundles/release/<file>.yml.disabled .github/workflows/<file>.yml` — [README](https://github.com/fschmutz/ARCADE-GAMES/blob/main/.github/bundles/release/README.md) first | `git rm -r .github/bundles/release`                                                                                                           |
| **G — Public / community** | **off**                                   | `git mv` each `.example` to its real name — [README](https://github.com/fschmutz/ARCADE-GAMES/blob/main/.github/bundles/community/README.md) first                                       | `git rm -r .github/bundles/community`                                                                                                         |
| **H — Heavy security**     | **off**                                   | `git mv .github/bundles/security/scorecard.yml.disabled .github/workflows/scorecard.yml` — and **leave the trigger on `workflow_dispatch`**                                              | `git rm -r .github/bundles/security`                                                                                                          |
| **I — Estate**             | documentation only                        | Nothing to enable. See [Estate](#i--estate) below.                                                                                                                                       | Nothing to remove.                                                                                                                            |

Two steps apply to enabling anything from F, G, or H, every time:

1. **Re-resolve the pinned action SHAs.** Dependabot only scans
   `.github/workflows/`, so the pins in `.github/bundles/` are frozen at the day
   the bundle was written.

   ```bash
   gh api repos/OWNER/ACTION/git/ref/tags/vX.Y.Z --jq '.object.sha'
   gh api repos/OWNER/ACTION/git/tags/<sha>      --jq '.object.sha'   # annotated tags
   ```

2. **Read the header comment in the file.** Every one of them says what it costs
   to run and what it needs from repository settings. None of them is free.

## What each bundle is

### A — Core

The template itself: `README`, `CHANGELOG`, `SECURITY`, `CONTRIBUTING`,
`LICENSE`, `.gitignore`, `.pre-commit-config.yaml`, the issue and pull request
templates, `CODEOWNERS`, Dependabot, `ci.yml`, `attribution-guard.yml`, and the
wiki-as-code surface (`wiki/`, `scripts/wiki-sync.sh`,
`.github/workflows/wiki.yml`).

`wiki.yml` and `label-sync.yml` publish from the repository's default branch,
whatever it is called, through a job-level `if:`; a multi-branch repository
whose default branch is `prod` keeps both files as shipped. `ci.yml` is the one
trigger such a repository edits: see
[Multi-branch repositories](Getting-Started#multi-branch-repositories).

`ci.yml` runs three jobs — `workflow syntax`, `template structure`, and
`screenshots` — and `attribution-guard.yml` runs a fourth, `attribution
guard`. Those four are the names to put in a ruleset's required checks.

Screenshots are part of the core, not a bundle: `scripts/check-screenshots.sh`
requires a README `## Screenshots` section backed by images in
`docs/screenshots/`, or a declared reason in `.github/screenshots-exempt`. An
optional rule is not a rule — [ADR-0002](ADR/0002-Screenshots-Are-Mandatory).

Attribution is core for the same reason. `scripts/attribution-guard.sh` fails a
pull request whose commits were authored or committed by an address that is not
in `.github/attribution-allow.txt`, whose messages carry a `Co-authored-by:`
trailer naming anybody else or an assistant footer, or whose title or body
carries agent markers, an agent run link, an "Open in …" footer image, or a
"Generated with …" line. The allow-list ships with the repository owner's
address and two kinds of structural exception: `committer:noreply@github.com`
for a merge made through the GitHub web UI, and the `dependabot[bot]`,
`github-actions[bot]` and `renovate[bot]` logins.

The **name** beside the address is checked separately and ignores the
allow-list on purpose: an assistant that commits through somebody's account
still signs the history as `Cursor Agent` or `Claude`, and an allow-listed
address does not make that a person. The cost is a false positive on a real
Jean-Claude, so a `name:FULL NAME` entry exempts one — and nothing else does.

**A missing allow file is a warning, not an escape.** Delete
`.github/attribution-allow.txt`, make it unreadable, or leave it as comments,
and the guard says so and falls back to the address built into the script. A
check that failed open on a deleted file would be worth nothing.

Two deliberate pieces of restraint, both of which exist so the guard stays
believable:

- **It reads footers, not words.** The bare word "cursor" is a database cursor
  far more often than it is a tool, so only trailer keys, footer shapes, and
  URLs count. A commit titled _fix(db): close the cursor when the query throws_
  passes, and so does a commit message that names the tools mid-sentence —
  which is what a commit changing this guard looks like. A footer stands on
  its own line, so the phrases are matched at the head of a line; every
  machine-written form also reaches another rule, as a trailer address, inside
  a link, or after "Generated with".
- **Its fixtures run first.** `scripts/tests/attribution-guard-test.sh` feeds
  the guard recorded API payloads — a good commit, a foreign author, a tool as
  the author name, a foreign trailer, the owner's own trailer, a bot, each
  footer rule on its own, an agent in the title, a missing allow file — and
  the workflow runs it before the live check. A guard that has quietly stopped
  matching reports green either way, which is worse than having no guard. The
  overlapping footer rules get one fixture each, so deleting a rule turns a
  case red instead of being covered by its neighbour.

It lives in its own workflow rather than in `ci.yml` because a pull request
title and body are editable after the last push: the check needs the `edited`
trigger, which the default `pull_request` types do not include.

### B — Agent

`AGENTS.md` is the house contract for every assistant that touches the
repository: work from the remote tip, the owner pushes to `main` directly while
everyone else opens a pull request, respect `CODEOWNERS`,
no secrets, link to house doctrine instead of cloning it, write in English, no
assistant attribution in commits. In a multi-branch repository `main` reads as
every deploy branch, kept at one SHA, so the files stay as shipped there too.

`CLAUDE.md` and `.github/copilot-instructions.md` point at it and add only what
is specific to each tool. One contract, two pointers — so a rule changes in one
place.

On by default because three assistants already read these repositories, and the
alternative to a written contract is three different sets of invented
conventions.

### C — Supply chain

Every `uses:` in `.github/workflows/` is a full commit SHA with the version in a
trailing comment, and the `template structure` job fails on anything looser. A
tag is mutable: `v7` moves, and a compromised release moves it onto the runner
that is holding this repository's token. Dependabot reads the comment and keeps
the SHA moving, so pinning is not freezing.

`dependency-review.yml` blocks a pull request that introduces a high or critical
advisory. Two pieces of restraint keep it from being permanently red:

- It is **paths-filtered** to dependency manifests, so it never runs on a
  repository that has none.
- It **probes the dependency graph API first**. On a private repository that
  API needs GitHub Advanced Security; without it the job posts a notice and
  skips instead of failing.

Because it does not report on every pull request, **do not put `dependency
review` in `required_status_checks`.** Same for `label by path`. A required
check that never reports blocks every pull request permanently.

Secret scanning and push protection are **already on** for this repository.
Confirm them in Settings → Advanced Security; do not add a workflow
to duplicate them. A second scanner duplicates the finding, bills runner minutes
for it, and creates a second place to silence an alert from.

### D — Triage

`.github/labels.yml` is the label set as data, applied by `label-sync.yml` on
every push to the default branch that touches it. Additive by default; pruning
is a manual dispatch, because deleting a label silently strips it from every
issue that carried it. The sync is `yq` plus `gh`, not a third-party action — triage should
not cost supply chain.

`.github/labeler.yml` labels a pull request from the paths it touches, so "what
does this change" is answered before anyone opens the diff. It runs on
`pull_request` and skips forks, rather than reaching for `pull_request_target`,
which would run with write access on a fork's head.

`docs.yml` adds a third issue form for documentation problems. `SUPPORT.md` says
where to ask a question and, more usefully, where not to — GitHub surfaces it in
the issue chooser on its own, with no template wiring.

**Colours in `labels.yml` are quoted.** Unquoted, `5319e7` is valid YAML
scientific notation and reaches the API as `53190000000`.

### E — Governance

The files are on; the enforcement is not.

`.github/rulesets/main.example.json` documents the intended branch protection
and protects nothing; `.github/rulesets/multi-branch.example.json` is the same
shape for a `dev`/`preprod`/`prod` repository (see
[Multi-branch repositories](Getting-Started#multi-branch-repositories)).
`scripts/apply-ruleset.sh` is the deliberate step: it
plans by default, updates in place rather than duplicating, and checks every
`required_status_checks` context against the job names the workflows actually
produce.

```bash
./scripts/apply-ruleset.sh            # what it would do
./scripts/apply-ruleset.sh --apply    # do it
```

Nothing applies a ruleset on clone, on purpose. A template that locked `main`
automatically would lock a repository before anyone had decided who owns it.

Architecture decisions live in [`wiki/ADR/`](Architecture-Decisions), not in
`docs/adr/`, because this repository has one documentation surface and CI fails
when a second appears.

`SECURITY.md` carries the one repository setting that cannot be shipped in a
file: **private vulnerability reporting is off by default** and has to be
enabled per repository in Settings → Advanced Security. Until it is, the policy
points at a button that does not exist and the reporter files a public issue
instead.

### F — Release

`release-please.yml.disabled` and `sbom.yml.disabled`. Enable on a repository
that ships a versioned artifact to somebody else.

Release automation is not free: it rewrites `CHANGELOG.md` as generated output,
turns conventional commits from a convention into an API, and widens the token
to `contents: write` and `pull-requests: write`. A pull request opened with
`GITHUB_TOKEN` also does not trigger other workflows, so a release pull request
that must run CI needs a PAT or an App token — a secret to own and rotate.

Both ship `workflow_dispatch`-only so you can watch a run before it has opinions
about `main`.

### G — Public / community

`CODE_OF_CONDUCT.md.example`, `FUNDING.yml.example`, `llms.txt.example`, and
`stale.yml.disabled`. This is the bundle for the day a repository stops being
private.

A private repository with a named owner does not need a code of conduct, and an
unenforced one is a liability: it promises a response that nobody is on the hook
for. A stale bot on a two-contributor repository is not triage, it is a machine
closing the thing you meant to get to.

Discussions is a repository setting, not a file — Settings → Features. Leave it
off until someone owns it; an abandoned Discussions tab reads as "nobody is
home" more loudly than not having one.

Going public is much more than these files. The community README lists the rest:
replace the proprietary `LICENSE`, scan the **whole history** rather than the
tip, and re-read the wiki, which becomes public too and is the surface most
likely to name a customer.

### H — Heavy security

OpenSSF Scorecard, `workflow_dispatch` only, and the file says so in capitals.

Scorecard runs around twenty probes. On a public repository it is close to free.
On a **private** repository every minute is billed and the private path is the
slow one, because several probes fall back to repeated API calls instead of the
public cache. Wired to `push`, it becomes one of the larger lines on the Actions
bill in exchange for a score nobody outside the repository can see.

Run it as a quarterly audit: read the report, fix the findings, stop running it.
Expect a mediocre score on an operator repository and read it as a checklist
rather than a number — most of the low marks are correct decisions (no releases,
no application code) and the two that matter here, pinned dependencies and token
permissions, already pass.

**`publish_results` must stay `false` on a private repository.** True sends the
score to the public OpenSSF API, which is a disclosure decision.

### I — Estate

Documentation only; there is nothing in the tree to switch on.

The bundles duplicate workflow logic across every repository that enables them.
The estate-level answer is a `ScaleMeNow/smn-actions` repository of reusable
workflows, called with `uses: ScaleMeNow/smn-actions/.github/workflows/<name>.yml@<sha>`,
so a fix lands once instead of once per clone.

It does not exist yet, and this template does not create it. A shared workflow
repository needs its own ownership, versioning, and release path, and it becomes
a single point of failure for every repository that calls it. That is worth
paying for at ten repositories with the same job; it is not worth paying for at
two. When it happens, Bundles C, F, and H are the first candidates to move —
they are the ones whose logic is identical everywhere and whose pins go stale
fastest.

Until then, the bundles are copies, and a fix to one is a fix to one.

## Which bundles for which kind of repository

Different products want different bundles. Four shapes cover almost everything
in this estate:

| Shape                                                                          | Bundles                                                         | Why                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Private operator repo** — runbooks, infrastructure, internal tooling         | **A–E** (the default)                                           | Everything it needs and nothing it has to pay for. This is what a fresh clone already is.                                                                                                                           |
| **Public toy or demo** — something with a public face and no commercial weight | **A–E + G**                                                     | Replace `LICENSE` first, scan the whole history, and read the community README before flipping visibility.                                                                                                          |
| **Shipping artifact** — a library, an image, a CLI someone else installs       | **A–F**                                                         | Release automation and SBOM start earning the moment somebody outside the repository depends on a version number.                                                                                                   |
| **Platform beast** — sustained traffic, real build, real blast radius          | **A–F**, and look at the ENGINE estate rather than at Scorecard | The answer for a platform is the platform repository's own CI, borrowed deliberately and read before copying. Scorecard-on-push is the wrong tool at that size: it bills like a build and reports like a checklist. |

The rule underneath all four: enable a bundle because this repository needs it,
not because another repository has it.

## In this repository

Arcade is a **public toy**, so its shape is **A–E + G**, with G taken by hand
before the template was adopted rather than from the bundle:

| Bundle                     | State here                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Core**               | on. `ci.yml` also runs the Arcade gates and the Pages deploy; the template's `LICENSE` is replaced by MIT because the repository is public.                                        |
| **B — Agent**              | on. `AGENTS.md` §11 carries the Arcade rules.                                                                                                                                      |
| **C — Supply chain**       | on, and stricter: `scripts/check-latest.mjs` fails CI when a pin is behind its latest release, not only when it is a tag.                                                          |
| **D — Triage**             | on, with `area:games` and `area:tests` labels.                                                                                                                                     |
| **E — Governance**         | files on; the ruleset also requires `Lint, typecheck, end-to-end` and `E2E matrix (WebKit desktop, phones, tablet)`.                                                               |
| **F — Release**            | off. Nothing here is versioned for somebody else.                                                                                                                                  |
| **G — Public / community** | on by hand: `CODE_OF_CONDUCT.md` at the root and `site/llms.txt` served by Pages predate the adoption. `FUNDING.yml` and the stale bot stay off. The bundle files stay as shipped. |
| **H — Heavy security**     | off. Scorecard is cheap on a public repository; enable it as a one-off audit when wanted.                                                                                          |
| **I — Estate**             | documentation only.                                                                                                                                                                |

## Where to go next

- [Getting Started](Getting-Started) — from `Use this template` to green CI
- [Architecture Decisions](Architecture-Decisions) — why it is shaped this way
- [Home](Home) — how this wiki is generated
