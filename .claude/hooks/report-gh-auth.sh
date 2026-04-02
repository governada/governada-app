#!/usr/bin/env bash
# Session-start auth diagnostics only. Do not mutate git or gh state here.

set -uo pipefail

EXPECTED_USER="governada"

status_output=$(gh auth status --hostname github.com 2>&1)
status_code=$?

if [ "$status_code" -ne 0 ]; then
  echo "GitHub auth: not ready. Run 'npm run auth:repair' before push/PR work."
  exit 0
fi

current_user=$(printf '%s\n' "$status_output" \
  | sed -n 's/.*account \([^ ]*\).*/\1/p' \
  | head -1)

if [ -z "$current_user" ]; then
  echo "GitHub auth: authenticated, but account could not be determined from gh status."
elif [ "$current_user" = "$EXPECTED_USER" ]; then
  echo "GitHub auth: ready as $EXPECTED_USER."
else
  echo "GitHub auth: logged in as $current_user (expected $EXPECTED_USER)."
  echo "Run 'npm run auth:repair' before push/PR work."
fi

current_remote=$(git remote get-url origin 2>/dev/null || echo "")
if printf '%s' "$current_remote" | grep -qE '^https://[^/@]+:[^@]+@github\.com/'; then
  echo "GitHub remote: embedded credentials detected. Run 'npm run auth:repair'."
fi
