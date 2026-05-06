#!/usr/bin/env bash
set -euo pipefail

ADDENDUM='[[decisions/lean-agent-harness#addendum-4-2026-05-05--pivot-from-user-pat-to-github-app-for-autonomous-agent-operations]]'
DEFAULT_AGENT_RUNTIME_FILE='/Users/tim/dev/agent-runtime/env/governada-agent.env'

redact() {
  sed -E \
    -e 's/gh[pousr]_[A-Za-z0-9_]{12,}/[redacted-github-token]/g' \
    -e 's/ops_[A-Za-z0-9_=-]{20,}/[redacted-op-token]/g' \
    -e 's#op://[^[:space:]]+#op://[redacted]#g' \
    -e 's/item [^: ]+/item [redacted]/g' \
    -e 's/vault [a-z0-9]{20,}/vault [redacted]/g'
}

block_policy() {
  echo "BLOCKED: bin/git-push.sh allows only governed Governada branch publication: $1" >&2
  exit 1
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  repo_root="$(cd "$script_dir/.." && pwd -P)"
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

refs_file="${GOVERNADA_GH_ENV_REFS_FILE:-}"
if [[ -z "$refs_file" ]]; then
  refs_file="$repo_root/.env.local.refs"
  if [[ ! -f "$refs_file" && "$repo_root" == *'/.claude/worktrees/'* ]]; then
    shared_root="${repo_root%%/.claude/worktrees/*}"
    if [[ -f "$shared_root/.env.local.refs" ]]; then
      refs_file="$shared_root/.env.local.refs"
    fi
  fi
fi

app_ref_value() {
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
      echo "Remediation: configure GitHub App op-refs per ${ADDENDUM}, then run npm run gh:auth-status."
    } >&2
    exit 1
  fi
  if [[ "$value" != op://* ]]; then
    echo "BLOCKED: ${key} must be an op:// 1Password reference." >&2
    exit 1
  fi
}

contains_blocked_flag() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --force | -f | --force-with-lease | --force-with-lease=* | --delete | -d | --mirror | --all | --tags | --prune | --repo | --repo=*)
        block_policy "flag ${arg} is outside the autonomous branch-publication lane."
        ;;
    esac
  done
}

parse_push_args() {
  contains_blocked_flag "$@"

  local remote="origin"
  local ref=""
  local parsed=()
  local positional=()
  local arg

  for arg in "$@"; do
    case "$arg" in
      --dry-run | -u | --set-upstream)
        parsed+=("$arg")
        ;;
      --*)
        block_policy "flag ${arg} is not in the allowlist."
        ;;
      -*)
        block_policy "short flag ${arg} is not in the allowlist."
        ;;
      *)
        positional+=("$arg")
        ;;
    esac
  done

  if [[ "${#positional[@]}" -gt 2 ]]; then
    block_policy "expected at most remote and ref positional arguments."
  fi

  if [[ "${#positional[@]}" -eq 1 ]]; then
    if [[ "${positional[0]}" == "origin" ]]; then
      remote="origin"
    else
      ref="${positional[0]}"
    fi
  elif [[ "${#positional[@]}" -eq 2 ]]; then
    remote="${positional[0]}"
    ref="${positional[1]}"
  fi

  if [[ "$remote" != "origin" ]]; then
    block_policy "remote must be origin."
  fi

  if [[ -z "$ref" ]]; then
    ref="$(git -C "$repo_root" branch --show-current)"
  fi

  if [[ -z "$ref" ]]; then
    block_policy "could not determine branch; pass origin feat/<branch> or origin codex/<branch>."
  fi

  case "$ref" in
    main | refs/heads/main | master | refs/heads/master | release/* | refs/heads/release/* | production* | refs/heads/production*)
      block_policy "target ${ref} is protected."
      ;;
  esac

  if [[ ! "$ref" =~ ^(refs/heads/)?(feat|codex)/.+$ ]]; then
    block_policy "target ${ref} must match feat/* or codex/*."
  fi

  PUSH_ARGS=("origin" "$ref")
  if [[ "${#parsed[@]}" -gt 0 ]]; then
    PUSH_ARGS=("${parsed[@]}" "${PUSH_ARGS[@]}")
  fi
}

parse_push_args "$@"

client_id_ref="$(app_ref_value GOVERNADA_GITHUB_CLIENT_ID_OP_REF)"
installation_id_ref="$(app_ref_value GOVERNADA_GITHUB_INSTALLATION_ID_OP_REF)"
private_key_ref="$(app_ref_value GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF)"
assert_op_ref GOVERNADA_GITHUB_CLIENT_ID_OP_REF "$client_id_ref"
assert_op_ref GOVERNADA_GITHUB_INSTALLATION_ID_OP_REF "$installation_id_ref"
assert_op_ref GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF "$private_key_ref"

agent_runtime_file="${OP_AGENT_RUNTIME_FILE:-$DEFAULT_AGENT_RUNTIME_FILE}"
agent_token="$(read_ref_value OP_AGENT_SERVICE_ACCOUNT_TOKEN "$agent_runtime_file")"
if [[ -z "$agent_token" ]]; then
  echo "BLOCKED: OP_AGENT_SERVICE_ACCOUNT_TOKEN is missing from ${agent_runtime_file}." >&2
  exit 1
fi
if [[ "$agent_token" != ops_* ]]; then
  echo 'BLOCKED: OP_AGENT_SERVICE_ACCOUNT_TOKEN does not have the expected 1Password service-account token shape.' >&2
  exit 1
fi
if ! command -v op >/dev/null 2>&1; then
  echo 'BLOCKED: 1Password CLI (`op`) is not available for GitHub App op-ref resolution.' >&2
  exit 1
fi

op_read_secret() {
  local op_ref="$1"
  local err_file
  err_file="$(mktemp "${TMPDIR:-/tmp}/governada-op-read.XXXXXX")" || return 1
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

unset GH_TOKEN
unset GITHUB_TOKEN
unset GH_HOST
set +e
client_id="$(op_read_secret "$client_id_ref")"
client_id_status=$?
installation_id="$(op_read_secret "$installation_id_ref")"
installation_id_status=$?
private_key="$(op_read_secret "$private_key_ref")"
private_key_status=$?
set -e

if [[ "$client_id_status" -ne 0 || "$installation_id_status" -ne 0 || "$private_key_status" -ne 0 ]]; then
  echo "Remediation: confirm GitHub App op-refs and the agent runtime SA token per ${ADDENDUM}." >&2
  exit 1
fi

export GOVERNADA_GITHUB_CLIENT_ID="$client_id"
export GOVERNADA_GITHUB_INSTALLATION_ID="$installation_id"
export GOVERNADA_GITHUB_APP_PRIVATE_KEY="$private_key"
mint_err_file="$(mktemp "${TMPDIR:-/tmp}/governada-mint.XXXXXX")"
set +e
minted_token="$(
  env -u OP_SERVICE_ACCOUNT_TOKEN \
    -u OP_AGENT_SERVICE_ACCOUNT_TOKEN \
    -u OP_ACCOUNT \
    -u OP_CONNECT_HOST \
    -u OP_CONNECT_TOKEN \
    node "$repo_root/scripts/mint-installation-token.mjs" 2>"$mint_err_file"
)"
mint_status=$?
set -e
unset GOVERNADA_GITHUB_CLIENT_ID
unset GOVERNADA_GITHUB_INSTALLATION_ID
unset GOVERNADA_GITHUB_APP_PRIVATE_KEY
if [[ -s "$mint_err_file" ]]; then
  redact <"$mint_err_file" >&2
fi
rm -f "$mint_err_file"

if [[ "$mint_status" -ne 0 || -z "$minted_token" ]]; then
  echo "Remediation: confirm GitHub App op-refs and the agent runtime SA token per ${ADDENDUM}." >&2
  if [[ "$mint_status" -ne 0 ]]; then
    exit "$mint_status"
  fi
  exit 1
fi

export GH_TOKEN="$minted_token"
set +e
git -C "$repo_root" \
  -c remote.origin.pushurl=https://github.com/governada/app.git \
  -c credential.helper='!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' \
  push "${PUSH_ARGS[@]}" > >(redact) 2> >(redact >&2)
status=$?
set -e

exit "$status"
