#!/usr/bin/env bash
#
# Mirror the wiki/ directory into this repository's GitHub wiki.
#
# wiki/ is the source of truth. This script makes the wiki repository match it
# exactly — pages deleted here are deleted there, and pages edited through the
# GitHub wiki UI are overwritten. That is the point: one source, reviewed in a
# pull request like any other change.
#
# Called by .github/workflows/wiki.yml. Runs locally too, from a checkout whose
# origin is the repository (WIKI_URL defaults to origin's URL with .wiki.git):
#
#   ./scripts/wiki-sync.sh
#   WIKI_URL="https://github.com/OWNER/REPO.wiki.git" ./scripts/wiki-sync.sh
#
# Outside CI, a machine that guards plain `git push` behind a `push-confirm`
# alias gets the push through that alias, so the guard still asks.
#
# One-time setup, and the thing that surprises everyone: enabling Wikis in the
# repository settings does not create the <repo>.wiki.git remote. GitHub creates
# it only when the first page is saved in the wiki UI. Until then every push here
# fails with "Repository not found", so create one throwaway page by hand — this
# sync overwrites it on the next run.
#
# Environment:
#   WIKI_URL           push URL of the <repo>.wiki.git remote; defaults to the
#                      origin remote's URL with .git replaced by .wiki.git
#   GIT_AUTHOR_NAME    optional — defaults to the author of the source commit
#   GIT_AUTHOR_EMAIL   optional
#
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"

if [ -z "${WIKI_URL:-}" ]; then
  if ! origin_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null)"; then
    echo "wiki-sync: WIKI_URL is not set and there is no origin remote to derive it from" >&2
    exit 1
  fi
  WIKI_URL="${origin_url%.git}.wiki.git"
fi
source_dir="${repo_root}/wiki"

if [ ! -d "${source_dir}" ]; then
  echo "wiki-sync: ${source_dir} does not exist — nothing to publish" >&2
  exit 1
fi

if [ -z "$(find "${source_dir}" -mindepth 1 -print -quit)" ]; then
  echo "wiki-sync: wiki/ is empty; refusing to wipe the published wiki" >&2
  exit 1
fi

# Attribute the wiki commit to whoever wrote the source commit, not to the CI
# identity that happened to run the job. The published history should name the
# person who edited the page.
if [ -z "${GIT_AUTHOR_NAME:-}" ]; then
  GIT_AUTHOR_NAME="$(git -C "${repo_root}" log -1 --format='%an')"
fi
if [ -z "${GIT_AUTHOR_EMAIL:-}" ]; then
  GIT_AUTHOR_EMAIL="$(git -C "${repo_root}" log -1 --format='%ae')"
fi
export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL
export GIT_COMMITTER_NAME="${GIT_AUTHOR_NAME}"
export GIT_COMMITTER_EMAIL="${GIT_AUTHOR_EMAIL}"

work_dir="$(mktemp -d)"
cleanup() { rm -rf "${work_dir}"; }
trap cleanup EXIT

# A failed clone is not recoverable here: pushing to a wiki remote that GitHub
# has not created yet fails the same way, so say what the one-time fix is instead
# of dying on a bare "Repository not found".
if ! git clone --quiet --depth 1 "${WIKI_URL}" "${work_dir}/wiki" 2>/dev/null; then
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::error title=Wiki not initialised::Create one page in the Wiki tab, then re-run. GitHub does not create <repo>.wiki.git until a page exists."
  fi
  cat >&2 <<'HINT'
wiki-sync: cannot reach the wiki repository.

Enabling Wikis in Settings is not enough — GitHub creates <repo>.wiki.git only
once the first page is saved through the wiki UI, and a push cannot create it.

One-time fix:
  1. Open the repository's Wiki tab and create a page with any content.
  2. Re-run this sync. It overwrites that page from wiki/.

If the wiki already has pages, this is a permissions problem instead: the job
needs `permissions: contents: write`, and Wikis must still be enabled.
HINT
  exit 1
fi

cd "${work_dir}/wiki"
branch="$(git symbolic-ref --quiet --short HEAD)"

# Replace the tracked content wholesale rather than merging: the mirror must be
# able to express a deletion, and .git is the only thing worth preserving.
find . -mindepth 1 -maxdepth 1 -not -name '.git' -exec rm -rf {} +
cp -R "${source_dir}/." .

git add --all

if git diff --cached --quiet; then
  echo "wiki-sync: the published wiki already matches wiki/ — nothing to do"
  exit 0
fi

short_sha="${GITHUB_SHA:-$(git -C "${repo_root}" rev-parse --short HEAD)}"
git commit --quiet --no-verify \
  --message "docs(wiki): sync from ${short_sha:0:12}" \
  --message "Generated from wiki/ by scripts/wiki-sync.sh. Do not edit pages in the GitHub wiki UI."

if [ -z "${GITHUB_ACTIONS:-}" ] && git config --get alias.push-confirm >/dev/null; then
  # --no-rebase: the clone was taken moments ago and the mirror replaces the
  # wiki wholesale, so there is nothing to rebase onto.
  git push-confirm --no-rebase origin "HEAD:${branch}"
else
  git push --quiet origin "HEAD:${branch}"
fi
echo "wiki-sync: published $(find . -name '*.md' -not -path './.git/*' | wc -l | tr -d ' ') page(s)"
