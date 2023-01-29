import { describe, expect, test } from '@jest/globals';
import { TriggerService, Trigger } from './triggerService';
import { DeviceCacheService } from './deviceCacheService';
import { KasaWrapper } from '../model/tpLinkWrapper';

const TEST_DEVICE_ID = 'TESTDEVICEID';

interface TriggerListItem {
  ID: string;
  data: Trigger;
}

describe('trigger service', () => {
  test('should be able to create and delete a trigger', async () => {
    const device = new DeviceCacheService();
    // const kasa = new KasaWrapper(device);
    const trigger = new TriggerService(device, []);

    // TODO: clear database function for testing?
    // maybe key trigger names with test and then delete all test
    const newTriggerId = trigger.createTrigger({
      affectedDeviceId: TEST_DEVICE_ID,
      triggerType: 'minTemp',
      triggerValue: 40,
      action: 'turnOn',
      actionValue: 'true',
      notify: [],
    });

    expect(newTriggerId).toBeDefined();

    const allTriggers = trigger.listTriggers();

    const foundAfterCreate = allTriggers.find(
      (t: TriggerListItem) =>
        t.data.affectedDeviceId === TEST_DEVICE_ID && t.ID === newTriggerId,
    );

    expect(foundAfterCreate.ID).toEqual(newTriggerId);
    expect(foundAfterCreate.data.affectedDeviceId).toEqual(TEST_DEVICE_ID);

    trigger.deleteTrigger(newTriggerId);

    const foundAfterDelete = allTriggers.find(
      (t: TriggerListItem) =>
        t.data.affectedDeviceId === TEST_DEVICE_ID && t.ID === newTriggerId,
    );

    expect(foundAfterDelete).toBeUndefined;

    await device.closeConnection();
  });
});
