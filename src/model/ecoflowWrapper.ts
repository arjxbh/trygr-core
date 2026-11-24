import { createHmac, randomInt } from 'node:crypto';
import axios from 'axios';
import { readSetting } from '../config/secrets';

interface Station {
  sn: string;
  deviceName?: string;
  productName?: string;
  online: number;
}

type Quotas = Record<string, unknown>;

export function batteryReadings(quotas: Quotas) {
  function first(...keys: string[]) {
    for (const key of keys) {
      const value = quotas[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return null;
  }
  return {
    batteryPercent: first('pd.soc', 'bmsMaster.soc', 'bmsBattSoc'),
    solarDcInputWatts: first('mppt.inWatts', 'powGetPv'),
    secondSolarDcInputWatts: first('mppt.pv2InWatts'),
    acOutputWatts: first('inv.outputWatts', 'pd.invOutWatts'),
  };
}

export function ecoflowHeaders(
  accessKey: string,
  secret: string,
  nonce: string,
  timestamp: string,
  sn?: string,
) {
  const payload =
    (sn ? `sn=${sn}&` : '') +
    `accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}`;
  const sign = createHmac('sha256', secret).update(payload).digest('hex');
  return { accessKey, nonce, timestamp, sign };
}

async function readStations(access: string, secret: string, host: string) {
  async function get<T>(path: string, sn?: string) {
    const headers = ecoflowHeaders(
      access,
      secret,
      String(randomInt(100000, 1000000)),
      String(Date.now()),
      sn,
    );
    const { data } = await axios.get<{ code: string | number; data: T }>(
      `https://${host}/iot-open/sign/device/${path}`,
      {
        headers,
        params: sn ? { sn } : undefined,
        timeout: 10000,
        maxRedirects: 0,
      },
    );
    if (String(data.code) !== '0') throw new Error('EcoFlow request rejected');
    return data.data;
  }
  const stations = await get<Station[]>('list');
  return Promise.all(
    stations.map(async (station) => {
      const identity = {
        name: station.deviceName || station.productName || 'EcoFlow',
        model: station.productName,
        online: Number(station.online) === 1,
      };
      if (!identity.online) return { ...identity, telemetry: 'offline' };
      try {
        const quotas = await get<Quotas>('quota/all', station.sn);
        const readings = batteryReadings(quotas);
        return {
          ...identity,
          telemetry: Object.values(readings).some((v) => v !== null)
            ? 'available'
            : 'unmapped',
          ...readings,
        };
      } catch {
        return { ...identity, telemetry: 'unavailable' };
      }
    }),
  );
}

// Share concurrent reads and short-lived results to limit cloud requests.
export class EcoFlowWrapper {
  private pending?: ReturnType<EcoFlowWrapper['refresh']>;
  private expires = 0;
  async snapshot() {
    if (!this.pending || Date.now() >= this.expires) {
      this.expires = Infinity;
      this.pending = this.refresh().finally(() => {
        this.expires = Date.now() + 30000;
      });
    }
    return this.pending;
  }
  private async refresh() {
    const access = readSetting('ECOFLOW_ACCESS_KEY');
    const secret = readSetting('ECOFLOW_SECRET_KEY');
    if (!access || !secret) return { status: 'credentials_required' };
    const region = readSetting('ECOFLOW_REGION') || 'global';
    if (!['global', 'eu'].includes(region)) return { status: 'invalid_region' };
    try {
      const devices = await readStations(
        access,
        secret,
        region === 'eu' ? 'api-e.ecoflow.com' : 'api.ecoflow.com',
      );
      return { status: 'ready', fetchedAt: new Date().toISOString(), devices };
    } catch {
      return { status: 'upstream_unavailable' };
    }
  }
}
