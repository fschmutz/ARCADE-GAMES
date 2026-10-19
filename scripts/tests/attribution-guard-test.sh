#!/usr/bin/env bash
# Tests scripts/attribution-guard.sh against scripts/tests/fixtures/ and against commits made
# in a throwaway repository, so the guard that gates every pull request is itself gated.
#
# Usage: scripts/tests/attribution-guard-test.sh
# Exit status: 0 every case passed, 1 at least one case failed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$ROOT/scripts/attribution-guard.sh"
FIXTURES="$ROOT/scripts/tests/fixtures"
ALLOW="$FIXTURES/attribution-allow.txt"
PASSED=0
FAILED=0

pass() { PASSED=$((PASSED + 1)); printf 'ok    %s\n' "$1"; }
fail() { FAILED=$((FAILED + 1)); printf 'FAIL  %s\n' "$1"; }

# expect <exit status> <name> -- <guard arguments...>
# Asserts the guard's exit status, and that a failure names the expected cause when a
# PATTERN is exported for the case.
expect() {
  local want="$1" name="$2" output status
  shift 3
  set +e
  output="$("$GUARD" "$@" 2>&1)"
  status=$?
  set -e
  if [ "$status" != "$want" ]; then
    fail "$name (exit $status, expected $want)"
    printf '%s\n' "$output" | sed 's/^/      /'
    return
  fi
  if [ -n "${PATTERN:-}" ] && ! printf '%s' "$output" | grep -Eq -- "$PATTERN"; then
    fail "$name (exit $status as expected, but no match for \"$PATTERN\")"
    printf '%s\n' "$output" | sed 's/^/      /'
    return
  fi
  pass "$name"
}

# Text scanning.
PATTERN='' expect 0 'a clean commit message passes' -- \
  --allow-file "$ALLOW" --text-file "$FIXTURES/attribution-clean-message.txt"
PATTERN='attribution trailer' expect 1 'a Co-authored-by trailer fails' -- \
  --allow-file "$ALLOW" --text-file "$FIXTURES/attribution-trailer-message.txt"
PATTERN='Claude attribution' expect 1 'a tool signature in a commit message fails' -- \
  --allow-file "$ALLOW" --text-file "$FIXTURES/attribution-tool-message.txt"
PATTERN='robot emoji attribution' expect 1 'a robot emoji fails' -- \
  --allow-file "$ALLOW" --text-file "$FIXTURES/attribution-tool-message.txt"
PATTERN='' expect 0 'a clean pull request body passes' -- \
  --allow-file "$ALLOW" --text-file "$FIXTURES/attribution-clean-body.md"
PATTERN='pull request body: Cursor attribution' expect 1 'a platform footer in a body fails' -- \
  --allow-file "$ALLOW" --label 'pull request body' \
  --text-file "$FIXTURES/attribution-footer-body.md"

# Identities.
PATTERN='' expect 0 'an allowed e-mail passes under any display name' -- \
  --allow-file "$ALLOW" --identity 'Lino from Marrakech <lino@example.com>'
PATTERN='' expect 0 'an allowed full identity passes' -- \
  --allow-file "$ALLOW" --identity 'Release Bot <bot@example.com>'
PATTERN='is not in' expect 1 'an unlisted e-mail fails' -- \
  --allow-file "$ALLOW" --identity 'Lino from Marrakech <lino@elsewhere.example>'
PATTERN='is not in' expect 1 'a full-identity entry does not allow another name' -- \
  --allow-file "$ALLOW" --identity 'Someone Else <bot@example.com>'
PATTERN='Cursor attribution' expect 1 'a tool name on an allowed e-mail fails' -- \
  --allow-file "$ALLOW" --identity 'Cursor Agent <lino@example.com>'

# Usage and configuration errors are status 2, never a silent pass.
PATTERN='' expect 2 'a missing allow list is a configuration error' -- \
  --allow-file "$FIXTURES/does-not-exist.txt" --identity 'Lino <lino@example.com>'
PATTERN='' expect 2 'an unknown argument is a usage error' -- --allow-file "$ALLOW" --nope
PATTERN='' expect 2 'a malformed identity is a usage error' -- \
  --allow-file "$ALLOW" --identity 'lino@example.com'

# Commit ranges, in a repository built for the test.
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
sandbox_git() { git -C "$SANDBOX" -c commit.gpgsign=false -c core.hooksPath=/dev/null "$@"; }
sandbox_commit() {
  local name="$1" email="$2" message="$3"
  printf '%s\n' "$message" > "$SANDBOX/file.txt"
  sandbox_git add file.txt
  GIT_AUTHOR_NAME="$name" GIT_AUTHOR_EMAIL="$email" \
    GIT_COMMITTER_NAME="$name" GIT_COMMITTER_EMAIL="$email" \
    sandbox_git commit --quiet --no-verify --message "$message"
}
git -c init.defaultBranch=main init --quiet "$SANDBOX"
sandbox_commit 'Lino from Marrakech' 'lino@example.com' 'chore: base commit'
BASE="$(sandbox_git rev-parse HEAD)"
sandbox_commit 'Lino from Marrakech' 'lino@example.com' 'feat(snake): portals mode'

cd "$SANDBOX"
PATTERN='' expect 0 'a range of clean commits passes' -- \
  --allow-file "$ALLOW" --range "$BASE..HEAD"

sandbox_commit 'Cursor Agent' 'cursoragent@cursor.com' 'feat(course): nitro recharge'
PATTERN='commit [0-9a-f]+: author "Cursor Agent <cursoragent@cursor.com>" is not in' \
  expect 1 'a commit by an unlisted identity fails' -- \
  --allow-file "$ALLOW" --range "$BASE..HEAD"

sandbox_git reset --hard --quiet "$BASE"
sandbox_commit 'Lino from Marrakech' 'lino@example.com' \
  'feat(pacman): chrono mode

Co-authored-by: Someone Else <someone@example.com>'
PATTERN='message: attribution trailer' expect 1 'a trailer inside a committed message fails' -- \
  --allow-file "$ALLOW" --range "$BASE..HEAD"

PATTERN='no commit in' expect 0 'an empty range passes' -- \
  --allow-file "$ALLOW" --range "HEAD..HEAD"
cd "$ROOT"

# This repository's own allow list must parse and hold the maintainer.
PATTERN='' expect 0 "the repository allow list accepts the maintainer" -- \
  --identity 'fschmutz <fschmutz@premaccess.com>'
PATTERN='is not in' expect 1 "the repository allow list rejects an unknown identity" -- \
  --identity 'Someone Else <someone@example.com>'

printf '\n%d passed, %d failed\n' "$PASSED" "$FAILED"
[ "$FAILED" -eq 0 ]
