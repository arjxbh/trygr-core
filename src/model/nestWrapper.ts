import axios, { AxiosInstance } from 'axios';
import Logger from 'bunyan';
import { getLogger } from '../service/loggingService';
import { DeviceCacheService } from '../service/deviceCacheService';
import { device, ExternalDeviceCache, ExternalDeviceLookup } from '../interfaces';

const API_ENDPOINT = 'https://smartdevicemanagement.googleapis.com/v1';

interface NestDevice {
  name: string;
  type: string;
  traits: {
    [key: string]: unknown;
  };
  parentRelations?: Array<{
    parent: string;
  }>;
}

interface NestDeviceResponse {
  devices: NestDevice[];
}

interface NestSingleDeviceResponse {
  name: string;
  type: string;
  traits: {
    [key: string]: unknown;
  };
  parentRelations?: Array<{
    parent: string;
  }>;
}

interface ThermostatTraits {
  'sdm.devices.traits.Temperature'?: {
    ambientTemperatureCelsius: number;
  };
  'sdm.devices.traits.ThermostatMode'?: {
    mode: string;
    availableModes: string[];
  };
  'sdm.devices.traits.ThermostatTemperatureSetpoint'?: {
    heatCelsius?: number;
    coolCelsius?: number;
  };
  'sdm.devices.traits.Fan'?: {
    timerMode: string;
    timerTimeout?: string;
  };
  'sdm.devices.traits.Humidity'?: {
    ambientHumidityPercent: number;
  };
}

interface CameraTraits {
  'sdm.devices.traits.CameraLiveStream'?: {
    maxVideoResolution: {
      width: number;
      height: number;
    };
    videoCodecs: string[];
    audioCodecs: string[];
  };
  'sdm.devices.traits.MotionDetection'?: {
    motionEnabled: boolean;
  };
}

interface DoorbellTraits {
  'sdm.devices.traits.CameraLiveStream'?: {
    maxVideoResolution: {
      width: number;
      height: number;
    };
    videoCodecs: string[];
    audioCodecs: string[];
  };
  'sdm.devices.traits.MotionDetection'?: {
    motionEnabled: boolean;
  };
  'sdm.devices.traits.DoorbellChime'?: {
    maxVolume: number;
    currentVolume: number;
  };
}

export class NestWrapper {
  vendor: string;
  api: AxiosInstance;
  projectId: string;
  accessToken: string;
  cacheDevice: ExternalDeviceCache;
  lookupDevice: ExternalDeviceLookup;
  logger: Logger;
  devices: { [key: string]: device };

  constructor(
    projectId: string,
    accessToken: string,
    deviceCache: DeviceCacheService,
  ) {
    this.logger = getLogger('Nest');
    this.vendor = 'nest';
    this.projectId = projectId;
    this.accessToken = accessToken;
    this.devices = {};
    this.cacheDevice = (d) => deviceCache.updateDevice(d);
    this.lookupDevice = (d) => deviceCache.getDeviceById(d);

    this.api = axios.create({
      baseURL: API_ENDPOINT,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
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

  #formatDeviceResponse(nestDevice: NestDevice): device {
    const deviceId = nestDevice.name.split('/').pop() || '';
    const deviceType = nestDevice.type.split('.').pop() || 'unknown';
    const traits = nestDevice.traits;

    // Determine device status based on type and traits
    let status = 'unknown';
    let hasBrightness = false;
    let brightness: number | undefined;
    let hasVolume = false;
    let volume: number | undefined;
    const onACPower = true; // Nest devices are typically always on AC power

    // Handle thermostat devices
    if (nestDevice.type.includes('Thermostat')) {
      const thermostatTraits = traits as ThermostatTraits;
      const mode = thermostatTraits['sdm.devices.traits.ThermostatMode']?.mode;
      status = mode || 'unknown';

      // Check if there's a temperature setpoint
      const setpoint = thermostatTraits['sdm.devices.traits.ThermostatTemperatureSetpoint'];
      if (setpoint?.heatCelsius) {
        brightness = Math.round(setpoint.heatCelsius);
      } else if (setpoint?.coolCelsius) {
        brightness = Math.round(setpoint.coolCelsius);
      }
      hasBrightness = brightness !== undefined;
    }
    // Handle camera devices
    else if (nestDevice.type.includes('Camera')) {
      const cameraTraits = traits as CameraTraits;
      const motionEnabled = cameraTraits['sdm.devices.traits.MotionDetection']?.motionEnabled;
      status = motionEnabled ? 'motion' : 'idle';
    }
    // Handle doorbell devices
    else if (nestDevice.type.includes('Doorbell')) {
      const doorbellTraits = traits as DoorbellTraits;
      const motionEnabled = doorbellTraits['sdm.devices.traits.MotionDetection']?.motionEnabled;
      status = motionEnabled ? 'motion' : 'idle';
      
      // Doorbells have volume control
      const chime = doorbellTraits['sdm.devices.traits.DoorbellChime'];
      if (chime) {
        hasVolume = true;
        volume = chime.currentVolume;
      }
    }
    // Handle other device types (smoke/CO alarms, etc.)
    else {
      // Try to find a status trait
      if (traits['sdm.devices.traits.Connectivity']) {
        status = 'connected';
      } else {
        status = 'normal';
      }
    }

    return {
      id: deviceId,
      name: this.#extractDeviceName(nestDevice),
      type: deviceType,
      status,
      onACPower,
      hasBrightness,
      brightness,
      hasVolume,
      volume,
      vendor: this.vendor,
      onTime: 0, // Nest API doesn't provide on-time information
      lastUpdated: Date.now(),
    };
  }

  #extractDeviceName(nestDevice: NestDevice): string {
    // Try to get name from traits, otherwise use device ID
    const info = nestDevice.traits['sdm.devices.traits.Info'] as { customName?: string } | undefined;
    if (info?.customName) {
      return info.customName;
    }
    // Fallback to device ID
    return nestDevice.name.split('/').pop() || 'Unknown Nest Device';
  }

  async getDevices(): Promise<device[]> {
    try {
      const response = await this.api.get<NestDeviceResponse>(
        `/enterprises/${this.projectId}/devices`,
      );
      return response.data.devices.map((d) => this.#formatDeviceResponse(d));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = (error as { response?: { data?: unknown } })?.response?.data;
      this.logger.error('Error fetching Nest devices:', errorResponse || errorMessage);
      throw error;
    }
  }

  async getDeviceById(deviceId: string): Promise<device> {
    try {
      const response = await this.api.get<NestSingleDeviceResponse>(
        `/enterprises/${this.projectId}/devices/${deviceId}`,
      );
      return this.#formatDeviceResponse(response.data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = (error as { response?: { data?: unknown } })?.response?.data;
      this.logger.error(`Error fetching Nest device ${deviceId}:`, errorResponse || errorMessage);
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
      case 'setTemperature':
        if (device.type === 'Thermostat') {
          const temperature = typeof actionValue === 'number' ? actionValue : parseFloat(actionValue);
          await this.#setThermostatTemperature(id, temperature);
          resultText = `${device.name} | ${device.id} set temperature to ${temperature}°C`;
          noOp = false;
        } else {
          resultText = `${device.name} is not a thermostat, cannot set temperature`;
        }
        break;

      case 'setMode':
        if (device.type === 'Thermostat') {
          const mode = typeof actionValue === 'string' ? actionValue : String(actionValue);
          await this.#setThermostatMode(id, mode);
          resultText = `${device.name} | ${device.id} set mode to ${mode}`;
          noOp = false;
        } else {
          resultText = `${device.name} is not a thermostat, cannot set mode`;
        }
        break;

      case 'setVolume':
        if (device.hasVolume) {
          const volume = typeof actionValue === 'number' ? actionValue : parseInt(String(actionValue), 10);
          await this.#setDeviceVolume(id, volume);
          resultText = `${device.name} | ${device.id} set volume to ${volume}`;
          noOp = false;
        } else {
          resultText = `${device.name} does not support volume control`;
        }
        break;

      case 'turnOn':
        // For thermostats, this might mean setting to a specific mode
        if (device.type === 'Thermostat') {
          await this.#setThermostatMode(id, 'HEAT');
          resultText = `${device.name} | ${device.id} turned on (set to HEAT mode)`;
          noOp = false;
        } else {
          resultText = `${device.name} | ${device.id} turn on - not applicable for this device type`;
        }
        break;

      case 'turnOff':
        // For thermostats, this might mean setting to OFF mode
        if (device.type === 'Thermostat') {
          await this.#setThermostatMode(id, 'OFF');
          resultText = `${device.name} | ${device.id} turned off (set to OFF mode)`;
          noOp = false;
        } else {
          resultText = `${device.name} | ${device.id} turn off - not applicable for this device type`;
        }
        break;

      default:
        resultText = `Unknown action: ${action} for device ${device.name}`;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data;
      this.logger.error(`Error performing action ${action}:`, errorResponse || errorMessage);
      resultText = `Error performing action ${action}: ${errorResponse?.error?.message || errorMessage}`;
      noOp = true;
    }

    return { resultText, noOp };
  }

  async #setThermostatTemperature(deviceId: string, temperature: number): Promise<void> {
    // For simplicity, set heat temperature
    // In a real implementation, you might want to check the current mode
    // and set heat or cool accordingly
    await this.api.post(
      `/enterprises/${this.projectId}/devices/${deviceId}:executeCommand`,
      {
        command: 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat',
        params: {
          heatCelsius: temperature,
        },
      },
    );
  }

  async #setThermostatMode(deviceId: string, mode: string): Promise<void> {
    await this.api.post(
      `/enterprises/${this.projectId}/devices/${deviceId}:executeCommand`,
      {
        command: 'sdm.devices.commands.ThermostatMode.SetMode',
        params: {
          mode: mode.toUpperCase(),
        },
      },
    );
  }

  async #setDeviceVolume(deviceId: string, volume: number): Promise<void> {
    // This is for doorbell chime volume
    await this.api.post(
      `/enterprises/${this.projectId}/devices/${deviceId}:executeCommand`,
      {
        command: 'sdm.devices.commands.DoorbellChime.SetVolume',
        params: {
          volume: Math.max(0, Math.min(100, volume)), // Clamp between 0-100
        },
      },
    );
  }
}
