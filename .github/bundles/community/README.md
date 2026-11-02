# Bundle G — Public / community

**Default: off.** Everything here is an `.example` or a `.disabled` file, and
GitHub does not recognise any of it in that state. This is the bundle a
repository needs the day it stops being private, and not a day before.

A private repository with a named owner does not need a code of conduct: there
is no anonymous public to set expectations for, and an unenforced policy file is
a liability rather than a signal. The same goes for funding links and a stale
bot on a repository where the only two contributors sit in the same company.

| File                         | Becomes                       | When you need it                                                                |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `CODE_OF_CONDUCT.md.example` | `CODE_OF_CONDUCT.md`          | The repository accepts contributions from outside the company                   |
| `FUNDING.yml.example`        | `.github/FUNDING.yml`         | Almost never for ScaleMeNow — it is here so the question is answered, not asked |
| `llms.txt.example`           | `llms.txt`                    | The repository is public and you want to steer what assistants read first       |
| `stale.yml.disabled`         | `.github/workflows/stale.yml` | Issue volume is high enough that triage has stopped happening                   |

## Enable

```bash
git mv .github/bundles/community/CODE_OF_CONDUCT.md.example CODE_OF_CONDUCT.md
git mv .github/bundles/community/FUNDING.yml.example        .github/FUNDING.yml
git mv .github/bundles/community/llms.txt.example           llms.txt
git mv .github/bundles/community/stale.yml.disabled         .github/workflows/stale.yml
```

Take only the ones you need. Then fill in the placeholders — every file here has
at least one, and a code of conduct with an unmonitored contact address is worse
than none, because it promises a response that nobody is on the hook for.

Re-resolve the pinned SHA in `stale.yml` before you enable it; Dependabot does
not scan this directory.

## Going public is more than these files

If the repository is actually going public, these files are the small part. The
rest:

- **Replace `LICENSE`.** The bundled one is proprietary, all rights reserved.
  Publishing a repository under it means nobody may legally use what they can
  read.
- **Read the whole history, not the tip.** `git log -p` and a fresh `gitleaks`
  run over the full history. A secret deleted in a later commit is still in the
  clone that a stranger makes thirty seconds after you flip the switch.
- **Check the wiki.** It becomes public with the repository, and it is the
  surface most likely to name a customer or an internal hostname.
- **Re-read `SECURITY.md`.** The scope paragraph was written for a private
  repository, and the reporting path now has to work for someone with no
  account relationship to the company.
- **Re-read `AGENTS.md` §5.** Nothing in the tree should point at internal
  doctrine that a public reader cannot reach.

## Discussions

Not a file, so there is nothing here to enable — Discussions is a repository
setting, Settings → Features → Discussions, and it is off by default.

Leave it off until someone owns it. An abandoned Discussions tab is a question
from eight months ago with no reply, sitting at the top of the page, and it
reads as "nobody is home" far more loudly than not having the tab at all.

When you do turn it on: move the _Questions_ traffic there and out of Issues,
keep issues for work that has an end state, and update the contact links in
`.github/ISSUE_TEMPLATE/config.yml` and `SUPPORT.md` to point at it.

## Remove

```bash
git rm -r .github/bundles/community
```
