import { device } from '../interfaces';

export class DeviceRepo {
    cache: any; // todo replace with redis instance

    constructor() {

    }

    async updateDevice(device: device) {
        // add or update device in redis
    }

    async addDevice(device: device) {
        return await this.updateDevice(device);
    }

    async getDeviceById(deviceId: device['id']) {

    }

    async getDeviceByName(name: device['name']) {
        
    }
}