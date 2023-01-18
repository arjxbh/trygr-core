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

  async getDeviceByName(name: device['name']) {
    // TODO: implement this
  }
}
