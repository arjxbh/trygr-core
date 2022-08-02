import { RingApi, RingDevice } from 'ring-client-api';
import { device } from '../interfaces';

export class RingWrapper {
  api: RingApi;
  vendor: string;

  constructor (refreshToken: string) {
    this.vendor='ring';
    this.api = new RingApi({ refreshToken });
  }

  async #getLocations() {
    return await this.api.getLocations();
  }

  #formatDeviceResponse (device: RingDevice): device {
    const { deviceType, name, zid } = device;
    const { faulted, acStatus } = device.data;

    return {
      name,
      id: zid,
      status: faulted ? 'fault' : 'normal',
      onACPower: acStatus === 'ok' ? true : false,
      hasBrightness: false, // TODO: make better
      hasVolume: false, // TODO: make better
      vendor: this.vendor,
    }
  }

  async getDevices(): Promise<device[]> {
    return await this.getDevicesByLocationIndex(0);
  }

  getDevicesByLocationId(locationId: string) {

  }

  async getDevicesByLocationIndex(locationIndex: number): Promise<device[]> {
    const locations = await this.#getLocations();
    const devices = await locations[locationIndex].getDevices();
    return devices.map(d => this.#formatDeviceResponse(d));
  }
}