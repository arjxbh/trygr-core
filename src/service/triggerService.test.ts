import { describe, expect, it, test, jest } from '@jest/globals';
import { TriggerService, Trigger } from './triggerService';
import { DeviceCacheService } from './deviceCacheService';
import { device } from '../interfaces';

const TEST_DEVICE_ID = 'TESTDEVICEID';
const TEST_VENDOR = 'testVendor';

interface TriggerListItem {
  ID: string;
  data: Trigger;
}

jest.mock('./deviceCacheService');
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    get: jest.fn(async (_key: string): Promise<string | null> => null),
    quit: jest.fn(),
  })),
}));
const deviceCache = new DeviceCacheService();
jest
  .mocked(deviceCache.getDeviceById)
  .mockResolvedValue({ id: TEST_DEVICE_ID, vendor: TEST_VENDOR });

// mock wrapper probably needs to be extracted to some testing helper
class testWrapper {
  triggered: string[];
  vendor: string;

  constructor() {
    this.triggered = [];
    this.vendor = TEST_VENDOR;
  }

  performDeviceAction = async (d: device) => {
    this.triggered.push(d.id);
    return { resultText: 'ok', noOp: false };
  };
}

const testWrapperInstance = new testWrapper();

const trigger = new TriggerService(deviceCache, [testWrapperInstance]);

const findTrigger = (device: string, id: string) => {
  const allTriggers = trigger.listTriggers();

  return allTriggers.find(
    (t: TriggerListItem) => t.data.affectedDeviceId === device && t.ID === id,
  );
};

describe('trigger service', () => {
  test('should be able to create and delete a trigger', async () => {
    const newTriggerId = trigger.createTrigger({
      affectedDeviceId: TEST_DEVICE_ID,
      triggerType: 'minTemp',
      triggerValue: 40,
      action: 'turnOn',
      actionValue: 'true',
      notify: [],
    });

    expect(newTriggerId).toBeDefined();

    const foundAfterCreate = findTrigger(TEST_DEVICE_ID, newTriggerId);

    expect(foundAfterCreate?.ID).toEqual(newTriggerId);
    expect(foundAfterCreate?.data.affectedDeviceId).toEqual(TEST_DEVICE_ID);

    trigger.deleteTrigger(newTriggerId);

    const foundAfterDelete = findTrigger(TEST_DEVICE_ID, newTriggerId);

    expect(foundAfterDelete).toBeUndefined();

    await deviceCache.closeConnection();
  });

  it('should be able to trigger based on min temp', async () => {
    const newTriggerId = trigger.createTrigger({
      affectedDeviceId: TEST_DEVICE_ID,
      triggerType: 'minTemp',
      triggerValue: 40,
      action: 'turnOn',
      actionValue: 'true',
      notify: [],
    });

    await trigger.triggerByTemperature(41);

    expect(testWrapperInstance.triggered).toHaveLength(0);
    await trigger.triggerByTemperature(40);
    expect(testWrapperInstance.triggered.length).toEqual(1);
    expect(testWrapperInstance.triggered[0]).toEqual(TEST_DEVICE_ID);

    trigger.deleteTrigger(newTriggerId);
  });

  // it('should be able to trigger based on max temp', async () => {

  // });

  // it('should not fail if the device is not found in the cache', async () => {

  // });
});
