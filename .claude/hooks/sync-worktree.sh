#!/usr/bin/env bash
# Sync worktree with latest origin/main at session start.
# Only runs in worktrees (not the main checkout) to avoid rebasing main itself.

set -euo pipefail

# Detect if we're in a worktree (`.git` is a file, not a directory)
GIT_DIR_ENTRY="$(git rev-parse --git-dir 2>/dev/null)" || exit 0
if [ -d ".git" ]; then
  # Main checkout — skip
  exit 0
fi

# Fetch latest main
git fetch origin main --quiet 2>/dev/null || exit 0

# Check if we're already up to date
LOCAL=$(git rev-parse HEAD 2>/dev/null)
MERGE_BASE=$(git merge-base HEAD origin/main 2>/dev/null) || exit 0
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ "$MERGE_BASE" = "$REMOTE" ]; then
  # Already up to date with origin/main
  exit 0
fi

# Rebase onto origin/main
if ! git rebase origin/main --quiet 2>/dev/null; then
  # Rebase failed (conflicts) — abort and let user handle manually
  git rebase --abort 2>/dev/null
  echo "WARN: auto-sync with origin/main failed (conflicts). Run 'git rebase origin/main' manually." >&2
  exit 0
fi

BEHIND_COUNT=$(git rev-list "$MERGE_BASE".."$REMOTE" --count 2>/dev/null || echo "?")
echo "Synced worktree: rebased ${BEHIND_COUNT} commits from origin/main." >&2
