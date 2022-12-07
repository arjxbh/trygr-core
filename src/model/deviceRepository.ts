import { device } from '../interfaces';
import Redis from 'ioredis';
import { logger } from '../service/loggingService';

// TODO: should this be move to a service?

// TODO: should devices expire after an hour? 30 minutes? less?

export class DeviceRepo {
  cache: Redis;

  constructor() {
    this.cache = new Redis();
  }

  async updateDevice(device: device) {
    const payload = JSON.stringify(device);
    logger.info(`Updating device ${device.id} with ${payload}`);
    return await this.cache.set(device.id, payload);
  }

  async addDevice(device: device) {
    return await this.updateDevice(device);
  }

  async getDeviceById(deviceId: device['id']) {
    logger.info(`getting device details for ${deviceId}`);
    const payload = await this.cache.get(deviceId);
    return JSON.parse(payload || '');
  }

  async getDeviceByName(name: device['name']) {
    // TODO: implement this
  }
}
