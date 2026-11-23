import Redis from 'ioredis';
import Logger from 'bunyan';
import { device } from '../interfaces';
import { getLogger } from './loggingService';

// TODO: should devices expire after an hour? 30 minutes? less?
export class DeviceCacheService {
  cache: Redis;
  logger: Logger;

  constructor() {
    this.logger = getLogger('Device Cache');
    this.cache = new Redis();
  }

  async updateDevice(device: device) {
    const payload = JSON.stringify(device);
    this.logger.info(`Updating device ${device.id} with ${payload}`);
    // TODO: do trigger here??
    return await this.cache.set(device.id, payload);
  }

  async addDevice(device: device) {
    return await this.updateDevice(device);
  }

  async getDeviceById(deviceId: device['id']) {
    this.logger.info(`getting device details for ${deviceId}`);
    const payload = await this.cache.get(deviceId);
    this.logger.debug(payload);
    return JSON.parse(payload || '');
  }

  async findKasaDevice(name: string): Promise<device | undefined> {
    let cursor = '0';
    const matches = new Map<string, device>();
    do {
      const [next, keys] = await this.cache.scan(cursor, 'COUNT', 100);
      cursor = next;
      if (!keys.length) continue;
      for (const payload of await this.cache.mget(keys)) {
        if (!payload) continue;
        let row;
        try {
          row = JSON.parse(payload);
        } catch {
          continue;
        }
        if (
          row?.vendor === 'kasa' &&
          row.name === name &&
          Date.now() - row.lastUpdated < 180000
        )
          matches.set(row.id, row);
      }
    } while (cursor !== '0');
    if (matches.size === 1) return [...matches.values()][0];
  }

  async closeConnection() {
    this.cache.disconnect();
  }
}
