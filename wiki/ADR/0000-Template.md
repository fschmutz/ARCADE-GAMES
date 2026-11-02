# ADR-0000: Template

> Copy this file to `wiki/ADR/NNNN-Short-Title.md`, take the next free number,
> and delete this quote block. Keep the headings — a reader three years from now
> is looking for one of them specifically.

|              |                                                                              |
| ------------ | ---------------------------------------------------------------------------- |
| **Status**   | Proposed / Accepted / Superseded by [ADR-NNNN](NNNN-Short-Title) / Withdrawn |
| **Date**     | YYYY-MM-DD                                                                   |
| **Deciders** | Who actually decided, by name                                                |

## Context

What is true right now that forces a decision. Constraints, costs, what was
already tried, what breaks if nothing changes.

Write this part as if the decision has not been made yet. An ADR whose context
only supports the option that won is a press release, and the next person cannot
tell whether the reasoning still holds.

## Decision

One paragraph, in the present tense: _We do X._

Be specific enough that someone can tell whether a future change contradicts it.
"We will be careful about dependencies" is not a decision.

## Consequences

What this costs, not only what it buys.

- **Good** — what gets easier.
- **Bad** — what gets harder, slower, or more expensive. Every real decision has
  something here; if this list is empty, the ADR is not finished.
- **Neutral** — what changes shape without getting better or worse.

## Alternatives considered

The options that lost, and the reason each one lost. Include doing nothing.

This is the section that pays for the ADR. Six months from now someone will
propose one of these again, and the question will be whether the reason it lost
is still true.
