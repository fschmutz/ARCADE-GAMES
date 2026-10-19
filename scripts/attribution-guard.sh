#!/usr/bin/env bash
# Attribution guard. Fails when a commit or a pull request claims authorship this repository
# does not own:
#   - a commit whose author or committer e-mail is not listed in .github/attribution-allow.txt;
#   - an author or committer name, a commit message, a pull request title or body carrying a
#     co-author trailer or the signature of an AI coding tool.
#
# The allow list holds identities, not tools: adding a tool there defeats the guard. Lift a
# false positive by narrowing the pattern, never by deleting the check.
#
# Usage:
#   scripts/attribution-guard.sh --range <base>..<head>
#   scripts/attribution-guard.sh --text-file <path> --label 'pull request body'
#   scripts/attribution-guard.sh --identity 'Name <mail@example.com>'
#   scripts/attribution-guard.sh --allow-file <path>   (default .github/attribution-allow.txt)
#
# Exit status: 0 clean, 1 violations reported, 2 bad usage or unreadable allow list.
set -euo pipefail

ALLOW_FILE='.github/attribution-allow.txt'
RANGE=''
LABEL=''
TEXT_FILES=()
IDENTITIES=()
VIOLATIONS=0

# Pattern / description pairs, matched case-insensitively as extended regular expressions.
# Names stay narrow on purpose: this repository ships a CLAUDE.md, so the plain word is not a
# violation while "Claude Code" and anthropic.com are.
FORBIDDEN=(
  '(co-authored-by|co-committed-by|assisted-by|generated-by|authored-with):' 'attribution trailer'
  'generated (with|by) +\[?(cursor|claude|chatgpt|copilot|codex|devin|gemini|an ai|ai agent)' 'AI tool attribution'
  '(claude code|claude\.ai|anthropic\.com)' 'Claude attribution'
  '(chatgpt|openai\.com|codex cli)' 'OpenAI attribution'
  '(github copilot|copilot-swe-agent)' 'Copilot attribution'
  '(cursor agent|cursoragent@|cursor\.com)' 'Cursor attribution'
  '(^|[^[:alnum:]])devin([^[:alnum:]]|$)' 'Devin attribution'
  '🤖' 'robot emoji attribution'
)

die() { printf 'attribution-guard: %s\n' "$1" >&2; exit 2; }

report() {
  printf '::error::%s\n' "$1"
  VIOLATIONS=$((VIOLATIONS + 1))
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --range) [ $# -ge 2 ] || die "--range needs a value"; RANGE="$2"; shift 2 ;;
    --allow-file) [ $# -ge 2 ] || die "--allow-file needs a value"; ALLOW_FILE="$2"; shift 2 ;;
    --label) [ $# -ge 2 ] || die "--label needs a value"; LABEL="$2"; shift 2 ;;
    --text-file) [ $# -ge 2 ] || die "--text-file needs a value"; TEXT_FILES+=("$2"); shift 2 ;;
    --identity) [ $# -ge 2 ] || die "--identity needs a value"; IDENTITIES+=("$2"); shift 2 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) die "unknown argument \"$1\"" ;;
  esac
done

[ -r "$ALLOW_FILE" ] || die "allow list \"$ALLOW_FILE\" is missing or unreadable"

# One lower-cased entry per line, comments and blank lines dropped. An entry is either a bare
# e-mail, which allows any display name using it, or a full "Name <mail>" identity.
ALLOW=()
while IFS= read -r line; do
  line="${line%%#*}"
  line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  [ -n "$line" ] && ALLOW+=("$(lower "$line")")
done < "$ALLOW_FILE"
[ ${#ALLOW[@]} -gt 0 ] || die "allow list \"$ALLOW_FILE\" holds no identity"

# Reports every forbidden pattern found in $2, prefixed by the human-readable origin $1.
scan_text() {
  local where="$1" text="$2" i pattern description
  for ((i = 0; i < ${#FORBIDDEN[@]}; i += 2)); do
    pattern="${FORBIDDEN[i]}"
    description="${FORBIDDEN[i + 1]}"
    if printf '%s' "$text" | grep -Eiq -- "$pattern"; then
      report "$where: $description"
      printf '%s' "$text" | grep -Ein -- "$pattern" | sed 's/^/    /'
    fi
  done
}

identity_allowed() {
  local email identity entry
  email="$(lower "$2")"
  identity="$(lower "$1 <$2>")"
  for entry in "${ALLOW[@]}"; do
    [ "$entry" = "$email" ] && return 0
    [ "$entry" = "$identity" ] && return 0
  done
  return 1
}

# A name is checked against the allow list through identity_allowed and against the forbidden
# patterns here, so an allowed e-mail cannot smuggle a tool name into the display name.
check_identity() {
  local where="$1" role="$2" name="$3" email="$4"
  if ! identity_allowed "$name" "$email"; then
    report "$where: $role \"$name <$email>\" is not in $ALLOW_FILE"
  fi
  scan_text "$where: $role name" "$name"
}

for identity in "${IDENTITIES[@]:-}"; do
  [ -n "$identity" ] || continue
  case "$identity" in
    *'<'*'>'*) ;;
    *) die "identity \"$identity\" is not of the form \"Name <mail@example.com>\"" ;;
  esac
  name="${identity%%<*}"
  name="$(printf '%s' "$name" | sed 's/[[:space:]]*$//')"
  email="${identity#*<}"
  email="${email%%>*}"
  check_identity "${LABEL:-identity}" 'identity' "$name" "$email"
done

for file in "${TEXT_FILES[@]:-}"; do
  [ -n "$file" ] || continue
  [ -r "$file" ] || die "text file \"$file\" is missing or unreadable"
  scan_text "${LABEL:-$file}" "$(cat "$file")"
done

if [ -n "$RANGE" ]; then
  git rev-parse --quiet --verify HEAD >/dev/null 2>&1 || die "not inside a git repository with commits"
  commits="$(git log --format=%H "$RANGE" --)" || die "cannot list commits in \"$RANGE\""
  if [ -z "$commits" ]; then
    printf 'attribution-guard: no commit in %s\n' "$RANGE"
  fi
  for sha in $commits; do
    short="${sha:0:12}"
    check_identity "commit $short" 'author' "$(git log -1 --format=%an "$sha")" "$(git log -1 --format=%ae "$sha")"
    check_identity "commit $short" 'committer' "$(git log -1 --format=%cn "$sha")" "$(git log -1 --format=%ce "$sha")"
    scan_text "commit $short message" "$(git log -1 --format=%B "$sha")"
  done
fi

if [ "$VIOLATIONS" -gt 0 ]; then
  printf '::error::attribution guard: %d violation(s); see %s\n' "$VIOLATIONS" "$ALLOW_FILE"
  exit 1
fi
printf 'attribution guard: every identity is allowed and no text claims foreign authorship\n'
