#!/usr/bin/env bash
# Non-blocking PR-open warning for product-code changes without brain freshness.

set -uo pipefail

BASE_REF="${BRAIN_FRESHNESS_BASE:-origin/main}"
BRAIN_ROOT="${GOVERNADA_BRAIN_ROOT:-/Users/tim/dev/governada/governada-brain}"
hook_mode=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --hook-mode)
      hook_mode=1
      shift
      ;;
    --always)
      hook_mode=0
      shift
      ;;
    -h|--help)
      echo "Warns when product code changed but brain/governada/features or initiatives notes were not touched."
      exit 0
      ;;
    *)
      echo "brain-freshness-at-pr.sh: unknown argument '$1'" >&2
      exit 2
      ;;
  esac
done

stdin_payload=""
if [ ! -t 0 ]; then
  stdin_payload=$(cat)
fi

if [ "$hook_mode" -eq 1 ]; then
  command=$(printf '%s\n' "$stdin_payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  if ! printf '%s\n' "$command" | grep -Eq 'gh pr create|github:pr-write|pr:ready|pull request|PR'; then
    exit 0
  fi
fi

if [ -n "${BRAIN_FRESHNESS_CHANGED_FILES:-}" ]; then
  changed_files=$(printf '%s\n' "$BRAIN_FRESHNESS_CHANGED_FILES" | sed '/^$/d' | sort -u)
else
  changed_files=$(
    {
      git diff --name-only "$BASE_REF"...HEAD 2>/dev/null
      git diff --name-only --cached 2>/dev/null
      git diff --name-only 2>/dev/null
      git status --porcelain 2>/dev/null | sed -E 's/^.. //; s/^.* -> //'
    } | sed '/^$/d' | sort -u
  )
fi

product_changes=$(printf '%s\n' "$changed_files" | grep -E '^(app|components|hooks|lib|inngest|supabase|types|middleware\.ts|instrumentation\.ts|next\.config\.)/' || true)

if [ -z "$product_changes" ]; then
  exit 0
fi

repo_brain_changes=$(printf '%s\n' "$changed_files" | grep -E '^brain/governada/(features|initiatives)/' || true)
sibling_brain_changes=""
if [ -d "$BRAIN_ROOT/.git" ]; then
  sibling_brain_changes=$(
    git -C "$BRAIN_ROOT" status --short -- governada/features governada/initiatives 2>/dev/null | sed '/^$/d'
  )
fi

if [ -n "$repo_brain_changes" ] || [ -n "$sibling_brain_changes" ]; then
  echo "Brain freshness check: relevant feature/initiative notes touched."
  exit 0
fi

cat >&2 <<EOF
BRAIN FRESHNESS WARNING: product code changed, but no relevant brain freshness note was detected.

Product files changed:
$(printf '%s\n' "$product_changes" | sed 's/^/  /')

Remediation: update the relevant brain/governada/features/ or brain/governada/initiatives/ note,
or document in the PR why brain freshness is not needed for this change.

This hook warns only and does not block PR creation.
EOF

exit 0
