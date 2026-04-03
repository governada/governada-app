#!/usr/bin/env bash
# Legacy compatibility shim.
# Canonical desktop-agent auth context uses `scripts/set_gh_context.ps1`.
# This file remains only for Bash fallbacks that need exported env vars.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
eval "$(node "$SCRIPT_DIR/set-gh-context.js" --format=sh)"
