#!/usr/bin/env bash
set -euo pipefail

node "$(dirname "$0")/pre-merge-check.mjs" "$@"
