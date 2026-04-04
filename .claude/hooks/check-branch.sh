#!/usr/bin/env bash
# Block unsafe branch/checkout scenarios:
# 1. Editing on main/master without ALLOW_MAIN_EDIT=1
# 2. Feature branch work in the main checkout (not a worktree)
#
# This prevents parallel agents from stomping each other's branches.

# --- Allow plan files and memory writes on any branch ---
# Read tool input from stdin, check if file_path targets plan/memory paths
INPUT=$(cat)
if echo "$INPUT" | grep -q '\.claude' 2>/dev/null; then
  if echo "$INPUT" | grep -qE '(plans|projects)' 2>/dev/null; then
    exit 0
  fi
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

# --- Check 1: Main branch protection ---
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  if [ "${ALLOW_MAIN_EDIT:-0}" = "1" ]; then
    exit 0
  fi
  echo "BLOCKED: You're on '$branch'. Create a feature branch in a worktree:"
  echo "  powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>"
  echo "  # Creates .claude/worktrees/<name> on feat/<name> from origin/main"
  echo ""
  echo "For intentional hotfixes, set ALLOW_MAIN_EDIT=1"
  exit 2
fi

# --- Check 2: Worktree isolation for feature branches ---
if [ "${ALLOW_SHARED_CHECKOUT:-0}" = "1" ]; then
  exit 0
fi

toplevel=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -d "$toplevel/.git" ]; then
  echo "BLOCKED: Feature branch '$branch' in the shared main checkout."
  echo ""
  echo "Parallel agents share this directory. Switching branches here"
  echo "causes other agents to lose their working branch."
  echo ""
  echo "Create a worktree instead:"
  echo "  git checkout main"
  echo "  powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 $branch -Branch $branch"
  echo ""
  echo "Or start Claude Code with:  claude --worktree <name>"
  echo ""
  echo "To override (ONLY if you're the sole agent): ALLOW_SHARED_CHECKOUT=1"
  exit 2
fi

exit 0
