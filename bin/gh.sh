#!/usr/bin/env bash
set -euo pipefail

ADDENDUM='[[decisions/lean-agent-harness#addendum-3-2026-05-04--agent-sa-reads-the-github-pat-revises-addenda-1-and-2]]'
DEFAULT_AGENT_RUNTIME_FILE='/Users/tim/dev/agent-runtime/env/governada-agent.env'

redact() {
  sed -E \
    -e 's/(gh[pousr]_|github_pat_)[A-Za-z0-9_]{12,}/[redacted-github-token]/g' \
    -e 's/ops_[A-Za-z0-9_=-]{20,}/[redacted-op-token]/g' \
    -e 's#op://[^[:space:]]+#op://[redacted]#g' \
    -e 's/item [^: ]+/item [redacted]/g' \
    -e 's/vault [a-z0-9]{20,}/vault [redacted]/g'
}

reject_token_oracle_command() {
  local command="${1:-}"
  local subcommand="${2:-}"

  if [[ "$command" == "auth" && "$subcommand" == "token" ]]; then
    echo 'BLOCKED: bin/gh.sh does not run token-printing gh auth commands.' >&2
    exit 1
  fi

  if [[ "$command" == "auth" && "$subcommand" == "status" ]]; then
    local arg
    for arg in "$@"; do
      if [[ "$arg" == "--show-token" ]]; then
        echo 'BLOCKED: bin/gh.sh does not run token-printing gh auth commands.' >&2
        exit 1
      fi
    done
  fi
}

reject_token_oracle_command "$@"

block_policy() {
  echo "BLOCKED: bin/gh.sh allows only governed Governada GitHub operations: $1" >&2
  exit 1
}

is_governada_repo_arg() {
  [[ "$1" == "governada/app" || "$1" == "https://github.com/governada/app" || "$1" == "github.com/governada/app" ]]
}

assert_repo_arg_allowed() {
  local args=("$@")
  local arg repo
  local i

  for ((i = 0; i < ${#args[@]}; i++)); do
    arg="${args[$i]}"
    repo=""
    case "$arg" in
      -R | --repo)
        i=$((i + 1))
        repo="${args[$i]:-}"
        ;;
      --repo=*)
        repo="${arg#--repo=}"
        ;;
      -R*)
        repo="${arg#-R}"
        ;;
    esac

    if [[ -n "$repo" ]] && ! is_governada_repo_arg "$repo"; then
      block_policy "the GitHub API lane is scoped to governada/app, not ${repo}."
    fi
  done
}

require_value_arg() {
  local flag="$1"
  local value="${2:-}"

  if [[ -z "$value" || "$value" == -* ]]; then
    block_policy "${flag} requires an explicit value."
  fi
}

check_pr_metadata_flags() {
  local mode="$1"
  shift
  local args=("$@")
  local arg
  local positional_count=0
  local has_draft=0
  local i

  for ((i = 0; i < ${#args[@]}; i++)); do
    arg="${args[$i]}"
    case "$arg" in
      --draft)
        has_draft=1
        ;;
      --repo | -R | --title | --body | --body-file)
        require_value_arg "$arg" "${args[$((i + 1))]:-}"
        i=$((i + 1))
        ;;
      --base | --head)
        if [[ "$mode" != "create" ]]; then
          block_policy "${arg} is only allowed for draft PR creation."
        fi
        require_value_arg "$arg" "${args[$((i + 1))]:-}"
        i=$((i + 1))
        ;;
      --repo=* | -R* | --title=* | --body=* | --body-file=*)
        ;;
      --base=* | --head=*)
        if [[ "$mode" != "create" ]]; then
          block_policy "${arg%%=*} is only allowed for draft PR creation."
        fi
        ;;
      --label | --assignee | --reviewer | --label=* | --assignee=* | --reviewer=*)
        block_policy "labels, assignees, and reviewers are outside the autonomous PR metadata lane."
        ;;
      --fill | --fill-first | --fill-verbose)
        if [[ "$mode" != "create" ]]; then
          block_policy "${arg} is only allowed for draft PR creation."
        fi
        ;;
      --dry-run)
        if [[ "$mode" != "create" ]]; then
          block_policy "${arg} is only allowed for draft PR creation."
        fi
        ;;
      --web)
        block_policy "interactive browser auth or PR flows are not part of the autonomous lane."
        ;;
      --*)
        block_policy "PR ${mode} flag ${arg} is not in the allowlist."
        ;;
      -*)
        block_policy "PR ${mode} short flag ${arg} is not in the allowlist."
        ;;
      *)
        positional_count=$((positional_count + 1))
        if [[ "$mode" == "create" ]]; then
          block_policy "PR create must use flags, not positional argument ${arg}."
        fi
        if [[ "$positional_count" -gt 1 ]]; then
          block_policy "PR ${mode} accepts only one PR number or URL positional argument."
        fi
        ;;
    esac
  done

  if [[ "$mode" == "create" && "$has_draft" -ne 1 ]]; then
    block_policy "PR creation through the autonomous lane must use --draft."
  fi
}

check_pr_comment_flags() {
  local args=("$@")
  local arg positional_count=0
  local i

  for ((i = 0; i < ${#args[@]}; i++)); do
    arg="${args[$i]}"
    case "$arg" in
      --repo | -R | --body | --body-file)
        require_value_arg "$arg" "${args[$((i + 1))]:-}"
        i=$((i + 1))
        ;;
      --repo=* | -R*)
        ;;
      --body=* | --body-file=*)
        ;;
      --edit-last | --delete-last | --web)
        block_policy "PR comment mutation flags beyond posting a comment require Tim approval."
        ;;
      --*)
        block_policy "PR comment flag ${arg} is not in the allowlist."
        ;;
      -*)
        block_policy "PR comment short flag ${arg} is not in the allowlist."
        ;;
      *)
        positional_count=$((positional_count + 1))
        if [[ "$positional_count" -gt 1 ]]; then
          block_policy "PR comment accepts only one PR number or URL positional argument."
        fi
        ;;
    esac
  done
}

enforce_pr_policy() {
  local subcommand="${1:-}"
  shift || true

  assert_repo_arg_allowed "$@"

  case "$subcommand" in
    view | list | diff | checks | status)
      return 0
      ;;
    create)
      check_pr_metadata_flags create "$@"
      return 0
      ;;
    edit)
      check_pr_metadata_flags edit "$@"
      return 0
      ;;
    comment)
      check_pr_comment_flags "$@"
      return 0
      ;;
    merge | ready | close | reopen | review | checkout | lock | unlock)
      block_policy "gh pr ${subcommand} is outside the autonomous lane."
      ;;
    *)
      block_policy "gh pr ${subcommand:-'(missing subcommand)'} is not in the allowlist."
      ;;
  esac
}

capture_api_field() {
  local field="$1"

  if [[ "$field" == "draft=true" || "$field" == "draft=True" || "$field" == "draft=1" ]]; then
    api_has_draft_field=1
  fi
}

enforce_api_policy() {
  local args=("$@")
  local arg endpoint="" method="" has_body_fields=0
  local i
  api_has_draft_field=0

  for ((i = 0; i < ${#args[@]}; i++)); do
    arg="${args[$i]}"
    case "$arg" in
      -X | --method)
        require_value_arg "$arg" "${args[$((i + 1))]:-}"
        i=$((i + 1))
        method="${args[$i]}"
        ;;
      --method=*)
        method="${arg#--method=}"
        ;;
      -X*)
        method="${arg#-X}"
        ;;
      -f | -F | --field | --raw-field)
        require_value_arg "$arg" "${args[$((i + 1))]:-}"
        has_body_fields=1
        i=$((i + 1))
        capture_api_field "${args[$i]}"
        ;;
      --field=* | --raw-field=*)
        has_body_fields=1
        capture_api_field "${arg#*=}"
        ;;
      -f* | -F*)
        has_body_fields=1
        capture_api_field "${arg:2}"
        ;;
      --input | --input=*)
        block_policy "gh api --input is not allowed in the autonomous lane."
        ;;
      --hostname | --hostname=*)
        block_policy "the autonomous lane is scoped to github.com/governada/app."
        ;;
      --verbose)
        block_policy "verbose gh api output is not allowed because it can expose auth material."
        ;;
      -H | --header | --jq | --template | --cache | --preview)
        require_value_arg "$arg" "${args[$((i + 1))]:-}"
        i=$((i + 1))
        ;;
      --header=* | --jq=* | --template=* | --cache=* | --preview=*)
        ;;
      -i | --include | --paginate | --slurp | --silent)
        ;;
      --*)
        block_policy "gh api flag ${arg} is not in the allowlist."
        ;;
      -*)
        block_policy "gh api short flag ${arg} is not in the allowlist."
        ;;
      *)
        if [[ -z "$endpoint" ]]; then
          endpoint="${arg#/}"
        else
          block_policy "gh api accepts only one endpoint in this lane."
        fi
        ;;
    esac
  done

  if [[ -z "$endpoint" ]]; then
    block_policy "gh api requires an allowlisted endpoint."
  fi

  if [[ -z "$method" ]]; then
    if [[ "$has_body_fields" -eq 1 ]]; then
      method="POST"
    else
      method="GET"
    fi
  fi
  method="$(printf '%s' "$method" | tr '[:lower:]' '[:upper:]')"

  if [[ "$method" == "GET" ]]; then
    if [[ "$endpoint" == "user" || "$endpoint" == "repos/governada/app" ]]; then
      return 0
    fi
    if [[ "$endpoint" =~ ^repos/governada/app/pulls(/[0-9]+)?$ ]]; then
      return 0
    fi
    if [[ "$endpoint" =~ ^repos/governada/app/commits/[A-Za-z0-9._-]+/check-runs$ ]]; then
      return 0
    fi
    if [[ "$endpoint" =~ ^repos/governada/app/actions/runs(/[0-9]+)?$ ]]; then
      return 0
    fi
    if [[ "$endpoint" =~ ^repos/governada/app/actions/runs/[0-9]+/jobs$ ]]; then
      return 0
    fi
    if [[ "$endpoint" =~ ^repos/governada/app/actions/jobs/[0-9]+/logs$ ]]; then
      return 0
    fi
  fi

  if [[ "$method" == "POST" && "$endpoint" == "repos/governada/app/pulls" ]]; then
    if [[ "$api_has_draft_field" -ne 1 ]]; then
      block_policy "direct PR creation through gh api must include draft=true."
    fi
    return 0
  fi

  block_policy "gh api ${method} /${endpoint} is not in the allowlist."
}

enforce_capability_policy() {
  local command="${1:-}"
  shift || true

  case "$command" in
    api)
      enforce_api_policy "$@"
      ;;
    pr)
      enforce_pr_policy "$@"
      ;;
    *)
      block_policy "gh ${command:-'(missing command)'} is not in the allowlist."
      ;;
  esac
}

enforce_capability_policy "$@"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  repo_root="$(cd "$script_dir/.." && pwd -P)"
fi

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
set +e
(
  export OP_SERVICE_ACCOUNT_TOKEN="$agent_token"
  unset OP_AGENT_SERVICE_ACCOUNT_TOKEN
  unset OP_ACCOUNT
  unset OP_CONNECT_HOST
  unset OP_CONNECT_TOKEN
  op run --env-file <(printf 'GH_TOKEN=%s\n' "$gh_token_ref") -- \
    env -u OP_SERVICE_ACCOUNT_TOKEN \
      -u OP_AGENT_SERVICE_ACCOUNT_TOKEN \
      -u OP_ACCOUNT \
      -u OP_CONNECT_HOST \
      -u OP_CONNECT_TOKEN \
      "$gh_bin" "$@"
) > >(redact) 2> >(redact >&2)
status=$?
set -e

if [[ "$status" -ne 0 ]]; then
  echo 'Remediation: confirm GH_TOKEN_OP_REF points at the Governada-Agent/governada-app-agent credential item and the agent runtime SA token is valid, then run npm run gh:auth-status.' >&2
fi

exit "$status"
