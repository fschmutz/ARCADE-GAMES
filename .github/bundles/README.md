# `.github/bundles/` — deliberately inactive

Nothing in this directory runs. Every file here ends in `.disabled` or
`.example`, which is what keeps it inert:

- GitHub only executes workflows that sit in `.github/workflows/` and end in
  `.yml` or `.yaml`. A file called `scorecard.yml.disabled`, in a directory
  called `bundles`, fails both tests twice over.
- `.example` files are read by humans and by nothing else. GitHub does not
  recognise `CODE_OF_CONDUCT.md.example` as a community file.

CI enforces the convention: the `template structure` job fails if any file here
is missing one of those suffixes, so a bundle cannot be switched on by accident
— only on purpose.

## Why ship files that do not run

Because the alternative is worse in both directions. Shipping all of this active
gives every new repository a production platform's CI bill on day one, which is
the BAM-PROD-ENGINE lesson. Shipping none of it means the next repository
reinvents release automation by hand, differently, with a different pin and a
different set of permissions.

A file that is present, readable, reviewed, and inert costs nothing and is one
rename away from working. The reasoning for each default lives in the file it
applies to. The full decision is [ADR-0001](../../wiki/ADR/0001-Ship-Enhancements-As-Bundles.md).

## What is here

| Directory    | Bundle                 | Contents                                                      |
| ------------ | ---------------------- | ------------------------------------------------------------- |
| `release/`   | F — Release            | Release automation and SBOM, both `workflow_dispatch`-shaped  |
| `community/` | G — Public / community | The files a repository needs only if it goes public           |
| `security/`  | H — Heavy security     | OpenSSF Scorecard, which is expensive on a private repository |

Each directory has its own README with the enable and remove steps.
[Bundles](../../wiki/Bundles.md) has the whole map in one table.

## Enabling anything here

The mechanics are always the same — move it and drop the suffix:

```bash
git mv .github/bundles/release/release-please.yml.disabled \
       .github/workflows/release-please.yml
```

Two things to do before you open the pull request, every time:

1. **Re-resolve the pinned SHAs.** Dependabot only scans `.github/workflows/`,
   so the pins in these files are frozen at the day the bundle was written and
   are certainly stale.

   ```bash
   gh api repos/OWNER/ACTION/git/ref/tags/vX.Y.Z --jq '.object.sha'
   ```

   Dereference once more with `gh api repos/OWNER/ACTION/git/tags/<sha> --jq '.object.sha'`
   when the tag is annotated.

2. **Read the header comment.** Each file says what it costs to run and what it
   needs from repository settings. None of them is free, which is why none of
   them is on.

Removing a bundle is `git rm -r` on its directory. Nothing depends on it.
