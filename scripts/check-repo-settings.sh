#!/usr/bin/env bash
#
# Check the GitHub settings this pack expects on a live repository (Getting
# Started, steps 2, 6 and 7), or set the ones an API call can set.
#
# The files in the repository cannot carry these: the About box, the features,
# the merge buttons and the ruleset live in GitHub, and a copy of the template
# starts with every one of them at GitHub's default. This script is the list.
#
#   ./scripts/check-repo-settings.sh                    # check the current repo
#   ./scripts/check-repo-settings.sh -R OWNER/REPO
#   ./scripts/check-repo-settings.sh --apply \
#       --description "What this repository is, in one line" \
#       --topics "bam,aws,python" [--homepage https://...]
#
# --apply sets the About box (only the fields given) and the features and merge
# settings below, except any key the repository declares. It never creates a
# ruleset (scripts/apply-ruleset.sh does), never touches security settings, and
# never writes the wiki.
#
# A requirement that does not hold for this repository on purpose is declared,
# never skipped: one line per key in .github/repo-settings-exceptions.txt, as
#   ruleset: private repository on GitHub Free, the owner is the only writer
#   merge: rebase merge only, the site tooling lands pull requests by rebase
# It prints as DECLARED, and --apply leaves that setting alone. The file is
# read from the checkout when it is the repository checked, otherwise from the
# repository's default branch. Keys: description, topics, wiki, wiki-page,
# issues, projects, discussions, merge, delete-branch, secret-scanning,
# push-protection, vulnerability-reporting, ruleset.
#
# Exit 0 when every check is ok or declared, 1 otherwise, 2 on bad usage.
#
# Requires: gh (authenticated with admin read on the repository), jq, git.
#
set -euo pipefail

repo=""
apply=false
description=""
topics=""
homepage=""
exceptions_file=".github/repo-settings-exceptions.txt"
json=""

usage() {
  sed -n '3,33p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --apply)       apply=true; shift ;;
    -R|--repo)     repo="${2:-}"; shift 2 ;;
    --description) description="${2:-}"; shift 2 ;;
    --topics)      topics="${2:-}"; shift 2 ;;
    --homepage)    homepage="${2:-}"; shift 2 ;;
    -h|--help)     usage; exit 0 ;;
    *)             echo "check-repo-settings: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

for tool in gh jq git; do
  command -v "${tool}" >/dev/null 2>&1 || { echo "check-repo-settings: ${tool} is required" >&2; exit 1; }
done

if [ -z "${repo}" ]; then
  repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

# The declarations of the repository being checked: the local file when this
# checkout is that repository (so a declaration can be tested before it is
# pushed), otherwise the file on its default branch.
exceptions=""
local_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)"
if [ "${local_repo}" = "${repo}" ] && [ -f "${exceptions_file}" ]; then
  exceptions="$(cat "${exceptions_file}")"
else
  exceptions="$(gh api -H 'Accept: application/vnd.github.raw' \
    "repos/${repo}/contents/${exceptions_file}" 2>/dev/null || true)"
fi

declared() {
  grep -E "^$1:" <<<"${exceptions}" | head -1 | sed -E "s/^$1:[[:space:]]*//"
}

if [ "${apply}" = true ]; then
  args=(-X PATCH "repos/${repo}")
  set_fields=()
  kept=()
  # want KEY FIELD=VALUE...: set the fields unless the repository declares KEY.
  want() {
    local key="$1"; shift
    if [ -n "$(declared "${key}" || true)" ]; then
      kept+=("${key}")
      return
    fi
    set_fields+=("${key}")
    for field in "$@"; do args+=(-F "${field}"); done
  }
  want wiki has_wiki=true
  want issues has_issues=true
  want projects has_projects=false
  want discussions has_discussions=false
  want merge allow_squash_merge=true allow_merge_commit=false allow_rebase_merge=false
  want delete-branch delete_branch_on_merge=true
  [ -n "${description}" ] && args+=(-f "description=${description}") && set_fields+=(description)
  [ -n "${homepage}" ] && args+=(-f "homepage=${homepage}") && set_fields+=(homepage)
  # Topics first, so the PATCH response below already carries them.
  if [ -n "${topics}" ]; then
    jq -n --arg t "${topics}" '{names: ($t | split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(. != "")))}' |
      gh api -X PUT "repos/${repo}/topics" --input - >/dev/null
    set_fields+=(topics)
  fi
  # The checks read the PATCH response: a GET right after a write can still
  # return the old values for a moment and report a FAIL that is not there.
  json="$(gh api "${args[@]}")"
  echo "applied on ${repo}: ${set_fields[*]:-nothing}"
  [ "${#kept[@]}" -gt 0 ] && echo "kept as declared: ${kept[*]}"
  echo
fi

[ -n "${json:-}" ] || json="$(gh api "repos/${repo}")"
get() { jq -r "$1" <<<"${json}"; }

failed=0

# check KEY OK? LABEL HINT
check() {
  local key="$1" ok="$2" label="$3" hint="$4" reason
  if [ "${ok}" = true ]; then
    printf '  ok        %s\n' "${label}"
  elif reason="$(declared "${key}")" && [ -n "${reason}" ]; then
    printf '  DECLARED  %s  (%s)\n' "${label}" "${reason}"
  else
    printf '  FAIL      %s  — %s\n' "${label}" "${hint}"
    failed=1
  fi
}

is() { [ "$(get "$1")" = "$2" ] && echo true || echo false; }

private="$(get '.private')"
echo "repository : ${repo} ($( [ "${private}" = true ] && echo private || echo public ))"
echo

echo "About:"
check description "$( [ -n "$(get '.description // ""')" ] && echo true || echo false)" \
  "description: $(get '.description // "(empty)"')" "one line saying what the repository is (--description)"
check topics "$( [ "$(get '.topics | length')" -gt 0 ] && echo true || echo false)" \
  "topics: $(get '.topics | join(", ")')" "at least one topic, so the repository can be found (--topics)"
printf '  info      homepage: %s\n' "$(get '.homepage // ""' | sed 's/^$/(none; set it when the repository has a site)/')"

echo "Features:"
check wiki "$(is .has_wiki true)" "wikis on" "wiki.yml publishes wiki/ there"
if [ "$(get .has_wiki)" = true ]; then
  wiki_ok=false
  git ls-remote "git@github.com:${repo}.wiki.git" >/dev/null 2>&1 && wiki_ok=true
  check wiki-page "${wiki_ok}" "wiki repository exists" "save one page in the Wiki tab (step 7b), then run the wiki workflow"
fi
check issues "$(is .has_issues true)" "issues on" "the issue forms need it"
check projects "$(is .has_projects false)" "projects off" "turn it off until someone runs them"
check discussions "$(is .has_discussions false)" "discussions off" "turn it off until someone runs them"

echo "Pull requests:"
merge_ok=false
[ "$(get '[.allow_squash_merge, .allow_merge_commit, .allow_rebase_merge] | map(tostring) | join(",")')" = "true,false,false" ] && merge_ok=true
check merge "${merge_ok}" "squash merge only" "untick merge commits and rebase merging"
check delete-branch "$(is .delete_branch_on_merge true)" "delete head branches" "Settings → General → Pull Requests"

echo "Security:"
# GitHub reports no status at all where the feature does not exist (a private
# repository on GitHub Free): that is a declare, not a toggle.
sec_hint="Settings → Advanced Security"
[ "$(get '.security_and_analysis.secret_scanning.status // "none"')" = none ] &&
  sec_hint="GitHub offers none on this plan: upgrade, go public, or declare it"
check secret-scanning "$(is '.security_and_analysis.secret_scanning.status // "unknown"' enabled)" \
  "secret scanning" "${sec_hint}"
check push-protection "$(is '.security_and_analysis.secret_scanning_push_protection.status // "unknown"' enabled)" \
  "push protection" "${sec_hint}"
if [ "${private}" = false ]; then
  pvr=false
  [ "$(gh api "repos/${repo}/private-vulnerability-reporting" --jq '.enabled' 2>/dev/null)" = true ] && pvr=true
  check vulnerability-reporting "${pvr}" "private vulnerability reporting" "public repositories enable it (step 2)"
fi

echo "Branch protection:"
ruleset_ok=false
if rulesets="$(gh api "repos/${repo}/rulesets" 2>&1)"; then
  [ "$(jq '[.[] | select(.enforcement == "active")] | length' <<<"${rulesets}")" -gt 0 ] && ruleset_ok=true
  hint="scripts/apply-ruleset.sh --apply (step 6)"
elif grep -q 'Upgrade to GitHub Pro' <<<"${rulesets}"; then
  hint="private on GitHub Free: upgrade, go public, or declare it (step 6)"
else
  hint="could not read the rulesets: ${rulesets}"
fi
check ruleset "${ruleset_ok}" "an active ruleset" "${hint}"

echo
if [ "${failed}" -ne 0 ]; then
  echo "check-repo-settings: ${repo} is missing settings above"
  exit 1
fi
echo "check-repo-settings: ${repo} ok"
