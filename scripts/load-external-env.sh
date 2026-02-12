#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIDGE_ENV="$ROOT_DIR/.env"

[[ -f "$BRIDGE_ENV" ]] || { echo "Missing bridge env: $BRIDGE_ENV" >&2; exit 1; }

set -a
. "$BRIDGE_ENV"
set +a

: "${EXTERNAL_ENV_1:?EXTERNAL_ENV_1 is required in $BRIDGE_ENV}"
[[ -f "$EXTERNAL_ENV_1" ]] || { echo "Missing external env: $EXTERNAL_ENV_1" >&2; exit 1; }

set -a
. "$EXTERNAL_ENV_1"
set +a
