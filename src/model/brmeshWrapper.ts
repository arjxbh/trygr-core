import axios from 'axios';
import { readSetting } from '../config/secrets';

export const brmeshTarget = /^brmesh:([0-9A-Fa-f]{12})$/;

function hubClient() {
  const host = readSetting('BRMESH_HUB_HOST');
  if (!host) throw Error('hub_required');
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(host)) throw Error('invalid_hostname');
  const password = readSetting('BRMESH_HUB_PASSWORD');
  return axios.create({
    baseURL: `http://${host}/api/v1/`,
    auth: password ? { username: 'admin', password } : undefined,
    timeout: 5000,
    maxRedirects: 0,
    proxy: false,
  });
}

interface HubLight {
  id: string;
  name: string;
  state: { on: boolean };
  bind_pending: boolean;
}

export async function listBrmesh() {
  const { data } = await hubClient().get<HubLight[]>('lights');
  return data.map((light) => {
    const id = `brmesh:${light.id}`;
    if (!brmeshTarget.test(id) || typeof light.state?.on !== 'boolean')
      throw Error('invalid_response');
    return {
      id,
      name: light.name,
      assumedOn: light.state.on,
      bindPending: light.bind_pending,
    };
  });
}

export async function performBrmeshAction(id: string, action: string) {
  const match = brmeshTarget.exec(id);
  if (!match || (action !== 'turnOn' && action !== 'turnOff'))
    throw Error('Invalid BRmesh target or action');
  const on = action === 'turnOn';
  const { data } = await hubClient().put(`lights/${match[1]}/state`, { on });
  if (data?.on !== on)
    throw Error('BRmesh hub did not accept the requested state');
  return { resultText: `BRmesh hub queued ${action} for ${id}`, noOp: false };
}
