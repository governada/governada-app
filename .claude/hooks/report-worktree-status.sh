#!/usr/bin/env bash
# Session-start diagnostics only. Do not fetch, rebase, clean, or configure auth
# from here. Automatic git writes create lock contention across parallel agents.

set -uo pipefail

git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0

toplevel=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [ -z "$toplevel" ]; then
  exit 0
fi

if [ -d "$toplevel/.git" ]; then
  checkout_kind="shared-checkout"
else
  checkout_kind="worktree"
fi

if [ "$checkout_kind" = "shared-checkout" ]; then
  echo "Session: shared checkout on branch '$branch' (read-only inspection only)."
else
  echo "Session: worktree on branch '$branch'."
fi

if git rev-parse --verify origin/main >/dev/null 2>&1; then
  merge_base=$(git merge-base HEAD origin/main 2>/dev/null || echo "")
  behind=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
  ahead=$(git rev-list origin/main..HEAD --count 2>/dev/null || echo "0")

  if [ "$merge_base" = "$(git rev-parse origin/main 2>/dev/null || echo '')" ]; then
    echo "Git: up-to-date with local origin/main snapshot (ahead ${ahead} commit(s))."
  elif [ "$behind" -gt 0 ] 2>/dev/null; then
    echo "Git: ${behind} commit(s) behind local origin/main snapshot."
    echo "Run 'npm run worktree:sync' before mutating if you need the latest main."
  fi
else
  echo "Git: origin/main has not been fetched in this checkout yet."
  echo "Run 'npm run worktree:sync' before mutating if you need the latest main."
fi

if [ "$checkout_kind" = "worktree" ]; then
  if [ ! -f ".env.local" ]; then
    echo ".env.local: missing. Run 'npm run worktree:sync' to copy it from the main checkout."
  fi

  if [ ! -d "node_modules" ] && [ ! -L "node_modules" ]; then
    echo "node_modules: missing. Run 'npm run worktree:sync' to link shared deps when possible, or run 'npm ci'."
  fi
fi

echo "Session start is diagnostic-only: no fetch/rebase/auth writes ran automatically."
