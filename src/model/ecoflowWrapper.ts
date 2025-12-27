import axios, { AxiosInstance } from 'axios';
import Logger from 'bunyan';
import { getLogger } from '../service/loggingService';
import { DeviceCacheService } from '../service/deviceCacheService';
import { device, ExternalDeviceCache, ExternalDeviceLookup } from '../interfaces';

/**
 * EcoFlow Wrapper
 * 
 * This wrapper integrates EcoFlow smart battery devices into the middleware system.
 * It allows monitoring battery status and controlling AC output to power connected devices.
 * 
 * IMPORTANT: The API endpoints and authentication method in this wrapper are based on
 * common API patterns. You may need to adjust the following based on actual EcoFlow API documentation:
 * - API_ENDPOINT: The base URL for EcoFlow API
 * - Authentication method: May use headers, query params, or request signing
 * - Endpoint paths: /device/list, /device/{id}/info, /device/{id}/control
 * - Request/response formats: The data structures may differ
 * 
 * To use this wrapper:
 * 1. Obtain access_key and secret_key from EcoFlow Developer Portal
 * 2. Initialize: const ecoflow = new EcoFlowWrapper(accessKey, secretKey, deviceCache);
 * 3. Add to TriggerService: new TriggerService(deviceCache, [kasa, ecoflow]);
 * 
 * Supported actions:
 * - turnOn: Enables AC output
 * - turnOff: Disables AC output
 */

// EcoFlow API base URL - adjust based on actual API documentation
const API_ENDPOINT = 'https://api.ecoflow.com';

interface EcoFlowDeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  serialNumber: string;
  firmwareVersion?: string;
  batteryLevel?: number;
  acOutputEnabled?: boolean;
  acOutputPower?: number;
  solarInputPower?: number;
  chargingStatus?: string;
}

interface EcoFlowDeviceResponse {
  code: number;
  message: string;
  data: {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    serialNumber: string;
    firmwareVersion?: string;
    params: {
      batteryLevel?: number;
      acOutputEnabled?: boolean;
      acOutputPower?: number;
      solarInputPower?: number;
      chargingStatus?: string;
      [key: string]: unknown;
    };
  };
}

interface EcoFlowDeviceListResponse {
  code: number;
  message: string;
  data: {
    devices: Array<{
      deviceId: string;
      deviceName: string;
      deviceType: string;
      serialNumber: string;
    }>;
  };
}

export class EcoFlowWrapper {
  vendor: string;
  api: AxiosInstance;
  accessKey: string;
  secretKey: string;
  cacheDevice: ExternalDeviceCache;
  lookupDevice: ExternalDeviceLookup;
  logger: Logger;
  devices: { [key: string]: device };

  constructor(
    accessKey: string,
    secretKey: string,
    deviceCache: DeviceCacheService,
  ) {
    this.logger = getLogger('EcoFlow');
    this.vendor = 'ecoflow';
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.devices = {};
    this.cacheDevice = (d) => deviceCache.updateDevice(d);
    this.lookupDevice = (d) => deviceCache.getDeviceById(d);

    this.api = axios.create({
      baseURL: API_ENDPOINT,
      headers: {
        'Content-Type': 'application/json',
        // TODO: Adjust authentication method based on actual EcoFlow API documentation
        // Options may include:
        // - Headers: 'X-Access-Key', 'X-Secret-Key', or 'Authorization: Bearer <token>'
        // - Query params: accessKey, secretKey (currently used below)
        // - Request signing: May require HMAC or other signing mechanism
      },
      // Using query params for authentication - adjust if API requires headers or signing
      params: {
        accessKey: this.accessKey,
        secretKey: this.secretKey,
      },
    });

    // Poll for device updates periodically
    this.#startPolling();
  }

  #startPolling() {
    // Poll every 30 seconds for device updates
    setInterval(async () => {
      try {
        const devices = await this.getDevices();
        devices.forEach((device) => {
          this.#updateDeviceState(device);
        });
      } catch (error) {
        this.logger.error('Error polling devices:', error);
      }
    }, 30000);

    // Initial fetch
    this.getDevices()
      .then((devices) => {
        devices.forEach((device) => {
          this.#updateDeviceState(device);
        });
      })
      .catch((error) => {
        this.logger.error('Error fetching initial devices:', error);
      });
  }

  #updateDeviceState(device: device) {
    this.logger.info(`updating device: ${device.name}`);
    this.devices[device.id] = device;
    this.logger.debug(`tracking ${Object.keys(this.devices).length} devices`);
    this.cacheDevice(device);
  }

  #formatDeviceResponse(ecoflowDevice: EcoFlowDeviceInfo): device {
    const { deviceId, deviceName, deviceType, batteryLevel, acOutputEnabled } =
      ecoflowDevice;

    // Map AC output status to device status
    let status = 'unknown';
    if (acOutputEnabled !== undefined) {
      status = acOutputEnabled ? 'on' : 'off';
    }

    // Use battery level as brightness if available (for display purposes)
    const hasBrightness = batteryLevel !== undefined;
    const brightness = batteryLevel;

    return {
      id: deviceId,
      name: deviceName || `EcoFlow ${deviceType}`,
      type: deviceType || 'battery',
      status,
      onACPower: false, // Battery device, not on AC power
      hasBrightness,
      brightness,
      hasVolume: false,
      vendor: this.vendor,
      onTime: 0, // EcoFlow API may not provide on-time information
      lastUpdated: Date.now(),
    };
  }

  async getDevices(): Promise<device[]> {
    try {
      // Note: Adjust endpoint based on actual EcoFlow API documentation
      const response = await this.api.get<EcoFlowDeviceListResponse>(
        '/device/list',
      );

      if (response.data.code !== 0) {
        throw new Error(
          `EcoFlow API error: ${response.data.message || 'Unknown error'}`,
        );
      }

      // Fetch detailed info for each device
      const devicePromises = response.data.data.devices.map((device) =>
        this.getDeviceById(device.deviceId),
      );

      return Promise.all(devicePromises);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = (error as { response?: { data?: unknown } })
        ?.response?.data;
      this.logger.error(
        'Error fetching EcoFlow devices:',
        errorResponse || errorMessage,
      );
      throw error;
    }
  }

  async getDeviceById(deviceId: string): Promise<device> {
    try {
      // Note: Adjust endpoint based on actual EcoFlow API documentation
      const response = await this.api.get<EcoFlowDeviceResponse>(
        `/device/${deviceId}/info`,
      );

      if (response.data.code !== 0) {
        throw new Error(
          `EcoFlow API error: ${response.data.message || 'Unknown error'}`,
        );
      }

      const deviceData = response.data.data;
      const deviceInfo: EcoFlowDeviceInfo = {
        deviceId: deviceData.deviceId,
        deviceName: deviceData.deviceName,
        deviceType: deviceData.deviceType,
        serialNumber: deviceData.serialNumber,
        firmwareVersion: deviceData.firmwareVersion,
        batteryLevel: deviceData.params.batteryLevel,
        acOutputEnabled: deviceData.params.acOutputEnabled,
        acOutputPower: deviceData.params.acOutputPower,
        solarInputPower: deviceData.params.solarInputPower,
        chargingStatus: deviceData.params.chargingStatus as string | undefined,
      };

      return this.#formatDeviceResponse(deviceInfo);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = (error as { response?: { data?: unknown } })
        ?.response?.data;
      this.logger.error(
        `Error fetching EcoFlow device ${deviceId}:`,
        errorResponse || errorMessage,
      );
      throw error;
    }
  }

  async performDeviceAction(
    device: device,
    action: string,
    actionValue: string | number,
  ): Promise<{ resultText: string; noOp: boolean }> {
    this.logger.info(`requested action ${action} for device ${device.name}`);
    this.logger.info(device);

    const { id } = await this.lookupDevice(device.id);
    let resultText = `error: unexpected action ${action} for device ${device.name}: noOp`;
    let noOp = true;

    try {
      switch (action) {
        case 'turnOn':
          if (device.status !== 'on') {
            await this.#setACOutput(id, true);
            resultText = `${device.name} | ${device.id} turn on AC output`;
            noOp = false;
          } else {
            resultText = `${device.name} | ${device.id} turn on request noOp (already on)`;
          }
          break;

        case 'turnOff':
          if (device.status !== 'off') {
            await this.#setACOutput(id, false);
            resultText = `${device.name} | ${device.id} turn off AC output`;
            noOp = false;
          } else {
            resultText = `${device.name} | ${device.id} turn off request noOp (already off)`;
          }
          break;

        default:
          resultText = `Unknown action: ${action} for device ${device.name}`;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = (error as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data;
      this.logger.error(`Error performing action ${action}:`, errorResponse || errorMessage);
      resultText = `Error performing action ${action}: ${errorResponse?.error?.message || errorMessage}`;
      noOp = true;
    }

    return { resultText, noOp };
  }

  async #setACOutput(deviceId: string, enabled: boolean): Promise<void> {
    // Note: Adjust endpoint and payload based on actual EcoFlow API documentation
    await this.api.post(`/device/${deviceId}/control`, {
      command: 'acOutput',
      value: enabled,
    });
  }
}

