#!/usr/bin/env bash
# bin/sentry.sh
#
# Resolve SENTRY_AUTH_TOKEN_OP_REF through the Governada agent service account,
# then run read-only Sentry API calls scoped to the Governada org/project. The
# token is never printed; stderr from 1Password/curl is redacted before display.

set -euo pipefail

ADDENDUM='[[decisions/lean-agent-harness#addendum-4-2026-05-05--pivot-from-user-pat-to-github-app-for-autonomous-agent-operations]]'
DEFAULT_AGENT_RUNTIME_FILE='/Users/tim/dev/agent-runtime/env/governada-agent.env'
DEFAULT_BASE_URL='https://sentry.io/api/0'
DEFAULT_ORG_SLUG='governada'
DEFAULT_PROJECT_SLUG='javascript-nextjs'

redact() {
  sed -E \
    -e 's/bt_[A-Za-z0-9_=-]{20,}/[redacted-betterstack-token]/g' \
    -e 's/betterstack_[A-Za-z0-9_=-]{20,}/[redacted-betterstack-token]/g' \
    -e 's/sntry[su]_[A-Za-z0-9_=-]{20,}/[redacted-sentry-token]/g' \
    -e 's/ops_[A-Za-z0-9_=-]{20,}/[redacted-op-token]/g' \
    -e 's#op://[^[:space:]]+#op://[redacted]#g' \
    -e 's/item [^: ]+/item [redacted]/g' \
    -e 's/vault [a-z0-9]{20,}/vault [redacted]/g'
}

usage() {
  cat <<'USAGE'
Usage:
  bin/sentry.sh issues [--query <query>] [--period <period>] [--limit <n>] [--org-slug <slug>] [--project-slug <slug>]
  bin/sentry.sh issue get <id> [--org-slug <slug>]
  bin/sentry.sh stats [--period <period>] [--org-slug <slug>] [--project-slug <slug>]
USAGE
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  repo_root="$(cd "$script_dir/.." && pwd -P)"
fi

refs_file="${GOVERNADA_OBSERVABILITY_ENV_REFS_FILE:-}"
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
      echo "Remediation: configure the Sentry op-ref per ${ADDENDUM}, then restart Claude Code."
    } >&2
    exit 1
  fi
  if [[ "$value" != op://* ]]; then
    echo "BLOCKED: ${key} must be an op:// 1Password reference." >&2
    exit 1
  fi
}

urlencode() {
  node -e 'console.log(encodeURIComponent(process.argv[1] || ""));' "$1"
}

period_to_since() {
  node -e '
const period = process.argv[1] || "24h";
const match = period.match(/^([1-9][0-9]*)([smhdw])$/);
if (!match) {
  console.error("BLOCKED: --period must look like 24h, 7d, or 30m.");
  process.exit(2);
}
const value = Number.parseInt(match[1], 10);
const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[match[2]];
const until = Math.floor(Date.now() / 1000);
const since = until - value * unitSeconds;
console.log(`${since} ${until}`);
' "$1"
}

token_ref="$(env_or_ref_value SENTRY_AUTH_TOKEN_OP_REF)"
assert_op_ref SENTRY_AUTH_TOKEN_OP_REF "$token_ref"

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
  echo 'BLOCKED: 1Password CLI (`op`) is not available for Sentry op-ref resolution.' >&2
  exit 1
fi

op_read_secret() {
  local op_ref="$1"
  local err_file
  err_file="$(mktemp "${TMPDIR:-/tmp}/governada-sentry-op-read.XXXXXX")" || return 1
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

curl_with_token() {
  local path="$1"
  local err_file
  local status
  local base_url="${SENTRY_API_BASE_URL:-$DEFAULT_BASE_URL}"

  err_file="$(mktemp "${TMPDIR:-/tmp}/governada-sentry-curl.XXXXXX")" || return 1
  set +e
  curl -sS --fail-with-body \
    --request GET \
    --url "${base_url}${path}" \
    --header "Authorization: Bearer ${sentry_token}" 2>"$err_file"
  status=$?
  set -e
  if [[ -s "$err_file" ]]; then
    redact <"$err_file" >&2
  fi
  rm -f "$err_file"
  return "$status"
}

set +e
sentry_token="$(op_read_secret "$token_ref")"
token_status=$?
set -e

if [[ "$token_status" -ne 0 || -z "$sentry_token" ]]; then
  echo "Remediation: confirm SENTRY_AUTH_TOKEN_OP_REF and the agent runtime SA token per ${ADDENDUM}." >&2
  exit 1
fi

org_slug="${SENTRY_ORG_SLUG:-$DEFAULT_ORG_SLUG}"
project_slug="${SENTRY_PROJECT_SLUG:-$DEFAULT_PROJECT_SLUG}"
command="${1:-}"
shift || true

case "$command" in
  issues)
    query="is:unresolved"
    period="24h"
    limit="20"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --query)
          query="${2:-}"
          shift 2
          ;;
        --period)
          period="${2:-}"
          shift 2
          ;;
        --limit)
          limit="${2:-}"
          shift 2
          ;;
        --org-slug)
          org_slug="${2:-}"
          shift 2
          ;;
        --project-slug)
          project_slug="${2:-}"
          shift 2
          ;;
        *)
          echo "BLOCKED: unknown issues argument: $1" >&2
          exit 1
          ;;
      esac
    done
    curl_with_token "/projects/${org_slug}/${project_slug}/issues/?query=$(urlencode "$query")&statsPeriod=$(urlencode "$period")&limit=$(urlencode "$limit")"
    ;;
  issue)
    subcommand="${1:-}"
    issue_id="${2:-}"
    shift $(( $# >= 2 ? 2 : $# ))
    if [[ "$subcommand" != "get" || -z "$issue_id" ]]; then
      usage >&2
      exit 1
    fi
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --org-slug)
          org_slug="${2:-}"
          shift 2
          ;;
        *)
          echo "BLOCKED: unknown issue get argument: $1" >&2
          exit 1
          ;;
      esac
    done
    curl_with_token "/organizations/${org_slug}/issues/${issue_id}/"
    ;;
  stats)
    period="24h"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --period)
          period="${2:-}"
          shift 2
          ;;
        --org-slug)
          org_slug="${2:-}"
          shift 2
          ;;
        --project-slug)
          project_slug="${2:-}"
          shift 2
          ;;
        *)
          echo "BLOCKED: unknown stats argument: $1" >&2
          exit 1
          ;;
      esac
    done
    read -r since until <<<"$(period_to_since "$period")"
    curl_with_token "/projects/${org_slug}/${project_slug}/stats/?stat=received&since=${since}&until=${until}&resolution=1h"
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
