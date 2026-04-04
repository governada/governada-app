#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical path: `npm run notify -- <type> <title> [details]`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/notify.js" "$@"
