# Trygr

Trygr is a local bridge for home automation systems. A trigger connects a condition to a device action, so the device providing the input and the device taking action can belong to different systems. The bridge currently discovers and controls compatible TP-Link Kasa plugs and subscribes to Ring alarm device state. Outdoor temperature thresholds work today. Device correlation, time schedules, and sensor-driven rules are planned.

## How the bridge works

- **Kasa** discovers plugs on the LAN and caches their IDs, addresses, and reported state in Redis. The adapter supports `turnOn` and `turnOff`. Discovery restarts with the bridge and uses no cloud login.
- **Ring** uses a refresh token to subscribe to device updates across the account's locations. It maps alarm state into the shared device cache. Each token rotation replaces the saved credential so the next process can resume the session.
- **Rules** live in `triggerDb.json` in the working directory. With a postal code and Zipcodebase API key configured, Trygr looks up coordinates and polls Open-Meteo once a minute. A `maxTemp` rule matches at or above its Fahrenheit threshold and a `minTemp` rule matches at or below it. The trigger service looks up the target in Redis and dispatches the action to its vendor adapter.

For example, submit the following JSON to `POST /trigger/create` to turn on a fan at 80°F. Replace `YOURPLUGID` with its discovered ID. Use `GET /triggers` to list the saved rules. The API defaults to `127.0.0.1:3333`.

```json
{
  "affectedDeviceId": "YOURPLUGID",
  "triggerType": "maxTemp",
  "triggerValue": 80,
  "action": "turnOn"
}
```

## Build and check

Use Node.js 24. From the checkout, run `npm ci` and `npm run check`. The check runs ESLint, Prettier, the TypeScript build, and isolated tests. Use `npm run format` to apply formatting. Shell scripts are syntax-checked with Bash. For changes under `go/`, run `npm run check:go` with the Go toolchain installed to check gofmt, vet, and tests. For local development, start Redis on loopback port 6379, then run `npm run build && npm start`. Local development and the deployed process each need their own Ring session if both run concurrently.

## Deploy to the Mac mini

1. On `bridge.local`, enable Remote Login for the deployment account and sign that account into the macOS desktop. Trygr runs as a per-user LaunchAgent. It starts at login and launchd restarts it after a crash. Install Node 24 (for Homebrew, `brew install node@24`) and run Redis as a local service. Verify `redis-cli ping` returns `PONG`. [Homebrew Node 24](https://formulae.brew.sh/formula/node@24) · [Redis macOS setup](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/install-redis-on-mac-os/)
2. From the checkout, run `npm ci` and `npm run deploy:mac -- user@bridge.local`. To choose the SSH user, run `npm run deploy:mac -- user@bridge.local`. The command checks the project, sends the build and lockfile over SSH, and installs production dependencies in a fresh release directory on the Mac.
3. The installer switches the LaunchAgent to the new release and checks that the responding process is the one launchd started and that it can reach Redis. If activation fails, it attempts to restore the prior LaunchAgent. The health endpoint checks the process and Redis. Verify Ring and Kasa connectivity separately from the device updates in the bridge log.

Repeat the same deploy command for updates. Releases live under `~/.local/share/trygr/releases/`. The agent uses `~/.local/share/trygr/state/` as its working directory, so rules survive updates. To migrate an existing rule database, copy its `triggerDb.json` into that directory with the bridge stopped. Logs live in `~/.local/share/trygr/logs/`. Old releases and logs are retained.

## Set up Ring and other credentials

After the first deploy, SSH into the Mac as the deployment user. Change into the release directory printed by the installer. For a Homebrew Node install, run `export PATH="$(brew --prefix node@24)/bin:$PATH"` in that shell.

1. Stop the agent before enrolling or replacing a Ring session. Run `launchctl bootout "gui/$(id -u)/local.trygr.bridge"`.
2. Run `./node_modules/.bin/ring-auth-cli` in a private terminal and complete Ring's login and two-factor challenge. Run `bash scripts/set-secret.sh RING_REFRESH_TOKEN` and paste the generated token at the hidden prompt. The CLI displays the initial token in that terminal. [Ring token documentation](https://github.com/dgreif/ring/wiki/Refresh-Tokens)
3. For weather rules, repeat the setter with `ZIPCODEBASE_API_KEY` and `ZIP_CODE`. Set `COUNTRY_CODE` if outside the US. Optional mail settings use `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, and `SMTP_PASSWORD`.
4. Start the agent with `launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/local.trygr.bridge.plist"`. Check `curl -fsS http://127.0.0.1:3333/health` and `tail -n 50 ~/.local/share/trygr/logs/{bridge,error}.log`. For API access from your workstation, use `ssh -N -L 3333:127.0.0.1:3333 bridge.local`.

Settings live in owner-only files (0600) under `~/.config/trygr/secrets/` (0700), outside the release and Git checkout. The account can read the values as plaintext. FileVault protects the volume at rest when enabled. The bridge atomically replaces the Ring token file on rotation. A revoked session requires a fresh login. During development, stored settings take precedence over uppercase or legacy lowercase environment variables. Use `TRYGR_SECRET_DIR` to select a separate settings directory.

## Adding another device type

Start with the [application entry point](src/app.ts) and the [shared device record](src/interfaces/index.ts). An adapter maps vendor updates into that record and publishes them through the device cache. If it supports actions, register it with the [trigger service](src/service/triggerService.ts) alongside Kasa. Adapters that need credentials can use the [settings store](src/config/secrets.ts) with vendor-specific names and persist rotated tokens from the vendor SDK. The Nest and EcoFlow wrappers are available for further integration. The Go directory contains a partial implementation separate from the deployed TypeScript bridge.


Kasa discovery checks each IPv4 broadcast network, caches plugs and bulbs on first sight, and tracks each outlet on a power strip separately. The Mac installer also installs python-kasa in a private virtual environment for devices using TP-Link's authenticated protocol. Set `KASA_USERNAME` and `KASA_PASSWORD` using the release's `scripts/set-secret.sh` to resolve their names and control them.

The nighttime motion rule calculates sunlight locally from the doorbell location. You can also supply `LATITUDE` and `LONGITUDE` through the settings helper. `GET /solar` reports the solar window and current nighttime status.
