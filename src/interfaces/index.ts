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
  onACPower: boolean;
  name: string;
  hasBrightness: boolean;
  hasVolume: boolean;
  brightness?: number;
  volume?: number;
  vendor: string;
  type: string;
}