# ADR-0001: Ship template enhancements as named bundles

|              |               |
| ------------ | ------------- |
| **Status**   | Accepted      |
| **Date**     | 2026-10-01    |
| **Deciders** | Falco Schmutz |

## Context

The template started as a small, defensible core: community files, wiki-as-code,
and two CI jobs. A round of research produced a long list of worthwhile
additions — an agent contract, supply-chain gates, triage automation, release
tooling, community files, OpenSSF Scorecard.

Shipping all of it flat would have made every repository created from the
template inherit every one of them. That is the failure mode the template was
written to avoid, and it has a name in this estate: BAM-PROD-ENGINE, eighteen
workflows sized for a production platform, billing runner minutes on repositories
that have nothing to build.

The opposite failure is just as real. Anything not shipped is not written down,
and the next repository reinvents it by hand, differently.

## Decision

We ship all of the researched enhancements, grouped into named bundles (A–I),
each with a declared default state.

- A bundle that is **on** is an active file in its normal location.
- A bundle that is **off** ships as an inert file under `.github/bundles/`,
  suffixed `.disabled` or `.example`. It is present, readable, and reviewed —
  and it does not run.
- Every bundle documents how to enable it and how to remove it, in one table in
  the README and in full on [Bundles](Bundles).

Default-on is A–E: core, agent contract, supply chain, triage, governance.
Default-off is F–H: release, community, heavy security. Bundle I is
documentation only.

## Consequences

- **Good** — a clone runs only what it needs. The expensive things (Scorecard,
  SBOM, release automation) are one rename away instead of one research session
  away, and the reasoning for their default lives next to them.
- **Good** — "which bundles is this repo on" is a reviewable question with a
  reviewable answer.
- **Bad** — a disabled workflow is not linted by the same path as an active one
  and is not seen by Dependabot, so its pinned SHAs go stale. CI compensates by
  linting the disabled workflows explicitly; the stale-SHA problem is handled by
  re-resolving pins when a bundle is enabled, which is a documented step and
  therefore a step someone can skip.
- **Bad** — more files in the tree than a minimal template needs, and a reader
  has to learn what `.github/bundles/` means before the layout makes sense.
- **Neutral** — the bundle letters are a naming convention, not a mechanism.
  Nothing enforces them beyond the CI check that keeps `.github/bundles/`
  inert.

## Alternatives considered

- **Ship everything active.** Rejected: it recreates the ENGINE problem on day
  one of every new repository, and the cost lands on whoever is least equipped
  to notice it.
- **Ship only the core, document the rest in the wiki.** Rejected: prose is not
  a file. Every repository would retype the workflow, with a different pin and a
  different set of permissions.
- **A second repository of optional templates.** Rejected for now: it needs its
  own ownership, CI, and release path, and the estate does not have the volume
  to pay for that yet. Revisit alongside `smn-actions` (Bundle I).
- **A generator script that asks which bundles you want.** Rejected: a script
  that writes workflow files is a thing to maintain and to trust, and `git rm`
  plus a rename is already the whole interface.
