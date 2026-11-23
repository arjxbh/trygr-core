import { expect, jest, test } from '@jest/globals';
import { connectRing } from './ringWrapper';
import { readSetting, writeSecret } from '../config/secrets';
import { RingApi } from 'ring-client-api';

jest.mock('../config/secrets');
jest.mock('ring-client-api', () => ({ RingApi: jest.fn() }));
jest.mock('ring-client-api/util', () => ({ useLogger: jest.fn() }));

test('subscribes to token rotation before requesting Ring locations', async () => {
  const order: string[] = [];
  jest.mocked(readSetting).mockReturnValue('seed');
  const cache = jest.fn(async () => {});
  const api = {
    onRefreshTokenUpdated: {
      subscribe(callback: (event: { newRefreshToken: string }) => void) {
        order.push('subscribe');
        callback({ newRefreshToken: 'rotated' });
      },
    },
    async getCameras() {
      return [
        {
          id: 123,
          name: 'Front Door',
          data: { alerts: { connection: 'online' } },
          deviceType: 'doorbell',
          operatingOnBattery: false,
          hasLight: false,
          onMotionStarted: { subscribe: () => ({ unsubscribe: () => {} }) },
          onData: {
            subscribe(callback: (data: object) => void) {
              callback({ alerts: { connection: 'online' } });
            },
          },
        },
      ];
    },
    async getLocations() {
      order.push('locations');
      return [
        {
          async getDevices() {
            return [
              {
                onData: {
                  subscribe(callback: (data: object) => void) {
                    callback({
                      name: 'Door',
                      zid: 'sensor',
                      deviceType: 'contact',
                      faulted: true,
                    });
                  },
                },
              },
            ];
          },
        },
      ];
    },
  };
  jest
    .mocked(RingApi)
    .mockImplementation(() => jest.mocked(api as unknown as RingApi));
  await connectRing(cache, () => {});
  expect(RingApi).toHaveBeenCalledWith({ refreshToken: 'seed' });
  expect(order).toEqual(['subscribe', 'locations']);
  expect(writeSecret).toHaveBeenCalledWith('RING_REFRESH_TOKEN', 'rotated');
  expect(cache).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'sensor', vendor: 'ring', status: 'fault' }),
  );
  expect(cache).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'camera:123',
      type: 'doorbell',
      status: 'online',
    }),
  );
});
