#!/usr/bin/env bash
# One doc surface: wiki/ is the documentation, docs/ holds screenshots only.
#
# Fails when
#   - a tracked file sits under docs/ outside docs/screenshots/;
#   - a wiki page links to a docs/ path other than docs/screenshots/ (a link into the
#     old doc tree is dead once the move is done).
# Prints each offender, then exits 1. Exit 0 prints one summary line.
#
# A file that must stay under docs/ (a generated contract another system reads
# at that path) is declared, never skipped: one line per path in
# .github/doc-surface-exceptions.txt,
#   docs/schemas/: JSON schemas, published as-is to the API consumers
#   docs/capabilities.json: generated, the Console reads it from S3 at this path
# A path ending in / covers everything under it. A declared path passes, and so
# does a wiki link to it. An entry without a reason, outside docs/, or matching
# no tracked file fails: a declaration that outlives its file is drift too.
#
# Usage: scripts/check-doc-surface.sh   (from the repository root; reads git ls-files)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

readonly exceptions_file=".github/doc-surface-exceptions.txt"

fail=0
declared_paths=()

if [ -f "$exceptions_file" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | '#'*) continue ;; esac
    path="${line%%:*}"
    reason="${line#*:}"
    reason="${reason#"${reason%%[![:space:]]*}"}"
    if [ "$path" = "$line" ] || [ -z "$reason" ]; then
      printf 'doc-surface: %s: "%s" has no reason (write "path: why it stays under docs/")\n' "$exceptions_file" "$line"
      fail=1
      continue
    fi
    case "$path" in
      docs/*) ;;
      *)
        printf 'doc-surface: %s: %s is not under docs/\n' "$exceptions_file" "$path"
        fail=1
        continue
        ;;
    esac
    if ! git ls-files -- "$path" | grep -q .; then
      printf 'doc-surface: %s: %s matches no tracked file (delete the stale entry)\n' "$exceptions_file" "$path"
      fail=1
      continue
    fi
    declared_paths+=("$path")
  done <"$exceptions_file"
fi

# is_declared PATH: true when PATH is a declared file or sits under a declared directory.
is_declared() {
  local declared
  for declared in "${declared_paths[@]+"${declared_paths[@]}"}"; do
    case "$declared" in
      */) [ "${1#"$declared"}" != "$1" ] && return 0 ;;
      *) [ "$1" = "$declared" ] && return 0 ;;
    esac
  done
  return 1
}

declared_count=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  if is_declared "$path"; then
    declared_count=$((declared_count + 1))
    continue
  fi
  printf 'doc-surface: %s is under docs/ (only docs/screenshots/ belongs there; move pages to wiki/)\n' "$path"
  fail=1
done < <(git ls-files -- docs | grep -v '^docs/screenshots/' || true)

if git ls-files -- 'wiki/*.md' 'wiki/**/*.md' | grep -q .; then
  # Markdown link or image target, or a bare path, starting with docs/ (optionally ./ or ../).
  # One hit per link (-o), not per line: a line that links docs/screenshots/ and
  # another docs/ path still reports the second one.
  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    target="${hit#*:*:}"
    target="docs/${target#*docs/}"
    target="${target%%#*}"
    is_declared "$target" && continue
    printf 'doc-surface: %s links into docs/ (link the wiki page instead)\n' "$hit"
    fail=1
  done < <(git ls-files -z -- 'wiki/*.md' 'wiki/**/*.md' \
    | xargs -0 grep -HnoE '(\(|[[:space:]]|^)(\./|(\.\./)+)?docs/[^[:space:])>]*' 2>/dev/null \
    | grep -vE '^[^:]+:[0-9]+:[([:space:]]?(\./|(\.\./)+)?docs/screenshots/' || true)
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
if [ "$declared_count" -gt 0 ]; then
  echo "doc-surface: ok (docs/ holds screenshots and ${declared_count} declared file(s); no wiki page links into docs/ otherwise)"
else
  echo "doc-surface: ok (docs/ holds screenshots only; no wiki page links into docs/)"
fi
