#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
script_path="$repo_root/scripts/check-checkout-freshness.mjs"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/checkout-freshness-test.XXXXXX")"
trap 'rm -rf "$tmp_root"' EXIT

remote_repo="$tmp_root/origin.git"
seed_repo="$tmp_root/seed"
checkout_repo="$tmp_root/shared"

git init --bare -q "$remote_repo"
git init -q "$seed_repo"
git -C "$seed_repo" checkout -q -b main
git -C "$seed_repo" config user.name "Freshness Test"
git -C "$seed_repo" config user.email "freshness-test@example.com"
printf 'base\n' >"$seed_repo/README.md"
git -C "$seed_repo" add README.md
git -C "$seed_repo" commit -q -m "base"
git -C "$seed_repo" remote add origin "$remote_repo"
git -C "$seed_repo" push -q -u origin main
git -C "$remote_repo" symbolic-ref HEAD refs/heads/main
base_sha="$(git -C "$seed_repo" rev-parse HEAD)"

git clone -q "$remote_repo" "$checkout_repo"
git -C "$checkout_repo" config user.name "Freshness Test"
git -C "$checkout_repo" config user.email "freshness-test@example.com"

mkdir -p "$seed_repo/bin" "$seed_repo/.claude/hooks"
printf 'mcp wrapper from main\n' >"$seed_repo/bin/supabase-mcp.sh"
printf 'migration hook from main\n' >"$seed_repo/.claude/hooks/migration-pr-binding.sh"
git -C "$seed_repo" add bin/supabase-mcp.sh .claude/hooks/migration-pr-binding.sh
git -C "$seed_repo" commit -q -m "add mcp hook files"
git -C "$seed_repo" push -q origin main
git -C "$checkout_repo" fetch -q origin main

git -C "$checkout_repo" reset -q --hard "$base_sha"
mkdir -p "$checkout_repo/bin" "$checkout_repo/.claude/hooks"
printf 'local stale mcp wrapper\n' >"$checkout_repo/bin/supabase-mcp.sh"
printf 'local stale migration hook\n' >"$checkout_repo/.claude/hooks/migration-pr-binding.sh"

warning_output="$(
  node "$script_path" \
    --repo "$checkout_repo" \
    --mode session-start \
    --behind-threshold 1 \
    --no-fetch
)"

for expected in \
  'STALE CHECKOUT WARNING' \
  'bin/supabase-mcp.sh (already in origin/main)' \
  '.claude/hooks/migration-pr-binding.sh (already in origin/main)' \
  "rm -- '.claude/hooks/migration-pr-binding.sh' 'bin/supabase-mcp.sh'" \
  'npm run session:refresh'; do
  if ! printf '%s\n' "$warning_output" | grep -Fq "$expected"; then
    printf 'expected warning output to contain %s, got:\n%s\n' "$expected" "$warning_output" >&2
    exit 1
  fi
done

set +e
refresh_block_output="$(
  node "$script_path" \
    --repo "$checkout_repo" \
    --mode refresh \
    --behind-threshold 1 \
    --no-fetch 2>&1
)"
refresh_block_status=$?
set -e
if [ "$refresh_block_status" -ne 2 ]; then
  printf 'expected blocked refresh to exit 2, got %s:\n%s\n' "$refresh_block_status" "$refresh_block_output" >&2
  exit 1
fi
if ! printf '%s\n' "$refresh_block_output" | grep -Fq 'STALE CHECKOUT WARNING'; then
  printf 'expected blocked refresh to print stale warning, got:\n%s\n' "$refresh_block_output" >&2
  exit 1
fi
if [ "$(git -C "$checkout_repo" rev-parse HEAD)" != "$base_sha" ]; then
  printf 'blocked refresh should not move HEAD\n' >&2
  exit 1
fi

git -C "$checkout_repo" clean -q -fd
git -C "$checkout_repo" reset -q --hard "$base_sha"
suggestion_output="$(
  node "$script_path" \
    --repo "$checkout_repo" \
    --mode session-start \
    --behind-threshold 1 \
    --no-fetch
)"
if ! printf '%s\n' "$suggestion_output" | grep -Fq 'Run: npm run session:refresh'; then
  printf 'expected clean behind checkout to suggest session:refresh, got:\n%s\n' "$suggestion_output" >&2
  exit 1
fi
if [ "$(git -C "$checkout_repo" rev-parse HEAD)" != "$base_sha" ]; then
  printf 'SessionStart suggestion should not move HEAD\n' >&2
  exit 1
fi

refresh_output="$(
  node "$script_path" \
    --repo "$checkout_repo" \
    --mode refresh \
    --behind-threshold 1 \
    --no-fetch
)"
if ! printf '%s\n' "$refresh_output" | grep -Fq 'fast-forwarded 1 commit(s)'; then
  printf 'expected clean refresh to fast-forward, got:\n%s\n' "$refresh_output" >&2
  exit 1
fi
if [ "$(git -C "$checkout_repo" rev-parse HEAD)" != "$(git -C "$checkout_repo" rev-parse origin/main)" ]; then
  printf 'expected clean refresh to move HEAD to origin/main\n' >&2
  exit 1
fi

clean_output="$(
  node "$script_path" \
    --repo "$checkout_repo" \
    --mode session-start \
    --behind-threshold 1 \
    --no-fetch
)"
if [ -n "$clean_output" ]; then
  printf 'expected clean SessionStart check to stay silent, got:\n%s\n' "$clean_output" >&2
  exit 1
fi

printf 'checkout freshness tests passed\n'
