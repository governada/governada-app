#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical path: `npm run smoke-test -- [base-url] [--quiet]`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"
exec npm run smoke-test -- "$@"
