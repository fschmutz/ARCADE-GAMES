#!/usr/bin/env bash
#
# Apply .github/rulesets/main.example.json (or another ruleset file, such as
# multi-branch.example.json for a dev/preprod/prod repository) to a
# repository, or show what it would do.
#
# The JSON file in the repository protects nothing. A ruleset only exists once
# somebody creates it through the API or the Settings UI, and that is on purpose:
# a template that applied branch protection to itself on every clone would be a
# template that locks a repository before anyone has decided who owns it.
#
# This script is the deliberate step. It is never run by CI.
#
#   ./scripts/apply-ruleset.sh                       # plan against the current repo
#   ./scripts/apply-ruleset.sh --apply               # create or update the ruleset
#   ./scripts/apply-ruleset.sh -R OWNER/REPO --apply
#   ./scripts/apply-ruleset.sh -f path/to/other.json
#   ./scripts/apply-ruleset.sh -f .github/rulesets/multi-branch.example.json
#
# Re-running is safe: a ruleset with the same name is updated in place rather
# than duplicated.
#
# Requires: gh (authenticated), jq.
#
# Exit 3: the repository cannot have rulesets (private on a GitHub Free plan).
#
set -euo pipefail

ruleset_file=".github/rulesets/main.example.json"
repo=""
apply=false

usage() {
  sed -n '3,23p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --apply)      apply=true; shift ;;
    -R|--repo)    repo="${2:-}"; shift 2 ;;
    -f|--file)    ruleset_file="${2:-}"; shift 2 ;;
    -h|--help)    usage; exit 0 ;;
    *)            echo "apply-ruleset: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

for tool in gh jq; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "apply-ruleset: ${tool} is required but not installed" >&2
    exit 1
  fi
done

if [ ! -f "${ruleset_file}" ]; then
  echo "apply-ruleset: ${ruleset_file} does not exist" >&2
  exit 1
fi

if ! jq empty "${ruleset_file}" 2>/dev/null; then
  echo "apply-ruleset: ${ruleset_file} is not valid JSON" >&2
  exit 1
fi

if [ -z "${repo}" ]; then
  repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

name="$(jq -r '.name' "${ruleset_file}")"
branches="$(jq -r '.conditions.ref_name.include // [] | join(", ")' "${ruleset_file}")"
echo "repository : ${repo}"
echo "ruleset    : ${name}  (from ${ruleset_file})"
echo "branches   : ${branches:-none}"
echo

# The footgun this script exists to catch. A required status check that no
# workflow ever reports leaves every pull request permanently pending, and the
# only way out is an admin bypass. Compare the contexts in the JSON against the
# job names this repository actually produces.
mapfile -t contexts < <(
  jq -r '.rules[]? | select(.type == "required_status_checks")
         | .parameters.required_status_checks[]?.context' "${ruleset_file}"
)

if [ "${#contexts[@]}" -gt 0 ]; then
  echo "required status checks:"
  for context in "${contexts[@]}"; do
    if grep -rqF "name: ${context}" .github/workflows/ 2>/dev/null; then
      echo "  ok      ${context}"
    else
      echo "  UNKNOWN ${context}  — no job with this name in .github/workflows/"
    fi
  done
  echo
  echo "A required check that never reports blocks every pull request. Fix the"
  echo "names above before applying, or drop the rule."
  echo
fi

# A failed read is never an empty list: on a private repository of a GitHub
# Free account the API answers 403 "Upgrade to GitHub Pro", and planning a
# CREATE that can never happen would hide that nothing will protect the branch.
if ! rulesets_json="$(gh api "repos/${repo}/rulesets" 2>&1)"; then
  if grep -q 'Upgrade to GitHub Pro' <<<"${rulesets_json}"; then
    echo "apply-ruleset: ${repo} cannot have rulesets: it is private on a GitHub Free plan." >&2
    echo "Upgrade the account, make the repository public, or record the exception;" >&2
    echo "see wiki/Getting-Started.md, step 6." >&2
    exit 3
  fi
  echo "apply-ruleset: could not read the rulesets of ${repo}: ${rulesets_json}" >&2
  exit 1
fi
# shellcheck disable=SC2016  # $name is a jq variable bound by --arg, not a shell one.
existing_id="$(jq -r --arg name "${name}" \
  'map(select(.name == $name)) | first | .id // empty' <<<"${rulesets_json}")"

if [ "${apply}" != true ]; then
  if [ -n "${existing_id}" ]; then
    echo "plan: would UPDATE ruleset ${existing_id} (${name}) on ${repo}"
  else
    echo "plan: would CREATE ruleset ${name} on ${repo}"
  fi
  echo "Re-run with --apply to do it."
  exit 0
fi

if [ -n "${existing_id}" ]; then
  gh api -X PUT "repos/${repo}/rulesets/${existing_id}" --input "${ruleset_file}" >/dev/null
  echo "updated ruleset ${existing_id} (${name}) on ${repo}"
else
  new_id="$(gh api -X POST "repos/${repo}/rulesets" --input "${ruleset_file}" --jq '.id')"
  echo "created ruleset ${new_id} (${name}) on ${repo}"
fi

echo
gh api "repos/${repo}/rulesets" --jq '.[] | "\(.id)\t\(.name)\t\(.enforcement)"'
