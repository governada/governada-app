#!/usr/bin/env bash
# In the shared main checkout, allow read-only Bash exploration but block
# mutating commands until the agent creates a fresh worktree or enters hotfix
# mode. This prevents parallel Codex threads from colliding on main.

set -uo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
  exit 0
fi

if [ "${ALLOW_MAIN_EDIT:-0}" = "1" ] || [ "${ALLOW_SHARED_CHECKOUT:-0}" = "1" ]; then
  exit 0
fi

toplevel=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [ -z "$toplevel" ]; then
  exit 0
fi

# If .git is a file, we're already inside a worktree. Safe to proceed.
if [ ! -d "$toplevel/.git" ]; then
  exit 0
fi

case "$branch" in
  main|master) ;;
  *)
    # Shared checkout on a feature branch is never safe for mutating Bash work.
    echo "BLOCKED: Shared checkout is on '$branch'. Use a worktree before mutating the repo."
    echo "Create one with:"
    echo "  powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>"
    exit 2
    ;;
esac

trimmed=$(printf '%s' "$COMMAND" | tr -d '\r' | sed 's/^[[:space:]]*//')

# Commands that are explicitly allowed in the shared main checkout because they
# only inspect state or create a fresh worktree for the real work.
readonly_prefixes=(
  "git status"
  "git diff"
  "git log"
  "git show"
  "git branch"
  "git rev-parse"
  "git remote"
  "git fetch"
  "git ls-files"
  "git worktree list"
  "git worktree add"
  "Get-ChildItem"
  "Get-Content"
  "Select-String"
  "rg "
  "rg.exe "
  "where "
  "where.exe "
  "pwd"
  "Get-Location"
  "node scripts/validate-agent-constraints.mjs"
  "powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1"
)

for prefix in "${readonly_prefixes[@]}"; do
  if [[ "$trimmed" == "$prefix" ]] || [[ "$trimmed" == "$prefix "* ]]; then
    exit 0
  fi
done

echo "BLOCKED: You're in the shared main checkout."
echo ""
echo "Read-only inspection is allowed here, but mutating commands are blocked"
echo "until you create a fresh worktree for this thread."
echo ""
echo "Run:"
echo "  powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>"
echo ""
echo "For intentional hotfixes on main, set ALLOW_MAIN_EDIT=1."
exit 2
