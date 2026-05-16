#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/plan-required-test.XXXXXX")"
trap 'rm -rf "$tmp_root"' EXIT

fixture_repo="$tmp_root/app"
linked_worktree="$tmp_root/app-worktree"
other_repo="$tmp_root/brain"
brain_root="$tmp_root/governada-brain"
hook_path="$fixture_repo/.claude/hooks/plan-required.sh"

mkdir -p "$fixture_repo/.claude/hooks" "$brain_root/plans" "$other_repo"
cp "$repo_root/.claude/hooks/plan-required.sh" "$hook_path"
chmod +x "$hook_path"
printf 'plan\n' >"$brain_root/plans/infra-hardening-batch.md"

git -C "$fixture_repo" init -q
git -C "$fixture_repo" config user.name "Plan Test"
git -C "$fixture_repo" config user.email "plan-test@example.com"
printf 'base\n' >"$fixture_repo/README.md"
git -C "$fixture_repo" add .
git -C "$fixture_repo" commit -q -m "initial"

git -C "$fixture_repo" worktree add -q -b feature "$linked_worktree"
for file in one two three; do
  printf '%s\n' "$file" >"$linked_worktree/$file.txt"
done
git -C "$linked_worktree" add one.txt two.txt three.txt

linked_git_dir="$(git -C "$linked_worktree" rev-parse --path-format=absolute --git-dir)"
printf 'change\n\nPlan: brain/plans/infra-hardening-batch.md\n' >"$linked_git_dir/COMMIT_EDITMSG"

linked_payload="{\"command\":\"git -C $linked_worktree commit\"}"
if ! output=$(
  printf '%s\n' "$linked_payload" |
    GOVERNADA_BRAIN_ROOT="$brain_root" PLAN_REQUIRED_BASE=HEAD \
      bash "$hook_path" --hook-mode 2>&1
); then
  printf 'expected linked worktree commit with plan to pass, got:\n%s\n' "$output" >&2
  exit 1
fi
if ! printf '%s\n' "$output" | grep -q 'Plan requirement satisfied'; then
  printf 'expected success output to mention satisfied plan, got:\n%s\n' "$output" >&2
  exit 1
fi

printf 'change without plan\n' >"$linked_git_dir/COMMIT_EDITMSG"
set +e
no_plan_output=$(
  printf '%s\n' "$linked_payload" |
    GOVERNADA_BRAIN_ROOT="$brain_root" PLAN_REQUIRED_BASE=HEAD \
      bash "$hook_path" --hook-mode 2>&1
)
no_plan_status=$?
set -e
if [ "$no_plan_status" -ne 2 ]; then
  printf 'expected linked worktree commit without plan to exit 2, got %s:\n%s\n' "$no_plan_status" "$no_plan_output" >&2
  exit 1
fi
if ! printf '%s\n' "$no_plan_output" | grep -q 'PLAN REQUIRED BLOCKED'; then
  printf 'expected missing-plan output to block, got:\n%s\n' "$no_plan_output" >&2
  exit 1
fi

git -C "$other_repo" init -q
git -C "$other_repo" config user.name "Plan Test"
git -C "$other_repo" config user.email "plan-test@example.com"
printf 'base\n' >"$other_repo/README.md"
git -C "$other_repo" add README.md
git -C "$other_repo" commit -q -m "initial"
for file in one two three; do
  printf '%s\n' "$file" >"$other_repo/$file.txt"
done
git -C "$other_repo" add one.txt two.txt three.txt

other_payload="{\"command\":\"git -C $other_repo commit\"}"
if ! printf '%s\n' "$other_payload" |
  GOVERNADA_BRAIN_ROOT="$brain_root" PLAN_REQUIRED_BASE=HEAD \
    bash "$hook_path" --hook-mode >/dev/null 2>&1; then
  printf 'expected cross-repo commit command to remain exempt\n' >&2
  exit 1
fi

for file in four five six; do
  printf '%s\n' "$file" >"$fixture_repo/$file.txt"
done
git -C "$fixture_repo" add four.txt five.txt six.txt
printf 'shared checkout\n\nPlan: brain/plans/infra-hardening-batch.md\n' >"$fixture_repo/.git/COMMIT_EDITMSG"
if ! output=$(
  cd "$fixture_repo" &&
    GOVERNADA_BRAIN_ROOT="$brain_root" PLAN_REQUIRED_BASE=HEAD \
      bash "$hook_path" 2>&1
); then
  printf 'expected shared checkout commit with plan to pass, got:\n%s\n' "$output" >&2
  exit 1
fi

printf 'plan-required hook tests passed\n'
