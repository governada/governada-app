#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/observability-wrappers-test.XXXXXX")"
trap 'rm -rf "$tmp_root"' EXIT

empty_refs="$tmp_root/empty.env"
runtime_file="$tmp_root/governada-agent.env"
fake_bin="$tmp_root/bin"
mkdir -p "$fake_bin"
touch "$empty_refs"
printf 'OP_AGENT_SERVICE_ACCOUNT_TOKEN=ops_testserviceaccounttoken1234567890\n' >"$runtime_file"

for wrapper in betterstack sentry; do
  case "$wrapper" in
    betterstack)
      expected_key='BETTERSTACK_API_TOKEN_OP_REF'
      command=(monitor list)
      ;;
    sentry)
      expected_key='SENTRY_AUTH_TOKEN_OP_REF'
      command=(issues --query 'is:unresolved')
      ;;
  esac

  set +e
  output="$(
    GOVERNADA_OBSERVABILITY_ENV_REFS_FILE="$empty_refs" \
      OP_AGENT_RUNTIME_FILE="$runtime_file" \
      "$repo_root/bin/${wrapper}.sh" "${command[@]}" 2>&1
  )"
  status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    printf 'expected %s wrapper to fail closed with missing op-ref\n' "$wrapper" >&2
    exit 1
  fi
  if ! printf '%s\n' "$output" | grep -Fq "BLOCKED: ${expected_key} is not set"; then
    printf 'expected %s wrapper to report missing %s, got:\n%s\n' "$wrapper" "$expected_key" "$output" >&2
    exit 1
  fi
done

cat >"$fake_bin/op" <<'OP'
#!/usr/bin/env bash
echo 'op failed for op://Governada-Agent/fake/token with sntrys_secretvalue1234567890 bt_secretvalue1234567890 ops_secretvalue1234567890' >&2
exit 1
OP
chmod +x "$fake_bin/op"

for wrapper in betterstack sentry; do
  refs_file="$tmp_root/${wrapper}.env"
  case "$wrapper" in
    betterstack)
      printf 'BETTERSTACK_API_TOKEN_OP_REF=op://Governada-Agent/fake/token\n' >"$refs_file"
      command=(monitor list)
      remediation='Remediation: confirm BETTERSTACK_API_TOKEN_OP_REF'
      ;;
    sentry)
      printf 'SENTRY_AUTH_TOKEN_OP_REF=op://Governada-Agent/fake/token\n' >"$refs_file"
      command=(issues --query 'is:unresolved')
      remediation='Remediation: confirm SENTRY_AUTH_TOKEN_OP_REF'
      ;;
  esac

  set +e
  output="$(
    PATH="$fake_bin:$PATH" \
      GOVERNADA_OBSERVABILITY_ENV_REFS_FILE="$refs_file" \
      OP_AGENT_RUNTIME_FILE="$runtime_file" \
      "$repo_root/bin/${wrapper}.sh" "${command[@]}" 2>&1
  )"
  status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    printf 'expected %s wrapper to fail closed when op read fails\n' "$wrapper" >&2
    exit 1
  fi
  if ! printf '%s\n' "$output" | grep -Fq "$remediation"; then
    printf 'expected %s wrapper to print remediation, got:\n%s\n' "$wrapper" "$output" >&2
    exit 1
  fi
  for leaked in 'op://Governada-Agent' 'sntrys_secretvalue' 'bt_secretvalue' 'ops_secretvalue'; do
    if printf '%s\n' "$output" | grep -Fq "$leaked"; then
      printf 'expected %s wrapper output to redact %s, got:\n%s\n' "$wrapper" "$leaked" "$output" >&2
      exit 1
    fi
  done
done

printf 'observability wrapper fail-closed tests passed\n'
