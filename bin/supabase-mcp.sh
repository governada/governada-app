#!/usr/bin/env bash
# bin/supabase-mcp.sh
#
# Stdio wrapper that resolves SUPABASE_ACCESS_TOKEN from 1Password and execs
# the official Supabase MCP server scoped to the Governada production project.
#
# Pattern mirrors bin/gh.sh:
#   1. Read SUPABASE_ACCESS_TOKEN_OP_REF from .env.local.refs.
#   2. Read OP_AGENT_SERVICE_ACCOUNT_TOKEN from the agent runtime file.
#   3. Use `op read` (with the SA token) to resolve the access token.
#   4. exec npx @supabase/mcp-server-supabase with the token in env, scoped via
#      --project-ref so account-level tools are hidden.
#
# This wrapper is invoked by .mcp.json under server name "supabase". Tool calls
# become mcp__supabase__<tool> in Claude Code, matching the existing
# mcp__supabase__* allowlist.

set -euo pipefail

ADDENDUM='[[decisions/lean-agent-harness#addendum-4-2026-05-05--pivot-from-user-pat-to-github-app-for-autonomous-agent-operations]]'
DEFAULT_AGENT_RUNTIME_FILE='/Users/tim/dev/agent-runtime/env/governada-agent.env'
DEFAULT_PROJECT_REF='pbfprhbaayvcrxokgicr'

redact() {
  sed -E \
    -e 's/sbp_[A-Za-z0-9_]{20,}/[redacted-supabase-token]/g' \
    -e 's/ops_[A-Za-z0-9_=-]{20,}/[redacted-op-token]/g' \
    -e 's#op://[^[:space:]]+#op://[redacted]#g' \
    -e 's/item [^: ]+/item [redacted]/g' \
    -e 's/vault [a-z0-9]{20,}/vault [redacted]/g'
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  repo_root="$(cd "$script_dir/.." && pwd -P)"
fi

# Locate .env.local.refs, falling back to the shared checkout if invoked from a
# worktree that doesn't have its own copy.
refs_file="${GOVERNADA_SUPABASE_ENV_REFS_FILE:-}"
if [[ -z "$refs_file" ]]; then
  refs_file="$repo_root/.env.local.refs"
  if [[ ! -f "$refs_file" && "$repo_root" == *'/.claude/worktrees/'* ]]; then
    shared_root="${repo_root%%/.claude/worktrees/*}"
    if [[ -f "$shared_root/.env.local.refs" ]]; then
      refs_file="$shared_root/.env.local.refs"
    fi
  fi
fi

read_ref_value() {
  local key="$1"
  local file="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  sed -n -E "s/^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=[[:space:]]*//p" "$file" |
    tail -n 1 |
    sed -E 's/[[:space:]]+#.*$//; s/^[[:space:]]+//; s/[[:space:]]+$//; s/^"//; s/"$//; s/^'\''//; s/'\''$//'
}

env_or_ref_value() {
  local key="$1"
  local value="${!key:-}"
  if [[ -z "$value" ]]; then
    value="$(read_ref_value "$key" "$refs_file")"
  fi
  printf '%s' "$value"
}

assert_op_ref() {
  local key="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    {
      echo "BLOCKED: ${key} is not set in the process environment or .env.local.refs."
      echo "Remediation: configure the Supabase op-ref per ${ADDENDUM}, then restart Claude Code."
    } >&2
    exit 1
  fi
  if [[ "$value" != op://* ]]; then
    echo "BLOCKED: ${key} must be an op:// 1Password reference." >&2
    exit 1
  fi
}

token_ref="$(env_or_ref_value SUPABASE_ACCESS_TOKEN_OP_REF)"
assert_op_ref SUPABASE_ACCESS_TOKEN_OP_REF "$token_ref"

agent_runtime_file="${OP_AGENT_RUNTIME_FILE:-$DEFAULT_AGENT_RUNTIME_FILE}"
agent_token="$(read_ref_value OP_AGENT_SERVICE_ACCOUNT_TOKEN "$agent_runtime_file")"

if [[ -z "$agent_token" ]]; then
  {
    echo "BLOCKED: OP_AGENT_SERVICE_ACCOUNT_TOKEN is missing from ${agent_runtime_file}."
    echo "Remediation: configure the agent service-account runtime file per ${ADDENDUM}, then run npm run op:agent-doctor."
  } >&2
  exit 1
fi

if [[ "$agent_token" != ops_* ]]; then
  echo 'BLOCKED: OP_AGENT_SERVICE_ACCOUNT_TOKEN does not have the expected 1Password service-account token shape.' >&2
  exit 1
fi

if ! command -v op >/dev/null 2>&1; then
  echo 'BLOCKED: 1Password CLI (`op`) is not available for Supabase op-ref resolution.' >&2
  exit 1
fi

op_read_secret() {
  local op_ref="$1"
  local err_file
  err_file="$(mktemp "${TMPDIR:-/tmp}/governada-supabase-op-read.XXXXXX")" || return 1
  (
    export OP_SERVICE_ACCOUNT_TOKEN="$agent_token"
    unset OP_AGENT_SERVICE_ACCOUNT_TOKEN
    unset OP_ACCOUNT
    unset OP_CONNECT_HOST
    unset OP_CONNECT_TOKEN
    op read "$op_ref"
  ) 2>"$err_file"
  local status=$?
  if [[ -s "$err_file" ]]; then
    redact <"$err_file" >&2
  fi
  rm -f "$err_file"
  return "$status"
}

set +e
supabase_token="$(op_read_secret "$token_ref")"
token_status=$?
set -e

if [[ "$token_status" -ne 0 || -z "$supabase_token" ]]; then
  echo "Remediation: confirm SUPABASE_ACCESS_TOKEN_OP_REF and the agent runtime SA token per ${ADDENDUM}." >&2
  exit 1
fi

# Pin to the Governada production project so account-level tools are hidden.
project_ref="${SUPABASE_PRODUCTION_PROJECT_REF:-$DEFAULT_PROJECT_REF}"

# exec the stdio MCP server. We deliberately do NOT pass --read-only because
# apply_migration is gated by the PreToolUse hook
# .claude/hooks/migration-pr-binding.sh which only allows SQL byte-matching a
# committed migration file. execute_sql is currently ungated; see
# governada-brain/plans/repo-scoped-supabase-mcp.md for the follow-up.
exec env -u OP_SERVICE_ACCOUNT_TOKEN \
  -u OP_AGENT_SERVICE_ACCOUNT_TOKEN \
  -u OP_ACCOUNT \
  -u OP_CONNECT_HOST \
  -u OP_CONNECT_TOKEN \
  SUPABASE_ACCESS_TOKEN="$supabase_token" \
  npx -y @supabase/mcp-server-supabase \
    --project-ref="$project_ref"
