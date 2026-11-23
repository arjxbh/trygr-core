#!/usr/bin/env bash
set -euo pipefail
umask 077
name=${1:?Supply a setting name such as RING_REFRESH_TOKEN}
[[ $name =~ ^[A-Z][A-Z0-9_]*$ ]] || exit 2
dir=${TRYGR_SECRET_DIR:-"$HOME/.config/trygr/secrets"}
mkdir -p "$dir"
[[ ! -L $dir && -O $dir ]] || exit 1
chmod 700 "$dir"
temp=$(mktemp "$dir/.$name.XXXXXXXX")
tty_state=$(stty -g </dev/tty)
cleanup() {
  stty "$tty_state" </dev/tty
  rm -f "$temp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
# Canonical terminal input can truncate long tokens pasted over SSH.
stty -echo -icanon min 1 time 0 </dev/tty
printf 'Paste %s and press Enter (input is hidden): ' "$name" >/dev/tty
IFS= read -r value </dev/tty
stty "$tty_state" </dev/tty
printf '\n' >/dev/tty
if [[ -z $value ]]; then
  echo "Empty input. $name was not saved." >&2
  exit 2
fi
printf '%s' "$value" > "$temp"
mv -f "$temp" "$dir/$name"
printf 'Saved %s.\n' "$name"
