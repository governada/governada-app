#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical path: `npm run uptime-check -- [proposals|batch|daily|deploy|all]`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/uptime-check.js" "$@"
