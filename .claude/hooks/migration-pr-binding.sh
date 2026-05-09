#!/usr/bin/env bash
# migration-pr-binding.sh
#
# PreToolUse gate for mcp__supabase__apply_migration. Allows the call only when
# the SQL passed to the MCP byte-matches a committed file in supabase/migrations/.
#
# The contract is: agents cannot type SQL into chat and ship it to production.
# The SQL must come from a migration file that's been committed (and ideally
# code-reviewed in a PR). This is the trust signal the classifier needs.
#
# Hook stdin payload (from Claude Code):
#   {
#     "tool_name": "mcp__supabase__apply_migration",
#     "tool_input": {
#       "name": "<snake_case_name>",
#       "query": "<SQL body>",
#       "project_id": "<ref>"
#     },
#     ...other PreToolUse fields
#   }
#
# Exit 0 -> allow. Exit 2 -> deny (Claude Code surfaces stderr to the user).

set -uo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if repo_root="$(git -C "$script_dir/../.." rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  repo_root="$(cd "$script_dir/../.." && pwd -P)"
fi

# Build the list of directories to search for matching migration files.
# Includes the shared checkout's supabase/migrations/ and every active
# worktree's supabase/migrations/, so PRs in flight can apply their migration
# before the merge — important when app code in the same PR depends on the
# new function.
shared_root="$repo_root"
if [[ "$repo_root" == *'/.claude/worktrees/'* ]]; then
  shared_root="${repo_root%%/.claude/worktrees/*}"
fi

migration_dirs=()
if [[ -d "$shared_root/supabase/migrations" ]]; then
  migration_dirs+=("$shared_root/supabase/migrations")
fi
if [[ -d "$shared_root/.claude/worktrees" ]]; then
  while IFS= read -r -d '' wt_mig; do
    migration_dirs+=("$wt_mig")
  done < <(find "$shared_root/.claude/worktrees" -maxdepth 3 -type d -name 'migrations' -path '*/supabase/migrations' -print0 2>/dev/null)
fi

if [[ "${#migration_dirs[@]}" -eq 0 ]]; then
  echo "BLOCKED: migration-pr-binding.sh found no supabase/migrations directories." >&2
  echo "Looked under: $shared_root" >&2
  exit 2
fi

stdin_payload=""
if [ ! -t 0 ]; then
  stdin_payload=$(cat)
fi

if [[ -z "$stdin_payload" ]]; then
  # No payload (defensive); allow rather than block since the matcher should
  # only fire on apply_migration calls.
  exit 0
fi

# Only enforce on apply_migration. Other supabase MCP tools fall through.
tool_name=$(STDIN_PAYLOAD="$stdin_payload" python3 -c '
import json, os, sys
try:
  data = json.loads(os.environ.get("STDIN_PAYLOAD", ""))
  print(data.get("tool_name", ""))
except Exception:
  pass
' 2>/dev/null)

if [[ "$tool_name" != "mcp__supabase__apply_migration" ]]; then
  exit 0
fi

# Extract name and query from tool_input. Use python for reliable JSON parsing
# since the SQL body can contain quotes, escapes, multi-line content, etc.
# Pass payload via env var so we don't redirect stdin (heredoc-style stdin
# would shadow the piped JSON).
parsed=$(STDIN_PAYLOAD="$stdin_payload" python3 -c '
import json, os, sys, tempfile
try:
  data = json.loads(os.environ.get("STDIN_PAYLOAD", ""))
  ti = data.get("tool_input") or {}
  name = ti.get("name") or ""
  query = ti.get("query") or ""
  sys.stdout.write("NAME=" + name + "\n")
  sys.stdout.write("QUERY_BYTES=" + str(len(query.encode("utf-8"))) + "\n")
  fd, path = tempfile.mkstemp(prefix="governada-mig-pre-", suffix=".sql")
  with os.fdopen(fd, "w") as f:
    f.write(query)
  sys.stdout.write("QUERY_FILE=" + path + "\n")
except Exception as exc:
  sys.stdout.write("PARSE_ERROR=" + str(exc) + "\n")
' 2>/dev/null)

migration_name=$(printf '%s\n' "$parsed" | sed -n 's/^NAME=//p' | head -1)
query_file=$(printf '%s\n' "$parsed" | sed -n 's/^QUERY_FILE=//p' | head -1)
parse_error=$(printf '%s\n' "$parsed" | sed -n 's/^PARSE_ERROR=//p' | head -1)

cleanup_query_file() {
  if [[ -n "${query_file:-}" && -f "$query_file" ]]; then
    rm -f "$query_file"
  fi
}
trap cleanup_query_file EXIT

if [[ -n "$parse_error" ]]; then
  echo "BLOCKED: migration-pr-binding.sh could not parse tool_input ($parse_error)." >&2
  exit 2
fi

if [[ -z "$migration_name" || -z "$query_file" || ! -f "$query_file" ]]; then
  echo "BLOCKED: migration-pr-binding.sh did not receive name + query in tool_input." >&2
  echo "Remediation: this hook only allows mcp__supabase__apply_migration calls whose" >&2
  echo "name and query come from a committed file in supabase/migrations/." >&2
  exit 2
fi

# Find a committed migration file whose filename ends in <migration_name>.sql
# (the timestamp prefix is allowed to vary so the agent can use the descriptive
# name only when calling the MCP). Search shared checkout + every active
# worktree.
matches=()
for dir in "${migration_dirs[@]}"; do
  while IFS= read -r -d '' candidate; do
    matches+=("$candidate")
  done < <(find "$dir" -maxdepth 1 -type f -name "*${migration_name}.sql" -print0 2>/dev/null)
done

if [[ "${#matches[@]}" -eq 0 ]]; then
  echo "BLOCKED: no committed migration file matches name '${migration_name}'." >&2
  echo "Searched directories:" >&2
  for dir in "${migration_dirs[@]}"; do
    echo "  $dir" >&2
  done
  echo "Remediation: commit the migration to supabase/migrations/<timestamp>_${migration_name}.sql" >&2
  echo "before applying via MCP. The PR-binding rule prevents ad-hoc DDL on production." >&2
  exit 2
fi

# Compare the supplied query against each candidate file. Allow if any
# candidate byte-matches OR matches after normalizing trailing whitespace
# / final newline.
normalize() {
  # Strip trailing whitespace per line + ensure single trailing newline.
  local file="$1"
  awk '{ sub(/[[:space:]]+$/, "", $0); print }' "$file"
}

normalized_input="$(normalize "$query_file")"

allowed_path=""
for candidate in "${matches[@]}"; do
  normalized_candidate="$(normalize "$candidate")"
  if [[ "$normalized_input" == "$normalized_candidate" ]]; then
    allowed_path="$candidate"
    break
  fi
done

if [[ -z "$allowed_path" ]]; then
  echo "BLOCKED: SQL passed to apply_migration does not match any committed migration file." >&2
  echo "Search pattern: */${migration_name}.sql across ${#migration_dirs[@]} migration dir(s)" >&2
  echo "Candidates checked: ${#matches[@]}" >&2
  echo "" >&2
  echo "Remediation: edit the canonical file in supabase/migrations/, commit it, then" >&2
  echo "re-run apply_migration with the exact SQL from disk." >&2
  echo "" >&2
  echo "This hook prevents agents from improvising SQL in chat and shipping it to" >&2
  echo "production. See .claude/rules/archive/migration-safety.md." >&2
  exit 2
fi

# Allowed. Print a one-liner so the operator can see which file was matched.
echo "migration-pr-binding: allowing apply_migration name=${migration_name} bound to $(basename "$allowed_path")"
exit 0
