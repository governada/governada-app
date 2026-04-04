#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical path: `npm run registry:index` or `npm run registry:index:check`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/generate-registry-index.js" "$@"
