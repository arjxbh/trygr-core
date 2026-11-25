import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readSetting } from '../config/secrets';
import type { DeviceCacheService } from '../service/deviceCacheService';

export const eufyStateDir = join(homedir(), '.local/share/trygr/state/eufy');
interface Vacuum {
  key: string;
  name: string;
  battery: number | null;
  status: string;
  docked: boolean;
  mapUpdated: number | null;
  freshMap: boolean;
}
interface Snapshot {
  status: string;
  devices?: Vacuum[];
}

export class EufyWrapper {
  private pending?: Promise<string>;
  private retryAfter = 0;
  constructor(private cache: DeviceCacheService) {}
  refresh() {
    return (this.pending ??= this.fetch().finally(() => {
      this.pending = undefined;
    }));
  }
  private async fetch() {
    const username = readSetting('EUFY_USERNAME'),
      password = readSetting('EUFY_PASSWORD');
    if (!username || !password) return 'Credentials required';
    if (Date.now() < this.retryAfter) return 'Rate limited; retry later';
    const root = join(__dirname, '../..');
    const snapshot = await new Promise<Snapshot>((resolve, reject) => {
      const child = execFile(
        join(root, 'eufy-env/bin/python'),
        [join(root, 'scripts/eufy_x10.py'), eufyStateDir],
        { timeout: 90000, killSignal: 'SIGKILL' },
        (error, output) => {
          if (error) return reject(Error('Eufy reader unavailable'));
          try {
            resolve(JSON.parse(output));
          } catch {
            reject(Error('Invalid Eufy response'));
          }
        },
      );
      child.stdin?.on('error', () => reject(Error('Eufy reader unavailable')));
      child.stdin?.end(JSON.stringify({ username, password }));
    });
    if (snapshot.status === 'auth_failed') return 'Sign-in rejected';
    if (snapshot.status === 'rate_limited') {
      this.retryAfter = Date.now() + 15 * 60_000;
      return 'Rate limited; retry later';
    }
    if (snapshot.status !== 'ok' || !snapshot.devices)
      throw Error('Eufy unavailable');
    for (const vacuum of snapshot.devices) {
      if (!/^[a-f0-9]{64}$/.test(vacuum.key))
        throw Error('Invalid Eufy device ID');
      await this.cache.updateDevice({
        id: 'eufy:' + vacuum.key,
        name: vacuum.name,
        vendor: 'eufy',
        type: 'X10 Pro Omni',
        status: vacuum.status,
        batteryPercent: vacuum.battery ?? undefined,
        mapUpdated: vacuum.mapUpdated ?? undefined,
        onACPower: vacuum.docked,
        hasBrightness: false,
        hasVolume: false,
        onTime: 0,
        lastUpdated: Date.now(),
      });
    }
    if (!snapshot.devices.length) return 'No X10 Pro Omni found';
    return snapshot.devices.some((d) => d.freshMap)
      ? 'Status and map refreshed'
      : 'Status refreshed; no new map received';
  }
}
