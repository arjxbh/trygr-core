export interface action {
  targetId: string;
  startTime: string;
  endTime: string;
  doAction: () => void;
}

export interface trigger {
  startCondition: () => boolean;
  targetId: string;
  action: action[];
}

export interface device {
  id: string;
  status: string;
  protocol?: 'smart';
  onACPower: boolean;
  name: string;
  hasBrightness: boolean;
  hasVolume: boolean;
  batteryPercent?: number;
  mapUpdated?: number;
  brightness?: number;
  volume?: number;
  vendor: string;
  type: string;
  onTime: number;
  lastUpdated: number;
  ip?: string; // TODO: should this be more generic and just networkAddress or address?
  port?: number;
}

export interface ExternalDeviceCache {
  (device: device): Promise<unknown>;
}

export interface ExternalDeviceLookup {
  (deviceId: string): Promise<device>;
}
