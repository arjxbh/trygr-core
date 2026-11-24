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

Start with the [application entry point](src/app.ts) and the [shared device record](src/interfaces/index.ts). An adapter maps vendor updates into that record and publishes them through the device cache. If it supports actions, register it with the [trigger service](src/service/triggerService.ts) alongside Kasa. Adapters that need credentials can use the [settings store](src/config/secrets.ts) with vendor-specific names and persist rotated tokens from the vendor SDK. The Nest wrapper is available for further integration. The Go directory contains a partial implementation separate from the deployed TypeScript bridge.


Kasa discovery checks each IPv4 broadcast network, caches plugs and bulbs on first sight, and tracks each outlet on a power strip separately. The Mac installer also installs python-kasa in a private virtual environment for devices using TP-Link's authenticated protocol. Set `KASA_USERNAME` and `KASA_PASSWORD` using the release's `scripts/set-secret.sh` to resolve their names and control them.

The nighttime motion rule calculates sunlight locally from the doorbell location. You can also supply `LATITUDE` and `LONGITUDE` through the settings helper. `GET /solar` reports the solar window and current nighttime status.

### Matter outlets on the Mac mini

Trygr can commission a Wi-Fi Matter outlet that is already on a reachable LAN. It discovers devices on the Mac's multicast-capable interfaces, saves its controller identity under the private state directory, and addresses each switch by its Matter node and endpoint ID. Preserve the private `~/.local/share/trygr/state/matter-state/fabric` directory when migrating the controller.

For a Kasa EP40M, obtain the manual setup code in Kasa under device settings → Device Info → Matter Setup Code. If the outlet already belongs to another Matter controller, open its sharing or pairing window there and use the newly generated code. [TP-Link setup instructions](https://www.tp-link.com/us/support/faq/4411/)

From a terminal on the Mac mini, run:

```sh
bash ~/.local/share/trygr/matter.sh pair
bash ~/.local/share/trygr/matter.sh list
```

Pairing prompts privately for the code. The list shows the connected nodes, each switchable endpoint ID, and its current on/off state. To identify the walkway socket, change only Walkway Lights in Kasa and compare the lists before and after. Once confirmed, substitute its exact ID below:

```sh
bash ~/.local/share/trygr/matter.sh walkway 'matter:NODE:ENDPOINT'
```

This updates the existing Front Door motion rule in place. The next nighttime motion turns on that endpoint and restarts its 15-minute timer. The same endpoint IDs can be used as `affectedDeviceId` in other on/off triggers.

### EcoFlow battery monitoring

Trygr reads the account's power stations through the signed EcoFlow HTTPS API. The station needs Wi-Fi and internet access. On the Mac, use the active release's `scripts/set-secret.sh` to save `ECOFLOW_ACCESS_KEY` and `ECOFLOW_SECRET_KEY` from the [EcoFlow developer portal](https://developer.ecoflow.com/). For keys issued by the European portal, also set `ECOFLOW_REGION` to `eu`.

Query `GET /ecoflow` on the local API to see station names, models, online status, and available battery, solar/DC input and AC output readings. Requests share a 30-second cache. Missing measurements appear as null, and each input is reported separately when available. Output watts represent the entire AC circuit. This integration monitors the battery and does not switch its outputs.

### BRmesh outdoor lights

Trygr supports individual on/off commands through the local [BRMesh Hub v1 REST API](https://github.com/logichousepcb/brmesh-hub/blob/main/docs/API.md). This requires a compatible hub within Bluetooth range of the lights and reachable from the Mac. The BRmesh phone app alone does not provide this endpoint. Binding lights with a different mesh key can affect control from the phone. Follow the [hub setup instructions](https://github.com/logichousepcb/brmesh-hub) for an existing mesh before binding.

On the Mac mini, set the hub's hostname or IPv4 address with `bash ~/.local/share/trygr/set-secret.sh BRMESH_HUB_HOST`. If the hub has an admin password, save it with the same helper as `BRMESH_HUB_PASSWORD`. The firmware uses HTTP Basic authentication over plain HTTP, so use a trusted LAN.

Run `curl -sS http://127.0.0.1:3333/brmesh` on the Mac. Use a light's returned `brmesh:<id>` as the `affectedDeviceId` of a trigger with action `turnOn` or `turnOff`. The reported state is the last state the hub requested. A physical light does not acknowledge the command.

### Device dashboard

Open the Mac mini's hostname on port 3334 from the home LAN. The dashboard shows cached devices, last known states, observation times and saved Trygrs. Refresh cache requests fresh Kasa and Ring observations. Older entries stay visible with their original timestamps when devices cannot be reached. Integrations that keep separate inventories appear only if they publish to the device cache.

The dashboard listens on all IPv4 interfaces by default. Anyone with network access to this port can see the inventory and rules and request a refresh. Set `TRYGR_DASHBOARD_HOST` or `TRYGR_DASHBOARD_PORT` in the service environment to change the listener. The administrative API continues to use its separate listener.
