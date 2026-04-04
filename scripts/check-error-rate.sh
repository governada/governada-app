#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical path: `npm run check:error-rate`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/check-error-rate.js" "$@"
