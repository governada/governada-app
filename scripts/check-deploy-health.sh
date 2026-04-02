#!/usr/bin/env bash
set -euo pipefail

node "$(dirname "$0")/check-deploy-health.mjs" "$@"
