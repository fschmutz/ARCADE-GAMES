#!/usr/bin/env bash
#
# check-screenshots.sh — every repository shows what it looks like.
#
# Screenshots are mandatory. This check passes in exactly two ways:
#
#   1. README.md has a `## Screenshots` section holding at least one image link
#      to a local file under docs/screenshots/ (.png, .jpg, .jpeg or .webp),
#      every such link has non-empty alt text, every docs/screenshots/ path that
#      README.md or wiki/**/*.md mentions exists, every image under
#      docs/screenshots/ is mentioned by one of them (no orphans), and every
#      image is at most 600 KB (614400 bytes).
#
#   2. .github/screenshots-exempt exists and its first line that is neither
#      blank nor a `#` comment states the reason this repository has nothing to
#      show (a pure library, a data-only repository). The check then passes and
#      prints that reason. An empty or comment-only exempt file fails: the
#      exemption is declared, never implied.
#
# Wiki pages may reference an image by its raw URL, e.g.
#   https://github.com/OWNER/REPO/raw/main/docs/screenshots/home.png
# Any `docs/screenshots/<file>` token counts as a reference, so the URL form
# satisfies the orphan check and must point at a file that exists.
# Fenced code blocks and inline code spans are ignored, so documentation can
# show an example path without creating a reference.
#
# Usage:   scripts/check-screenshots.sh [REPO_ROOT]      (default: .)
# Output:  `::error file=…,line=…::` annotations under GitHub Actions,
#          `file:line: message` otherwise. Exit 1 on any failure.
# Needs:   bash 3.2+ and coreutils (wc). Nothing else.
#
# This file is generic on purpose: other repositories copy it byte for byte.
# Change it here, then copy it again; do not fork it in place.
#
set -uo pipefail

readonly MAX_BYTES=614400
readonly SHOTS_DIR="docs/screenshots"
readonly EXEMPT_FILE=".github/screenshots-exempt"
readonly IMG_EXT='([Pp][Nn][Gg]|[Jj][Pp][Ee]?[Gg]|[Ww][Ee][Bb][Pp])'
readonly REF_RE="docs/screenshots/([A-Za-z0-9._/@+-]+\.${IMG_EXT})"
readonly MD_IMG_RE='!\[([^]]*)\]\(<?([^)> ]+)>?([[:space:]]+"[^"]*")?\)'
readonly HTML_IMG_RE='<img[[:space:]][^>]*>'

failures=0

root="${1:-.}"
if ! cd "${root}" 2>/dev/null; then
  echo "check-screenshots: cannot enter ${root}" >&2
  exit 1
fi

# report FILE LINE MESSAGE — LINE may be empty.
report() {
  local file="$1" line="$2" message="$3"
  failures=$((failures + 1))
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    if [ -n "${line}" ]; then
      echo "::error file=${file},line=${line}::${message}"
    else
      echo "::error file=${file}::${message}"
    fi
  elif [ -n "${line}" ]; then
    echo "${file}:${line}: ${message}" >&2
  else
    echo "${file}: ${message}" >&2
  fi
}

info() {
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "::notice title=screenshots::$1"
  else
    echo "check-screenshots: $1"
  fi
}

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "${s}"
}

# Drop `inline code` spans so an example path in prose is not a reference.
strip_code_spans() {
  local s="$1" out=""
  while [[ "${s}" == *'`'*'`'* ]]; do
    out+="${s%%\`*}"
    s="${s#*\`}"
    s="${s#*\`}"
  done
  printf '%s' "${out}${s}"
}

is_fence() {
  local t
  t="$(trim "$1")"
  [[ "${t}" == '```'* || "${t}" == '~~~'* ]]
}

# --- 1. The declared exemption ------------------------------------------------

if [ -e "${EXEMPT_FILE}" ]; then
  reason=""
  while IFS= read -r raw || [ -n "${raw}" ]; do
    line="$(trim "${raw}")"
    [ -z "${line}" ] && continue
    [[ "${line}" == '#'* ]] && continue
    reason="${line}"
    break
  done < "${EXEMPT_FILE}"
  if [ -z "${reason}" ]; then
    report "${EXEMPT_FILE}" "" "exempt file has no reason — write one line saying why this repository has nothing to show, or delete the file and add screenshots"
    exit 1
  fi
  info "exempt from screenshots (${EXEMPT_FILE}): ${reason}"
  exit 0
fi

# --- 2. Collect every docs/screenshots reference -----------------------------

# refs: one "file<TAB>line<TAB>path" record per reference.
refs=""

# scan_refs FILE — records every docs/screenshots/<file> token outside code,
# and checks the alt text of every markdown or HTML image that points there.
scan_refs() {
  local file="$1" n=0 in_fence=false raw text rest path alt tag match
  while IFS= read -r raw || [ -n "${raw}" ]; do
    n=$((n + 1))
    if is_fence "${raw}"; then
      if [ "${in_fence}" = true ]; then in_fence=false; else in_fence=true; fi
      continue
    fi
    [ "${in_fence}" = true ] && continue
    text="$(strip_code_spans "${raw}")"

    rest="${text}"
    while [[ "${rest}" =~ ${REF_RE} ]]; do
      path="${SHOTS_DIR}/${BASH_REMATCH[1]}"
      refs+="${file}"$'\t'"${n}"$'\t'"${path}"$'\n'
      rest="${rest#*"${BASH_REMATCH[0]}"}"
    done

    rest="${text}"
    while [[ "${rest}" =~ ${MD_IMG_RE} ]]; do
      match="${BASH_REMATCH[0]}"
      alt="$(trim "${BASH_REMATCH[1]}")"
      path="${BASH_REMATCH[2]}"
      if [[ "${path}" =~ ${REF_RE} ]] && [ -z "${alt}" ]; then
        report "${file}" "${n}" "image ${path} has empty alt text — describe what the screenshot shows"
      fi
      rest="${rest#*"${match}"}"
    done

    rest="${text}"
    while [[ "${rest}" =~ ${HTML_IMG_RE} ]]; do
      tag="${BASH_REMATCH[0]}"
      if [[ "${tag}" =~ ${REF_RE} ]]; then
        alt=""
        if [[ "${tag}" =~ alt=\"([^\"]*)\" ]]; then
          alt="$(trim "${BASH_REMATCH[1]}")"
        fi
        if [ -z "${alt}" ]; then
          report "${file}" "${n}" "<img> to docs/screenshots/ has no alt text — describe what the screenshot shows"
        fi
      fi
      rest="${rest#*"${tag}"}"
    done
  done < "$1"
}

# list_md DIR — every *.md under DIR, recursively, without find.
list_md() {
  local entry
  for entry in "$1"/*; do
    if [ -d "${entry}" ]; then
      list_md "${entry}"
    elif [ -f "${entry}" ] && [[ "${entry}" == *.md ]]; then
      printf '%s\n' "${entry}"
    fi
  done
}

# list_files DIR — every regular file under DIR, dotfiles included.
list_files() {
  local entry base
  for entry in "$1"/* "$1"/.[!.]* "$1"/..?*; do
    [ -e "${entry}" ] || continue
    base="${entry##*/}"
    if [ -d "${entry}" ]; then
      list_files "${entry}"
    elif [ -f "${entry}" ]; then
      [[ "${base}" == .* ]] && continue
      printf '%s\n' "${entry}"
    fi
  done
}

if [ ! -f README.md ]; then
  report "README.md" "" "README.md is missing"
  exit 1
fi

scan_refs README.md
if [ -d wiki ]; then
  while IFS= read -r page; do
    [ -n "${page}" ] && scan_refs "${page}"
  done <<EOF
$(list_md wiki)
EOF
fi

# --- 3. README.md has a Screenshots section with at least one image -----------

section_line=""
section_images=0
n=0
in_fence=false
in_section=false
while IFS= read -r raw || [ -n "${raw}" ]; do
  n=$((n + 1))
  if is_fence "${raw}"; then
    if [ "${in_fence}" = true ]; then in_fence=false; else in_fence=true; fi
    continue
  fi
  [ "${in_fence}" = true ] && continue

  if [[ "${raw}" =~ ^##[[:space:]]+Screenshots[[:space:]]*$ ]]; then
    section_line="${n}"
    in_section=true
    continue
  fi
  if [ "${in_section}" = true ] && [[ "${raw}" =~ ^#{1,2}[[:space:]] ]]; then
    in_section=false
  fi
  [ "${in_section}" = true ] || continue

  text="$(strip_code_spans "${raw}")"
  rest="${text}"
  while [[ "${rest}" =~ ${MD_IMG_RE} ]]; do
    match="${BASH_REMATCH[0]}"
    path="${BASH_REMATCH[2]}"
    path="${path#./}"
    if [[ "${path}" =~ ^${REF_RE}$ ]]; then
      section_images=$((section_images + 1))
    fi
    rest="${rest#*"${match}"}"
  done
  rest="${text}"
  while [[ "${rest}" =~ ${HTML_IMG_RE} ]]; do
    tag="${BASH_REMATCH[0]}"
    if [[ "${tag}" =~ src=\"(\./)?(docs/screenshots/[^\"]+)\" ]] && [[ "${BASH_REMATCH[2]}" =~ ^${REF_RE}$ ]]; then
      section_images=$((section_images + 1))
    fi
    rest="${rest#*"${tag}"}"
  done
done < README.md

if [ -z "${section_line}" ]; then
  report "README.md" "1" "no '## Screenshots' section — add one with at least one image from docs/screenshots/, or declare ${EXEMPT_FILE} with a reason"
elif [ "${section_images}" -eq 0 ]; then
  report "README.md" "${section_line}" "'## Screenshots' links no image under docs/screenshots/ — add ![what it shows](docs/screenshots/<file>.png)"
fi

# --- 4. Every reference exists ------------------------------------------------

while IFS=$'\t' read -r file line path; do
  [ -n "${file}" ] || continue
  if [ ! -f "${path}" ]; then
    report "${file}" "${line}" "${path} does not exist"
  fi
done <<EOF
${refs}
EOF

# --- 5. Every image is referenced, is an image, and is small enough -----------

images=0
if [ -d "${SHOTS_DIR}" ]; then
  while IFS= read -r shot; do
    [ -n "${shot}" ] || continue
    if [[ ! "${shot}" =~ \.${IMG_EXT}$ ]]; then
      report "${shot}" "" "not a .png, .jpg or .webp — only screenshots belong in ${SHOTS_DIR}/"
      continue
    fi
    images=$((images + 1))
    case "${refs}" in
      *$'\t'"${shot}"$'\n'*) ;;
      *) report "${shot}" "" "orphan screenshot — reference it from README.md or a wiki page, or delete it" ;;
    esac
    bytes="$(wc -c < "${shot}" | tr -d '[:space:]')"
    if [ "${bytes}" -gt "${MAX_BYTES}" ]; then
      report "${shot}" "" "${bytes} bytes, over the ${MAX_BYTES}-byte (600 KB) limit — crop it, or convert it to .webp"
    fi
  done <<EOF
$(list_files "${SHOTS_DIR}")
EOF
fi

if [ "${failures}" -gt 0 ]; then
  echo "check-screenshots: ${failures} problem(s) — screenshots are mandatory, see README.md#screenshots" >&2
  exit 1
fi

info "${images} screenshot(s) in ${SHOTS_DIR}/, all referenced, all within 600 KB"
