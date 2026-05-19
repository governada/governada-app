#!/usr/bin/env bash
# bin/betterstack.sh
#
# Resolve BETTERSTACK_API_TOKEN_OP_REF through the Governada agent service
# account, then run narrowly scoped Better Stack Uptime API calls. The token is
# never printed; stderr from 1Password/curl is redacted before display.

set -euo pipefail

ADDENDUM='[[decisions/lean-agent-harness#addendum-4-2026-05-05--pivot-from-user-pat-to-github-app-for-autonomous-agent-operations]]'
DEFAULT_AGENT_RUNTIME_FILE='/Users/tim/dev/agent-runtime/env/governada-agent.env'
DEFAULT_BASE_URL='https://uptime.betterstack.com/api/v2'

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
  bin/betterstack.sh monitor list
  bin/betterstack.sh monitor get <id>
  bin/betterstack.sh monitor create --type heartbeat --period <seconds> --grace <seconds> --name <name>
  bin/betterstack.sh monitor delete <id>
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
      echo "Remediation: configure the Better Stack op-ref per ${ADDENDUM}, then restart Claude Code."
    } >&2
    exit 1
  fi
  if [[ "$value" != op://* ]]; then
    echo "BLOCKED: ${key} must be an op:// 1Password reference." >&2
    exit 1
  fi
}

token_ref="$(env_or_ref_value BETTERSTACK_API_TOKEN_OP_REF)"
assert_op_ref BETTERSTACK_API_TOKEN_OP_REF "$token_ref"

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
  echo 'BLOCKED: 1Password CLI (`op`) is not available for Better Stack op-ref resolution.' >&2
  exit 1
fi

op_read_secret() {
  local op_ref="$1"
  local err_file
  err_file="$(mktemp "${TMPDIR:-/tmp}/governada-betterstack-op-read.XXXXXX")" || return 1
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
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local err_file
  local status
  local base_url="${BETTERSTACK_API_BASE_URL:-$DEFAULT_BASE_URL}"

  err_file="$(mktemp "${TMPDIR:-/tmp}/governada-betterstack-curl.XXXXXX")" || return 1
  set +e
  if [[ -n "$data" ]]; then
    curl -sS --fail-with-body \
      --request "$method" \
      --url "${base_url}${path}" \
      --header "Authorization: Bearer ${betterstack_token}" \
      --header 'Content-Type: application/json' \
      --data "$data" 2>"$err_file"
    status=$?
  else
    curl -sS --fail-with-body \
      --request "$method" \
      --url "${base_url}${path}" \
      --header "Authorization: Bearer ${betterstack_token}" 2>"$err_file"
    status=$?
  fi
  set -e
  if [[ -s "$err_file" ]]; then
    redact <"$err_file" >&2
  fi
  rm -f "$err_file"
  return "$status"
}

json_body() {
  node -e '
const [name, period, grace] = process.argv.slice(1);
console.log(JSON.stringify({
  name,
  period: Number.parseInt(period, 10),
  grace: Number.parseInt(grace, 10),
}));
' "$1" "$2" "$3"
}

set +e
betterstack_token="$(op_read_secret "$token_ref")"
token_status=$?
set -e

if [[ "$token_status" -ne 0 || -z "$betterstack_token" ]]; then
  echo "Remediation: confirm BETTERSTACK_API_TOKEN_OP_REF and the agent runtime SA token per ${ADDENDUM}." >&2
  exit 1
fi

resource="${1:-}"
action="${2:-}"
shift $(( $# >= 2 ? 2 : $# ))

if [[ "$resource" != "monitor" ]]; then
  usage >&2
  exit 1
fi

case "$action" in
  list)
    curl_with_token GET /heartbeats
    ;;
  get)
    monitor_id="${1:-}"
    if [[ -z "$monitor_id" ]]; then
      echo 'BLOCKED: monitor get requires an id.' >&2
      exit 1
    fi
    curl_with_token GET "/heartbeats/${monitor_id}"
    ;;
  delete)
    monitor_id="${1:-}"
    if [[ -z "$monitor_id" ]]; then
      echo 'BLOCKED: monitor delete requires an id.' >&2
      exit 1
    fi
    curl_with_token DELETE "/heartbeats/${monitor_id}"
    ;;
  create)
    type=""
    period=""
    grace=""
    name=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --type)
          type="${2:-}"
          shift 2
          ;;
        --period)
          period="${2:-}"
          shift 2
          ;;
        --grace)
          grace="${2:-}"
          shift 2
          ;;
        --name)
          name="${2:-}"
          shift 2
          ;;
        *)
          echo "BLOCKED: unknown monitor create argument: $1" >&2
          exit 1
          ;;
      esac
    done
    if [[ "$type" != "heartbeat" ]]; then
      echo 'BLOCKED: monitor create currently supports only --type heartbeat.' >&2
      exit 1
    fi
    if [[ -z "$period" || -z "$grace" || -z "$name" ]]; then
      echo 'BLOCKED: monitor create requires --period, --grace, and --name.' >&2
      exit 1
    fi
    body="$(json_body "$name" "$period" "$grace")"
    response="$(curl_with_token POST /heartbeats "$body")"
    printf '%s\n' "$response" |
      node -e '
let text = "";
process.stdin.on("data", (chunk) => {
  text += chunk;
});
process.stdin.on("end", () => {
  const body = JSON.parse(text);
  const id = body?.data?.id;
  if (!id || !body?.data?.attributes?.url) {
    console.error("BLOCKED: Better Stack create response did not include data.id and data.attributes.url.");
    process.exit(1);
  }
  console.log(`https://uptime.betterstack.com/api/v2/heartbeats/${id}`);
});
'
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
