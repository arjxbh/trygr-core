import { RingApi, RingDeviceData } from 'ring-client-api';

// TODO: find a way to do this directly from the exported types
interface RingDeviceResponse {
  initialData: RingDeviceData;
}

export class RingWrapper {
  api: RingApi;

  constructor (refreshToken: string) {
    this.api = new RingApi({ refreshToken });
  }

  async #getLocations() {
    return await this.api.getLocations();
  }

  #formatDeviceResponse (device: RingDeviceResponse) {
    const { deviceType, faulted, name, zid } = device.initialData.siren;

    return { deviceType, faulted, name, zid }; // TODO: make a standard device interface
  }

  // assume location 0
  getDevices() {

  }

  getDevicesByLocationId(locationId: string) {

  }

  async getDevicesByLocationIndex(locationIndex: number) {
    const locations = await this.#getLocations();


  }
}