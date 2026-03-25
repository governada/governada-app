#!/bin/bash
# Ensure gh CLI is authenticated as governada for this project.
# Runs on session start via Claude Code hook.

EXPECTED_USER="governada"
CURRENT_USER=$(gh api user --jq '.login' 2>/dev/null)

if [ "$CURRENT_USER" != "$EXPECTED_USER" ]; then
  gh auth switch --user "$EXPECTED_USER" 2>/dev/null
  NEW_USER=$(gh api user --jq '.login' 2>/dev/null)
  if [ "$NEW_USER" = "$EXPECTED_USER" ]; then
    echo "Switched GitHub auth to $EXPECTED_USER"
  else
    echo "WARNING: Could not switch to $EXPECTED_USER (current: $CURRENT_USER)" >&2
  fi
fi
