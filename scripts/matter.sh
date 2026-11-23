#!/usr/bin/env bash
set -eu
socket="$HOME/.local/share/trygr/state/matter-state/admin.sock"
case ${1:-list} in
  list) curl -fsS --unix-socket "$socket" http://localhost/list ;;
  pair)
    IFS= read -rs -p 'Matter manual setup code (hidden): ' code </dev/tty
    printf '\n' >/dev/tty
    printf '%s' "$code" | curl --fail-with-body -sS --unix-socket "$socket" --data-binary @- http://localhost/pair ;;
  walkway) curl --fail-with-body -sS --unix-socket "$socket" --data-binary "${2:?Supply the confirmed Walkway Lights endpoint ID}" http://localhost/walkway ;;
  *) echo 'Usage: matter.sh list | pair | walkway ENDPOINT' >&2; exit 2 ;;
esac
