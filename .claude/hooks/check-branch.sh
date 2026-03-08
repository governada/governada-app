#!/usr/bin/env bash
# Block file edits when on main branch.
# Allows hotfixes only when ALLOW_MAIN_EDIT=1 is set.

if [ "${ALLOW_MAIN_EDIT:-0}" = "1" ]; then
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "BLOCKED: You're on '$branch'. Create a feature branch first:"
  echo "  git checkout -b feature/<name>"
  echo ""
  echo "For intentional hotfixes, set ALLOW_MAIN_EDIT=1"
  exit 2
fi

exit 0
