#!/usr/bin/env bash
# Pre-done evidence gate. Invoke before declaring implementation complete.

set -uo pipefail

usage() {
  cat <<'EOF'
pre-done.sh requires evidence before an agent declares work done.

Required:
  --url <url>                 URL where the change is visible
  --screenshot <path>         Existing screenshot artifact path
  --grep-evidence <text|path> Evidence that a git grep near-duplicate check ran

Environment alternatives:
  PRE_DONE_URL
  PRE_DONE_SCREENSHOT
  PRE_DONE_GREP_EVIDENCE

Remediation:
  1. Open the changed surface and record its URL.
  2. Capture a screenshot artifact, then pass its path.
  3. Run a near-duplicate check, for example:
     git diff --name-only --diff-filter=A origin/main...HEAD
     git grep -In "<new-file-stem>" -- . ':!<new-file>'
EOF
}

hook_mode=0
url="${PRE_DONE_URL:-}"
screenshot="${PRE_DONE_SCREENSHOT:-}"
grep_evidence="${PRE_DONE_GREP_EVIDENCE:-}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --hook-mode)
      hook_mode=1
      shift
      ;;
    --url)
      url="${2:-}"
      shift 2
      ;;
    --screenshot)
      screenshot="${2:-}"
      shift 2
      ;;
    --grep-evidence)
      grep_evidence="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "pre-done.sh: unknown argument '$1'" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ "$hook_mode" -eq 1 ] && [ "${PRE_DONE_REQUIRED:-0}" != "1" ]; then
  exit 0
fi

errors=0

if [ -z "$url" ]; then
  echo "PRE-DONE BLOCKED: missing URL where the change is visible." >&2
  echo "Remediation: rerun with --url <http://localhost:3000/path> or PRE_DONE_URL=..." >&2
  errors=1
elif ! printf '%s' "$url" | grep -Eq '^(https?://|file://|/)[^[:space:]]+'; then
  echo "PRE-DONE BLOCKED: URL must be an http(s), file://, or local path target: $url" >&2
  errors=1
fi

if [ -z "$screenshot" ]; then
  echo "PRE-DONE BLOCKED: missing screenshot artifact path." >&2
  echo "Remediation: capture a screenshot and rerun with --screenshot <path> or PRE_DONE_SCREENSHOT=..." >&2
  errors=1
elif [ ! -f "$screenshot" ]; then
  echo "PRE-DONE BLOCKED: screenshot artifact does not exist: $screenshot" >&2
  echo "Remediation: pass the actual saved screenshot path." >&2
  errors=1
fi

if [ -z "$grep_evidence" ]; then
  echo "PRE-DONE BLOCKED: missing git grep near-duplicate evidence." >&2
  echo "Remediation: run git grep for new-file stems and pass the command/output with --grep-evidence." >&2
  errors=1
else
  if [ -f "$grep_evidence" ]; then
    grep_text=$(cat "$grep_evidence")
  else
    grep_text="$grep_evidence"
  fi

  if ! printf '%s\n' "$grep_text" | grep -Eq 'git grep|no near-duplicate|no near duplicate|0 matches|no matches'; then
    echo "PRE-DONE BLOCKED: grep evidence must show a git grep near-duplicate check." >&2
    echo "Remediation: include the git grep command and its no-match result." >&2
    errors=1
  fi
fi

if [ "$errors" -ne 0 ]; then
  usage >&2
  exit 2
fi

echo "Pre-done evidence accepted:"
echo "- URL: $url"
echo "- Screenshot: $screenshot"
echo "- Near-duplicate check: recorded"
