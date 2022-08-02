import { RingApi, RingDevice, Location } from 'ring-client-api';
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
      type: deviceType,
      status: faulted ? 'fault' : 'normal',
      onACPower: acStatus === 'ok' ? true : false,
      hasBrightness: false, // TODO: make better
      hasVolume: false, // TODO: make better
      vendor: this.vendor,
    }
  }

  async getDevices(): Promise<device[]> {
    const locations = await this.#getLocations();
    return await this.getDevicesByLocationIndex(0, locations);
  }

  async getDevicesByLocationId(locationId: string): Promise<device[]> {
    const locations = await this.#getLocations();
    return await this.getDevicesByLocationIndex(0, locations.filter(l => l.locationId === locationId));
  }

  async getDevicesByLocationIndex(locationIndex: number, locations: Location[]): Promise<device[]> {
    const devices = await locations[locationIndex].getDevices();
    return devices.map(d => this.#formatDeviceResponse(d));
  }
}