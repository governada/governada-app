#!/usr/bin/env bash
set -euo pipefail

ADDENDUM='[[decisions/lean-agent-harness#addendum-2-2026-05-04--github-api-write-lane-via-gh_token_op_ref]]'

redact() {
  sed -E \
    -e 's/(gh[pousr]_|github_pat_)[A-Za-z0-9_]{12,}/[redacted-github-token]/g' \
    -e 's/ops_[A-Za-z0-9_=-]{20,}/[redacted-op-token]/g' \
    -e 's#op://[^[:space:]]+#op://[redacted]#g' \
    -e 's/item [^: ]+/item [redacted]/g' \
    -e 's/vault [a-z0-9]{20,}/vault [redacted]/g'
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel 2>/dev/null || cd "$script_dir/.." && pwd -P)"

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

gh_token_ref="${GH_TOKEN_OP_REF:-}"
if [[ -z "$gh_token_ref" ]]; then
  gh_token_ref="$(read_ref_value GH_TOKEN_OP_REF "$refs_file")"
fi

if [[ -z "$gh_token_ref" ]]; then
  {
    echo "BLOCKED: GH_TOKEN_OP_REF is not set in the process environment or .env.local.refs."
    echo "Remediation: configure GH_TOKEN_OP_REF per ${ADDENDUM}, then run npm run gh:auth-status."
  } >&2
  exit 1
fi

if ! command -v op >/dev/null 2>&1; then
  echo 'BLOCKED: 1Password CLI (`op`) is not available for GH_TOKEN_OP_REF resolution.' >&2
  exit 1
fi

gh_bin="${GOVERNADA_SYSTEM_GH:-$(command -v gh || true)}"
if [[ -z "$gh_bin" ]]; then
  echo 'BLOCKED: GitHub CLI (`gh`) is not available.' >&2
  exit 1
fi

unset GH_TOKEN
unset GITHUB_TOKEN
unset GH_HOST
export OP_ACCOUNT="${OP_ACCOUNT:-my.1password.com}"
set +e
# Use `op run` instead of shell-capturing `op read`; Codex can hit desktop IPC
# hangs when secret values are piped through command substitution.
op --account "$OP_ACCOUNT" run --env-file <(printf 'GH_TOKEN=%s\n' "$gh_token_ref") -- "$gh_bin" "$@" 2> >(redact >&2)
status=$?
set -e

if [[ "$status" -ne 0 ]]; then
  echo 'Remediation: confirm GH_TOKEN_OP_REF points at the Governada-Human/governada-app-agent credential item, then run npm run gh:auth-status.' >&2
fi

exit "$status"
