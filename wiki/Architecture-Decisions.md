# Architecture Decisions

Decisions that are expensive to reverse are written down here, with the
reasoning that made them look right at the time.

> Edit these pages at `wiki/ADR/` in the repository. Changes made in the GitHub
> wiki UI are overwritten by the next sync.

## The record

| ADR                                           | Title                                       | Status   |
| --------------------------------------------- | ------------------------------------------- | -------- |
| [0000](ADR/0000-Template)                     | Template — copy this to start a new one     | —        |
| [0001](ADR/0001-Ship-Enhancements-As-Bundles) | Ship template enhancements as named bundles | Accepted |
| [0002](ADR/0002-Screenshots-Are-Mandatory)    | Screenshots are mandatory                   | Accepted |

## Why here and not in `docs/adr/`

Every other convention would put architecture decision records in a `docs/`
directory. This repository has exactly one documentation surface — `wiki/` — and
CI fails if a second one appears. Two documentation sources drift, and the one
nobody owns is the one people read. ADRs are documentation, so they live in the
wiki like everything else. The one thing allowed under `docs/` is
`docs/screenshots/` — images, not prose ([ADR-0002](ADR/0002-Screenshots-Are-Mandatory)).

The cost is a subdirectory in a wiki, which GitHub renders but does not
advertise: links to these pages need the path, `[0001](ADR/0001-Ship-...)`, not
just the page name. This index page exists so nobody has to know that.

## When to write one

Write an ADR when the decision is hard to reverse and the reasoning is not
obvious from the result:

- a dependency, a vendor, or a service the repository now relies on
- a boundary — what this repository owns and what it deliberately does not
- a convention everyone has to follow, like "one documentation surface"
- turning a bundle on or off in a way that departs from the template default

Do not write one for a choice the code already explains. An ADR per pull request
is a filing system, not a record.

## How to write one

1. Copy `wiki/ADR/0000-Template.md` to `wiki/ADR/NNNN-Short-Title.md`, taking
   the next free number. Numbers are never reused.
2. Fill in Context, Decision, Consequences, and Alternatives. The Alternatives
   section is the one that pays for the ADR: six months from now someone will
   propose one of them again, and the question will be whether the reason it
   lost still holds.
3. Add a row to the table above.
4. Open a pull request. The discussion belongs in the review, and the ADR merges
   with status **Accepted** once it lands.

## Changing a decision

ADRs are immutable once accepted. They are a record of what was decided and why,
not a description of the current state.

To change direction, write a new ADR and set the old one's status to
`Superseded by [ADR-NNNN](NNNN-Short-Title)`. That one-line edit is the only
change an accepted ADR ever receives.
