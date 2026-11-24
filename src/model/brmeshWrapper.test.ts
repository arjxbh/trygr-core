import { expect, test, jest } from '@jest/globals';
import axios from 'axios';
import { listBrmesh, performBrmeshAction } from './brmeshWrapper';
import { readSetting } from '../config/secrets';

jest.mock('../config/secrets');

test('lists assumed state and addresses individual lights for triggers', async () => {
  jest
    .mocked(readSetting)
    .mockImplementation((name) =>
      name === 'BRMESH_HUB_HOST' ? 'hub.local' : '',
    );
  const client = axios.create();
  jest.spyOn(client, 'get').mockResolvedValue({
    data: [
      {
        id: '000000000001',
        name: 'Test',
        state: { on: false },
        bind_pending: false,
      },
    ],
  });
  const put = jest
    .spyOn(client, 'put')
    .mockResolvedValue({ data: { on: true } });
  const create = jest.spyOn(axios, 'create').mockReturnValue(client);
  try {
    const [light] = await listBrmesh();
    expect(light.assumedOn).toBe(false);
    await performBrmeshAction(light.id, 'turnOn');
    expect(put).toHaveBeenCalledWith('lights/000000000001/state', { on: true });
    await expect(
      performBrmeshAction('brmesh:all', 'turnOff'),
    ).rejects.toThrow();
    expect(put).toHaveBeenCalledTimes(1);
  } finally {
    create.mockRestore();
  }
});
