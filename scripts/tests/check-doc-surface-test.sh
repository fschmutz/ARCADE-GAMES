#!/usr/bin/env bash
#
# check-doc-surface-test.sh — the cases scripts/check-doc-surface.sh has to
# catch, and the ones it has to leave alone.
#
# Plain bash, like attribution-guard-test.sh. Each case builds a throwaway git
# repository holding a copy of the script and one wiki page or docs/ file, runs
# the script there, and asserts the exit status. The case that matters is the
# mixed line: a link into docs/screenshots/ next to a link into another docs/
# path must still fail, because the filter works per link, not per line.
#
#   scripts/tests/check-doc-surface-test.sh
#
# Exit 0 when every case holds, 1 otherwise.
#
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1

readonly SCRIPT="scripts/check-doc-surface.sh"

passed=0
failed=0
scratch="$(mktemp -d)"
trap 'rm -rf -- "${scratch}"' EXIT

# run_case NAME WANT_STATUS PATH CONTENT [PATH CONTENT]...
run_case() {
  local name="$1" want="$2" repo out status
  shift 2
  repo="${scratch}/${passed}-${failed}"
  mkdir -p "${repo}/scripts"
  cp "${SCRIPT}" "${repo}/scripts/"
  while [ $# -ge 2 ]; do
    mkdir -p "${repo}/$(dirname "$1")"
    printf '%s\n' "$2" >"${repo}/$1"
    shift 2
  done
  git -C "${repo}" init -q
  git -C "${repo}" add -A
  out="$(cd "${repo}" && ./scripts/check-doc-surface.sh 2>&1)"
  status=$?
  if [ "${status}" -eq "${want}" ]; then
    printf 'ok   %s\n' "${name}"
    passed=$((passed + 1))
  else
    printf 'FAIL %s (want exit %s, got %s)\n' "${name}" "${want}" "${status}"
    printf '     | %s\n' "${out}"
    failed=$((failed + 1))
  fi
}

run_case "a page with no docs/ link passes" 0 \
  wiki/Home.md 'See [Getting started](Getting-Started).'
run_case "a screenshot image passes" 0 \
  wiki/Home.md '![Home](../docs/screenshots/home.png)'
run_case "two screenshots on one line pass" 0 \
  wiki/Home.md '![a](docs/screenshots/a.png) ![b](./docs/screenshots/b.png)'
run_case "a link into docs/ fails" 1 \
  wiki/Home.md 'Read [the plan](../docs/PLAN.md).'
run_case "a bare docs/ path fails" 1 \
  wiki/Home.md 'The plan lives in docs/PLAN.md now.'
run_case "a screenshot and a docs/ link on one line fail" 1 \
  wiki/Home.md '![a](docs/screenshots/a.png) and [plan](docs/PLAN.md)'
run_case "a docs/ link before a screenshot on one line fails" 1 \
  wiki/Home.md '[plan](../docs/PLAN.md) ![a](../docs/screenshots/a.png)'
run_case "a page under docs/ fails" 1 \
  docs/PLAN.md '# Plan'
run_case "an image under docs/screenshots/ passes" 0 \
  docs/screenshots/home.png 'not really a png'

# --- declared exceptions (.github/doc-surface-exceptions.txt) -------------------

readonly EXC=".github/doc-surface-exceptions.txt"
run_case "a declared file passes" 0 \
  docs/capabilities.json '{}' "${EXC}" 'docs/capabilities.json: generated, read from S3'
run_case "a declared directory covers what is under it" 0 \
  docs/schemas/a.json '{}' docs/schemas/b.json '{}' "${EXC}" 'docs/schemas/: published schemas'
run_case "an undeclared file beside a declared one fails" 1 \
  docs/capabilities.json '{}' docs/PLAN.md '# Plan' "${EXC}" 'docs/capabilities.json: generated'
run_case "a wiki link to a declared file passes" 0 \
  docs/capabilities.json '{}' wiki/Home.md 'See [caps](../docs/capabilities.json).' \
  "${EXC}" 'docs/capabilities.json: generated'
run_case "a wiki link to an undeclared file still fails" 1 \
  docs/capabilities.json '{}' wiki/Home.md 'See [plan](../docs/PLAN.md).' \
  "${EXC}" 'docs/capabilities.json: generated'
run_case "an entry without a reason fails" 1 \
  docs/capabilities.json '{}' "${EXC}" 'docs/capabilities.json'
run_case "an entry matching no tracked file fails" 1 \
  docs/capabilities.json '{}' "${EXC}" $'docs/capabilities.json: generated\ndocs/gone.json: removed last month'
run_case "an entry outside docs/ fails" 1 \
  "${EXC}" 'wiki/Home.md: not a docs path'
run_case "comments and blank lines are ignored" 0 \
  docs/capabilities.json '{}' "${EXC}" $'# generated contracts\n\ndocs/capabilities.json: generated'

printf 'check-doc-surface-test: %s passed, %s failed\n' "${passed}" "${failed}"
[ "${failed}" -eq 0 ]
