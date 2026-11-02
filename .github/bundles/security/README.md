# Bundle H — Heavy security

**Default: off.** One file, and it is disabled.

| File                     | Becomes                           | Default trigger                             |
| ------------------------ | --------------------------------- | ------------------------------------------- |
| `scorecard.yml.disabled` | `.github/workflows/scorecard.yml` | `workflow_dispatch` only — **never `push`** |

## Why this bundle is off and the others' defaults are not an accident

OpenSSF Scorecard runs around twenty independent probes against a repository:
branch protection, signed releases, token permissions, pinned dependencies,
fuzzing, SAST, and the rest. It is a genuinely good audit, and it is slow.

On a **public** repository it is close to free — the runners are free, the
results feed into the public Scorecard API, and a weekly run costs nothing but
a badge that goes down when someone weakens a setting.

On a **private** repository, every minute is billed, and the private-repo path
is the expensive one: several probes need repeated API calls that the public
path gets from a cache. Wire that to `push` on a busy repository and it becomes
one of the larger lines on the Actions bill, producing a score nobody outside
the repository can see. That is the BAM-PROD-ENGINE lesson restated: workflows
sized for a platform, billed against a repository that has nothing to build.

So: **do not enable this on `push`.** The shipped trigger is
`workflow_dispatch`, and the file carries a loud comment saying the same thing.
Run it when you want an audit, read the report, fix the findings, and go back to
not running it. A quarterly manual run tells you everything a nightly run would,
at roughly one four-hundredth of the cost.

## Enable

```bash
git mv .github/bundles/security/scorecard.yml.disabled \
       .github/workflows/scorecard.yml
```

Then:

1. **Re-resolve the pinned SHA.** Dependabot does not scan this directory.
2. **Leave the trigger alone.** `workflow_dispatch`, nothing else. If you find
   yourself uncommenting the schedule, write down in
   [ADR](../../../wiki/Architecture-Decisions.md) why this repository is the
   exception.
3. **Decide where the results go.** SARIF upload to code scanning needs
   `security-events: write` and, on a private repository, GitHub Advanced
   Security. Without it, read the artifact — the workflow uploads one either
   way.

## Expect a mediocre score, and read it anyway

A private operator repository scores badly on Scorecard by construction, and
most of those findings are correct decisions rather than problems:

- **Signed-Releases / Packaging / CII-Best-Practices** — the repository does not
  release anything. Nothing to fix.
- **Fuzzing / SAST** — no application code. Nothing to fix.
- **Branch-Protection** — often reports low because the probe cannot read
  ruleset configuration without an admin token, not because `main` is unprotected.
- **Pinned-Dependencies** — this one is real, and this template already passes
  it. Every `uses:` is a full commit SHA, enforced by CI.
- **Token-Permissions** — also real, and also already passing: every workflow
  declares `permissions:` starting at `contents: read`.

Use it as a checklist, not as a number. The number is for public repositories
that want a badge.

## Remove

```bash
git rm -r .github/bundles/security
```
