#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
target=${1:-${TRYGR_DEPLOY_HOST:?Supply a deployment host or set TRYGR_DEPLOY_HOST}}
if [[ ! $target =~ ^[[:alnum:]_][[:alnum:]_.@-]*$ ]]; then
  echo 'Expected an SSH hostname or user@hostname' >&2
  exit 1
fi
npm run check
# Send only compiled code, manifests and the two host-side scripts.
tar --exclude='*.test.js' -czf - dist web package.json package-lock.json scripts/install-mac.sh scripts/set-secret.sh scripts/kasa_modern.py scripts/matter.sh |
  ssh "$target" 'set -eu
    test "$(uname -s)" = Darwin
    umask 077
    base="$HOME/.local/share/trygr"
    mkdir -p "$base/releases"
    stage=$(mktemp -d "$base/releases/build.XXXXXXXX")
    cd "$stage"
    tar -xzf -
    exec bash scripts/install-mac.sh'
