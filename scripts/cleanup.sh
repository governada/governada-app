#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical path: `npm run cleanup`, `npm run cleanup:clean`, `npm run cleanup:clean-all`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/cleanup.js" "$@"
