#!/usr/bin/env bash
# Block unsafe branch/checkout scenarios:
# 1. Editing on main/master without ALLOW_MAIN_EDIT=1
# 2. Feature branch work in the main checkout (not a worktree)
#
# This prevents parallel agents from stomping each other's branches.

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

# --- Check 1: Main branch protection ---
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  if [ "${ALLOW_MAIN_EDIT:-0}" = "1" ]; then
    exit 0
  fi
  echo "BLOCKED: You're on '$branch'. Create a feature branch in a worktree:"
  echo "  git worktree add ../governada-<name> -b feat/<name>"
  echo ""
  echo "For intentional hotfixes, set ALLOW_MAIN_EDIT=1"
  exit 2
fi

# --- Check 2: Worktree isolation for feature branches ---
if [ "${ALLOW_SHARED_CHECKOUT:-0}" = "1" ]; then
  exit 0
fi

# Detect: in a worktree, .git is a FILE (contains gitdir pointer).
# In the main checkout, .git is a DIRECTORY.
toplevel=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -d "$toplevel/.git" ]; then
  # Main checkout — feature branch work must happen in a worktree
  echo "BLOCKED: Feature branch '$branch' in the shared main checkout."
  echo ""
  echo "Parallel agents share this directory. Switching branches here"
  echo "causes other agents to lose their working branch."
  echo ""
  echo "Create a worktree instead:"
  echo "  git checkout main"
  echo "  git worktree add ../governada-<name> -b $branch"
  echo ""
  echo "Or start Claude Code with:  claude --worktree <name>"
  echo ""
  echo "To override (ONLY if you're the sole agent): ALLOW_SHARED_CHECKOUT=1"
  exit 2
fi

# In a worktree on a feature branch — this is correct usage
exit 0
