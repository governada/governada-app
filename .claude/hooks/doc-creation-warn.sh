#!/usr/bin/env bash
# Warn/fail when a new markdown file appears to duplicate an existing doc home.

set -uo pipefail

file_path="${DOC_CREATION_FILE:-}"
hook_mode=0

usage() {
  cat <<'EOF'
doc-creation-warn.sh checks new .md files for similar existing docs.

Usage:
  bash .claude/hooks/doc-creation-warn.sh --file <new-doc.md>

Remediation:
  Prefer editing the existing doc home. If the new doc is intentional, rename it
  clearly or include the duplicate-check evidence in the PR.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --hook-mode)
      hook_mode=1
      shift
      ;;
    --file)
      file_path="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "doc-creation-warn.sh: unknown argument '$1'" >&2
      usage >&2
      exit 2
      ;;
  esac
done

stdin_payload=""
if [ ! -t 0 ]; then
  stdin_payload=$(cat)
fi

if [ -z "$file_path" ] && [ -n "$stdin_payload" ]; then
  file_path=$(printf '%s\n' "$stdin_payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
fi

if [ -z "$file_path" ]; then
  [ "$hook_mode" -eq 1 ] && exit 0
  echo "DOC CREATION CHECK BLOCKED: no markdown file path provided." >&2
  usage >&2
  exit 2
fi

case "$file_path" in
  *.md) ;;
  *) exit 0 ;;
esac

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
relative_path=${file_path#"$repo_root"/}

status=$(git status --short -- "$relative_path" 2>/dev/null | head -1 | awk '{print $1}')
if [ "$hook_mode" -eq 1 ] && ! printf '%s' "$status" | grep -Eq '^(A|\?\?)'; then
  exit 0
fi

filename=$(basename "$relative_path")
stem=${filename%.md}
token_pattern=$(printf '%s\n' "$stem" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/|/g; s/^\|//; s/\|$//')

if [ -z "$token_pattern" ]; then
  exit 0
fi

path_matches=$(
  git ls-files '*.md' 2>/dev/null \
    | grep -Eiv "^${relative_path}$" \
    | grep -Ei "($(printf '%s' "$token_pattern"))" \
    | head -20 || true
)

grep_matches=$(
  git grep -In -E "(${token_pattern})" -- '*.md' ":(exclude)$relative_path" 2>/dev/null \
    | head -20 || true
)

if [ -z "$path_matches" ] && [ -z "$grep_matches" ]; then
  echo "Doc creation check passed: no similar markdown homes found for $relative_path."
  exit 0
fi

cat >&2 <<EOF
DOC CREATION WARNING: similar markdown content or filenames already exist for $relative_path.

Similar tracked markdown paths:
$(if [ -n "$path_matches" ]; then printf '%s\n' "$path_matches" | sed 's/^/  /'; else echo "  (none by filename)"; fi)

git grep matches:
$(if [ -n "$grep_matches" ]; then printf '%s\n' "$grep_matches" | sed 's/^/  /'; else echo "  (none by content)"; fi)

Remediation: edit the existing doc home when possible. If this new doc is intentional,
include the duplicate-check evidence in the PR.
EOF

exit 2
