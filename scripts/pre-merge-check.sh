#!/usr/bin/env bash
# Pre-merge safety check: ensures no other PRs are mid-merge to main.
# Run this BEFORE merging any PR to avoid conflicts between parallel agents.
#
# Usage: bash scripts/pre-merge-check.sh <pr-number>
# Exit 0 = safe to merge, Exit 1 = blocked

set -euo pipefail

PR_NUMBER="${1:?Usage: pre-merge-check.sh <pr-number>}"
REPO="governada/governada-app"
BASE_BRANCH="main"

echo "Checking merge safety for PR #${PR_NUMBER}..."

# 1. Check for other open PRs targeting main
OTHER_PRS=$(gh pr list --repo "$REPO" --base "$BASE_BRANCH" --state open --json number,title,updatedAt \
  --jq ".[] | select(.number != ${PR_NUMBER}) | \"  #\(.number) \(.title) (updated \(.updatedAt))\"")

if [ -n "$OTHER_PRS" ]; then
  echo ""
  echo "WARNING: Other open PRs targeting ${BASE_BRANCH}:"
  echo "$OTHER_PRS"
  echo ""
fi

# 2. Check for in-flight CI on main (recently merged PRs still deploying)
RECENT_RUNS=$(gh run list --repo "$REPO" --branch "$BASE_BRANCH" --limit 1 --json status,conclusion,createdAt \
  --jq '.[] | select(.status == "in_progress" or .status == "queued") | "  CI run in progress (started \(.createdAt))"')

if [ -n "$RECENT_RUNS" ]; then
  echo ""
  echo "BLOCKED: CI is currently running on ${BASE_BRANCH}:"
  echo "$RECENT_RUNS"
  echo ""
  echo "Wait for the current CI run to complete before merging."
  exit 1
fi

# 3. Check if this PR's branch is mergeable
MERGE_STATE=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json mergeStateStatus \
  --jq '.mergeStateStatus')

if [ "$MERGE_STATE" = "BEHIND" ]; then
  echo ""
  echo "WARNING: Branch is behind main — rebase first"
  echo ""
elif [ "$MERGE_STATE" = "DIRTY" ]; then
  echo ""
  echo "BLOCKED: Branch has merge conflicts — rebase required"
  exit 1
fi

# 4. Check PR CI status
PR_STATUS=$(gh pr checks "$PR_NUMBER" --repo "$REPO" 2>&1 || true)
if echo "$PR_STATUS" | grep -qi "fail"; then
  echo ""
  echo "BLOCKED: PR #${PR_NUMBER} has failing checks:"
  echo "$PR_STATUS"
  exit 1
fi

echo "OK: Safe to merge PR #${PR_NUMBER}."
