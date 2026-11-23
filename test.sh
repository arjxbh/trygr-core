#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
cd "$scratch"
export TRYGR_SECRET_DIR="$scratch/secrets"
"$root/node_modules/.bin/jest" --config "$root/jest.config.js" --runInBand "$@"
