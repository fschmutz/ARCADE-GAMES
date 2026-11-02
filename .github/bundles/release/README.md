# Bundle F — Release

**Default: off.** Both files here are inert. Enable them on a repository that
ships a versioned artifact to somebody else — a library, a container image, a
CLI. An operator repository that is only ever deployed from `main` does not need
either of them, and a changelog nobody reads is worse than no changelog.

| File                          | What it does                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `release-please.yml.disabled` | Maintains a release pull request from conventional commits: version bump, `CHANGELOG.md`, tag, GitHub release |
| `sbom.yml.disabled`           | Generates a CycloneDX software bill of materials and attaches it to a release                                 |

## Enable

```bash
git mv .github/bundles/release/release-please.yml.disabled \
       .github/workflows/release-please.yml
```

Then, before opening the pull request:

1. **Re-resolve the pinned action SHAs.** Dependabot does not scan this
   directory, so the pins below are stale by definition.
2. **Read the header comment in the file.** Both start `workflow_dispatch`-only
   on purpose, so you can watch one run before it has opinions about `main`.
3. **Decide about the tag trigger.** `sbom.yml` is written to run on a release;
   release-please is written to run on a push to `main` once you uncomment it.

### release-please, specifically

- It needs `contents: write` and `pull-requests: write`. That is a real
  escalation over the rest of this template, which runs on `contents: read`.
- It replaces `CHANGELOG.md`. The hand-written Keep a Changelog file this
  template ships becomes generated output, and the `Unreleased` section stops
  being where you write things down.
- A `GITHUB_TOKEN`-created pull request does not trigger other workflows. If
  your release pull request must run CI, it needs a PAT or a GitHub App token,
  and that is a secret to own and rotate.
- Conventional commits stop being a convention and start being an API: a
  mistyped `feat:` cuts a minor version.

### SBOM, specifically

- Useful when someone outside the repository asks what is in the artifact — a
  customer security questionnaire, a procurement review, an incident where the
  question is "were we running the affected version".
- Pointless on a repository with no dependency manifest. It will happily produce
  an SBOM of nothing.

## Remove

```bash
git rm -r .github/bundles/release
```
