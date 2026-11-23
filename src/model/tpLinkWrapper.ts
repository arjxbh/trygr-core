import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readSetting } from '../config/secrets';
import { networkInterfaces } from 'node:os';
import { Bulb, Client, Device, Plug } from 'tplink-smarthome-api';
import { isPlugSysinfo, isBulbSysinfo } from 'tplink-smarthome-api/lib/device';
import type { device } from '../interfaces';
import { DeviceCacheService } from '../service/deviceCacheService';

function broadcastTargets() {
  const hosts = new Set<string>();
  for (const addresses of Object.values(networkInterfaces())) {
    for (const nic of addresses ?? []) {
      if (nic.internal || nic.family !== 'IPv4' || !nic.cidr) continue;
      if (Number(nic.cidr.split('/')[1]) >= 31) continue;
      const mask = nic.netmask.split('.').map(Number);
      hosts.add(
        nic.address
          .split('.')
          .map((octet, i) => Number(octet) | (255 ^ mask[i]))
          .join('.'),
      );
    }
  }
  return Array.from(hosts, (host) => ({ host }));
}

export class KasaWrapper {
  readonly vendor = 'kasa';
  private readonly api = new Client();
  private python =
    process.env.TRYGR_KASA_PYTHON ||
    join(homedir(), '.local/share/trygr/kasa-env/bin/python');
  private async modern(args: string[]) {
    const { stdout } = await promisify(execFile)(
      this.python,
      [join(__dirname, '../../scripts/kasa_modern.py'), ...args],
      {
        env: {
          ...process.env,
          KASA_USERNAME: readSetting('KASA_USERNAME'),
          KASA_PASSWORD: readSetting('KASA_PASSWORD'),
        },
        timeout: 90000,
      },
    );
    return JSON.parse(stdout);
  }
  private async refreshModern() {
    try {
      const result = await this.modern([
        'scan',
        ...broadcastTargets().map((x) => x.host),
      ]);
      for (const row of result.records)
        await this.cache.updateDevice({
          ...row,
          vendor: this.vendor,
          protocol: 'smart',
          lastUpdated: Date.now(),
          hasBrightness: false,
          hasVolume: false,
          onACPower: true,
          onTime: 0,
        });
      if (result.locked)
        console.warn(
          'Kasa devices requiring account credentials:',
          result.locked,
        );
    } catch {
      console.error('Modern Kasa discovery failed');
    } finally {
      setTimeout(() => void this.refreshModern(), 60000);
    }
  }
  constructor(private readonly cache: DeviceCacheService) {
    if (existsSync(this.python)) void this.refreshModern();
    const record = (unit: Device) => {
      if (unit instanceof Plug || unit instanceof Bulb) {
        void cache
          .updateDevice(this.describe(unit))
          .catch(() => console.error('Kasa cache update failed'));
      }
    };
    this.api.on('device-new', record).on('device-online', record);
    this.api.startDiscovery({
      devices: broadcastTargets(),
      filterCallback: (s) => isPlugSysinfo(s) || isBulbSysinfo(s),
      breakoutChildren: true,
    });
  }
  private describe(unit: Plug | Bulb): device {
    const bulb = unit instanceof Bulb;
    const powered = bulb
      ? unit.sysInfo.light_state.on_off === 1
      : unit.relayState;
    const brightness = bulb
      ? unit.sysInfo.light_state.brightness
      : unit.sysInfo.brightness;
    return {
      id: unit.id,
      name: unit.alias,
      ip: unit.host,
      port: unit.port,
      vendor: this.vendor,
      type: unit.model,
      status: powered ? 'on' : 'off',
      hasBrightness: typeof brightness === 'number',
      brightness,
      hasVolume: false,
      onACPower: true,
      onTime: 0,
      lastUpdated: Date.now(),
    };
  }
  async performDeviceAction(target: device, action: string) {
    if (target.protocol === 'smart' && target.ip) {
      const { noOp } = await this.modern([
        'action',
        target.ip,
        target.id,
        action,
      ]);
      await this.cache.updateDevice({
        ...target,
        status: action === 'turnOn' ? 'on' : 'off',
        lastUpdated: Date.now(),
      });
      return { noOp, resultText: target.name + ' ' + action };
    }
    const unit = this.api.devices.get(target.id);
    if (
      !(unit instanceof Bulb || unit instanceof Plug) ||
      unit.status === 'offline'
    )
      throw new Error('Kasa device unavailable');
    if (action !== 'turnOn' && action !== 'turnOff')
      throw new Error('Unsupported Kasa action');
    const desired = action === 'turnOn';
    const noOp = (await unit.getPowerState()) === desired;
    if (!noOp) await unit.setPowerState(desired);
    await this.cache.updateDevice({
      ...this.describe(unit),
      status: desired ? 'on' : 'off',
    });
    return { resultText: unit.alias + ' ' + action, noOp };
  }
}
