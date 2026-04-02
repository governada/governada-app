#!/usr/bin/env bash
set -euo pipefail

node "$(dirname "$0")/check-error-rate.mjs" "$@"
