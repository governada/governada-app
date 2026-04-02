#!/usr/bin/env bash
set -euo pipefail

node "$(dirname "$0")/generate-registry-index.mjs" "$@"
