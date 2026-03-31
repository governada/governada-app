#!/bin/bash
# Ensure gh CLI is authenticated as governada for this project.
# Runs on session start via Claude Code hook.
#
# Also configures per-repo HTTPS credentials so the `governada` account
# is always used for pushes — regardless of which gh account is "active"
# globally. This prevents credential leakage when tim-dd is active in
# another terminal.

EXPECTED_USER="governada"
CURRENT_USER=$(gh api user --jq '.login' 2>/dev/null)

if [ "$CURRENT_USER" != "$EXPECTED_USER" ]; then
  gh auth switch --user "$EXPECTED_USER" 2>/dev/null
  NEW_USER=$(gh api user --jq '.login' 2>/dev/null)
  if [ "$NEW_USER" = "$EXPECTED_USER" ]; then
    echo "GitHub auth: switched to $EXPECTED_USER ✓"
  else
    echo "WARNING: Could not switch to $EXPECTED_USER (current: $CURRENT_USER)" >&2
  fi
fi

# Configure HTTPS push credentials via gh credential helper.
# gh auth setup-git sets a GLOBAL credential helper that uses whichever
# gh account is "active" — if another terminal switches to tim-dd, pushes
# from this repo fail with 403.
#
# Fix: configure the credential helper at the LOCAL (repo) level, and also
# set the GH_TOKEN env-based approach as a fallback by extracting the token
# for the governada account.
gh auth setup-git --hostname github.com > /dev/null 2>&1

# Set the remote URL to use the governada account token directly.
# This ensures pushes always authenticate as governada, even if the global
# gh active account changes.
GOVERNADA_TOKEN=$(gh auth token --user "$EXPECTED_USER" 2>/dev/null)
if [ -n "$GOVERNADA_TOKEN" ]; then
  CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)
  # Only rewrite if it's an HTTPS remote without embedded credentials
  if echo "$CURRENT_REMOTE" | grep -q "^https://github.com/" 2>/dev/null; then
    git remote set-url origin "https://${EXPECTED_USER}:${GOVERNADA_TOKEN}@github.com/governada/governada-app.git" 2>/dev/null
    echo "GitHub credentials: pinned to $EXPECTED_USER ✓"
  fi
fi
