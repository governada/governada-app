#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical path: `npm run migration:test`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/test-migration.js" "$@"
