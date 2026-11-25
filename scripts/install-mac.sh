#!/usr/bin/env bash
set -euo pipefail
umask 077
export PATH="/opt/homebrew/opt/node@24/bin:/usr/local/opt/node@24/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
release=$(pwd -P)
base="$HOME/.local/share/trygr"
label=local.trygr.bridge
domain="gui/$(id -u)"
plist="$HOME/Library/LaunchAgents/$label.plist"
mkdir -p "$base/state" "$base/logs" "$(dirname "$plist")"
mkdir "$base/deploy.lock" || { echo 'Another deployment holds deploy.lock' >&2; exit 1; }
trap 'rmdir "$base/deploy.lock"' EXIT
launchctl print "$domain" >/dev/null
node -e 'if(process.versions.node.split(".")[0] !== "24") throw Error("Node 24 required")'
test "$(redis-cli ping)" = PONG
if [[ ! -x "$base/kasa-env/bin/python" ]]; then python3 -m venv "$base/kasa-env"; fi
"$base/kasa-env/bin/python" -m pip install --disable-pip-version-check 'python-kasa==0.12.0'
"$base/kasa-env/bin/python" -m venv "$release/eufy-env"
"$release/eufy-env/bin/python" -m pip install --disable-pip-version-check 'eufy-omni-cloud[map] @ https://github.com/adamg23/Eufy-Omni/archive/a5eeb4333b8a32ffd3cf04068277cb889acab7fe.zip' 'protobuf>=7.36.0,<8' Pillow
"$release/eufy-env/bin/python" -c 'import eufy_omni_cloud.account, eufy_omni_cloud.maprender'
npm ci --omit=dev --no-audit --no-fund
node -e 'require("ring-client-api"); require("tplink-smarthome-api")'
node - "$release" "$base" "$label" "$(command -v node)" > agent.json <<'JS'
const [, , release, base, Label, nodePath] = process.argv;
console.log(JSON.stringify({
  Label, ProgramArguments: [nodePath, release + '/dist/app.js'],
  WorkingDirectory: base + '/state', RunAtLoad: true, KeepAlive: true,
  ThrottleInterval: 15, Umask: 63,
  StandardOutPath: base + '/logs/bridge.log', StandardErrorPath: base + '/logs/error.log',
}));
JS
plutil -convert xml1 -o agent.plist agent.json
previous="$release/previous.plist"
if [[ -f $plist ]]; then cp "$plist" "$previous"; fi
if launchctl print "$domain/$label" >/dev/null 2>&1; then launchctl bootout "$domain/$label"; fi
activate() {
  cp "$1" "$plist.tmp" && mv "$plist.tmp" "$plist" || return 1
  for ((i=0;i<5;i++)); do
    launchctl bootstrap "$domain" "$plist" && return 0
    sleep 1
  done
  return 1
}
healthy() {
  local pid response
  for ((attempt=0; attempt<20; attempt++)); do
    pid=$(launchctl print "$domain/$label" | awk '$1 == "pid" {print $3; exit}') || true
    response=$(curl -fsS --max-time 2 http://127.0.0.1:3333/health 2>/dev/null) || response=''
    if [[ -n $pid && -n $response ]] && node -e 'try {let h=JSON.parse(process.argv[1]);process.exit(h.service==="trygr" && h.pid===Number(process.argv[2])?0:1)}catch{process.exit(1)}' "$response" "$pid"; then return 0; fi
    sleep 1
  done
  return 1
}
if activate "$release/agent.plist" && healthy; then
  ln -sfn "$release/scripts/matter.sh" "$base/matter.sh"
  ln -sfn "$release/scripts/set-secret.sh" "$base/set-secret.sh"
  echo "Trygr is running from $release"
  exit 0
fi
echo "Release failed health check. See $base/logs/error.log" >&2
launchctl bootout "$domain/$label" 2>/dev/null || true
if [[ -f $previous ]]; then
  activate "$previous" && healthy || { echo 'Previous release failed to restart' >&2; exit 1; }
  echo 'Previous release restored' >&2
else
  rm -f "$plist"
fi
exit 1
