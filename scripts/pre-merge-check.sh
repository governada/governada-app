#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical path: `npm run pre-merge-check -- <PR#>`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/pre-merge-check.js" "$@"
