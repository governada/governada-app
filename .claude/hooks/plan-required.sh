#!/usr/bin/env bash
# Enforce the lean-harness plan rule for non-trivial changes.

set -uo pipefail

BASE_REF="${PLAN_REQUIRED_BASE:-origin/main}"
BRAIN_ROOT="${GOVERNADA_BRAIN_ROOT:-/Users/tim/dev/governada/governada-brain}"
TEXT_SOURCES=()
explicit=0
hook_mode=0

git_common_dir() {
  git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true
}

git_toplevel() {
  git -C "$1" rev-parse --show-toplevel 2>/dev/null || true
}

commit_message_file() {
  local git_dir=""
  local gitdir_line=""
  local cwd=""

  git_dir=$(git rev-parse --path-format=absolute --git-dir 2>/dev/null || true)
  if [ -n "$git_dir" ] && [ -f "$git_dir/COMMIT_EDITMSG" ]; then
    printf '%s\n' "$git_dir/COMMIT_EDITMSG"
    return 0
  fi

  if [ -f .git/COMMIT_EDITMSG ]; then
    printf '%s\n' ".git/COMMIT_EDITMSG"
    return 0
  fi

  if [ -f .git ]; then
    gitdir_line=$(sed -nE 's/^gitdir:[[:space:]]*//p' .git | head -1)
    if [ -n "$gitdir_line" ]; then
      case "$gitdir_line" in
        /*) git_dir="$gitdir_line" ;;
        *)
          cwd=$(pwd -P)
          git_dir="$cwd/$gitdir_line"
          ;;
      esac
      if [ -f "$git_dir/COMMIT_EDITMSG" ]; then
        printf '%s\n' "$git_dir/COMMIT_EDITMSG"
        return 0
      fi
    fi
  fi

  return 1
}

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
  if ! printf '%s\n' "$command" | grep -Eq 'git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit|gh pr create|pull request|PR'; then
    exit 0
  fi
  if printf '%s\n' "$command" | grep -Eq -- '--body-file[= ]([^ ]+)'; then
    body_file=$(printf '%s\n' "$command" | sed -nE 's/.*--body-file[= ]([^ ]+).*/\1/p' | head -1 | tr -d "'\"")
    TEXT_SOURCES+=("$body_file")
  fi

  # Detect commits targeting a different working tree than the hook's CWD.
  # The hook lives at <app-repo-root>/.claude/hooks/ and only enforces app-repo
  # feature-plan discipline. Without this block, commits reached via
  # `cd <path> && git commit` or `git -C <path> commit` get evaluated against
  # the hook's own CWD instead of the commit's actual target — producing false
  # positives on cross-repo commits (e.g., brain repo) and on commits to
  # worktrees of the same repo where the main checkout has unrelated state.
  app_repo_root=$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd -P)
  app_common_dir=$(git_common_dir "$app_repo_root")
  target_dir=""
  if printf '%s\n' "$command" | grep -Eq '(^|[[:space:]]|;|&&|\|\|)cd[[:space:]]+'; then
    target_dir=$(printf '%s\n' "$command" | sed -nE 's/.*(^|[[:space:]]|;|&&|\|\|)cd[[:space:]]+([^[:space:]]+).*/\2/p' | head -1 | tr -d "'\"")
  elif printf '%s\n' "$command" | grep -Eq 'git[[:space:]]+-C[[:space:]]+'; then
    target_dir=$(printf '%s\n' "$command" | sed -nE 's/.*git[[:space:]]+-C[[:space:]]+([^[:space:]]+).*/\1/p' | head -1 | tr -d "'\"")
  fi
  if [ -n "$target_dir" ] && [ -n "$app_repo_root" ]; then
    target_repo_root=$(git_toplevel "$target_dir")
    target_common_dir=$(git_common_dir "$target_dir")
    if [ -n "$target_repo_root" ]; then
      if [ -z "$target_common_dir" ] || [ -z "$app_common_dir" ] || [ "$target_common_dir" != "$app_common_dir" ]; then
        # Different repo entirely (e.g., brain repo). Hook doesn't apply.
        exit 0
      fi
      # Same repo, possibly different worktree. cd into target root so the
      # change-counting git diff/status checks below see the worktree's
      # actual state, not whatever CWD the hook inherited.
      cd "$target_repo_root" 2>/dev/null || true
    fi
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

commit_msg_file=""
if [ "$explicit" -eq 0 ]; then
  commit_msg_file=$(commit_message_file || true)
fi

if [ "$explicit" -eq 0 ] && [ -n "$commit_msg_file" ]; then
  text="$text
$(cat "$commit_msg_file")"
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
