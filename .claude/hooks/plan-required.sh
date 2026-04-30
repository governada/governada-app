#!/usr/bin/env bash
# Enforce the lean-harness plan rule for non-trivial changes.

set -uo pipefail

BASE_REF="${PLAN_REQUIRED_BASE:-origin/main}"
BRAIN_ROOT="${GOVERNADA_BRAIN_ROOT:-/Users/tim/dev/governada/governada-brain}"
TEXT_SOURCES=()
explicit=0
hook_mode=0

usage() {
  cat <<'EOF'
plan-required.sh verifies that non-trivial work references an existing plan.

Non-trivial work means 3+ changed files against origin/main, including staged
and unstaged files. Commit messages or PR bodies must reference:
  brain/plans/<slug>.md

Usage:
  bash .claude/hooks/plan-required.sh --text-file <commit-or-pr-body>
  PLAN_REQUIRED_TEXT='...' bash .claude/hooks/plan-required.sh

Remediation:
  1. Fill docs/templates/feature-plan.md into brain/plans/<slug>.md.
  2. Reference brain/plans/<slug>.md in the commit message or PR body.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --hook-mode)
      hook_mode=1
      shift
      ;;
    --text-file|--message-file|--body-file)
      TEXT_SOURCES+=("${2:-}")
      explicit=1
      shift 2
      ;;
    --text)
      PLAN_REQUIRED_TEXT="${2:-}"
      explicit=1
      shift 2
      ;;
    --last-commit)
      TEXT_SOURCES+=("__LAST_COMMIT__")
      explicit=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "plan-required.sh: unknown argument '$1'" >&2
      usage >&2
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
  if ! printf '%s\n' "$command" | grep -Eq 'git commit|gh pr create|github:pr-write|pr:ready|pull request|PR'; then
    exit 0
  fi
  if printf '%s\n' "$command" | grep -Eq -- '--body-file[= ]([^ ]+)'; then
    body_file=$(printf '%s\n' "$command" | sed -nE 's/.*--body-file[= ]([^ ]+).*/\1/p' | head -1 | tr -d "'\"")
    TEXT_SOURCES+=("$body_file")
  fi
fi

changed_files=$(
  {
    git diff --name-only "$BASE_REF"...HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git diff --name-only 2>/dev/null
    git status --porcelain 2>/dev/null | sed -E 's/^.. //; s/^.* -> //'
  } | sed '/^$/d' | sort -u
)
changed_count=$(printf '%s\n' "$changed_files" | sed '/^$/d' | wc -l | tr -d ' ')

if [ "${changed_count:-0}" -lt 3 ]; then
  exit 0
fi

text="${PLAN_REQUIRED_TEXT:-}"
if [ "${#TEXT_SOURCES[@]}" -gt 0 ]; then
  for source in "${TEXT_SOURCES[@]}"; do
    if [ "$source" = "__LAST_COMMIT__" ]; then
      text="$text
$(git log -1 --pretty=%B 2>/dev/null)"
    elif [ -n "$source" ] && [ -f "$source" ]; then
      text="$text
$(cat "$source")"
    elif [ -n "$source" ]; then
      text="$text
$source"
    fi
  done
fi

if [ "$explicit" -eq 0 ] && [ -f .git/COMMIT_EDITMSG ]; then
  text="$text
$(cat .git/COMMIT_EDITMSG)"
fi

plan_refs=$(printf '%s\n' "$text" | grep -Eo 'brain/plans/[A-Za-z0-9._/-]+\.md' | sort -u || true)

if [ -z "$plan_refs" ]; then
  echo "PLAN REQUIRED BLOCKED: ${changed_count} files changed but no brain/plans/<slug>.md reference was found." >&2
  echo "Remediation: create/fill the feature plan and reference brain/plans/<slug>.md in the commit message or PR body." >&2
  echo "Changed files:" >&2
  printf '%s\n' "$changed_files" | sed 's/^/  /' >&2
  exit 2
fi

missing=0
for ref in $plan_refs; do
  basename_ref=$(basename "$ref")
  if [ -f "$ref" ] || [ -f "$BRAIN_ROOT/plans/$basename_ref" ]; then
    continue
  fi
  echo "PLAN REQUIRED BLOCKED: referenced plan does not exist: $ref" >&2
  echo "Checked: $ref and $BRAIN_ROOT/plans/$basename_ref" >&2
  missing=1
done

if [ "$missing" -ne 0 ]; then
  echo "Remediation: create the referenced plan before committing/opening the PR." >&2
  exit 2
fi

echo "Plan requirement satisfied for ${changed_count} changed files: $plan_refs"
