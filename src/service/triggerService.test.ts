import {describe, expect, test} from '@jest/globals';
import { TriggerService } from './triggerService';
import { DeviceCacheService } from './deviceCacheService';
import { KasaWrapper } from '../model/tpLinkWrapper';

describe('trigger service', () => {
    test('should work', () => {
        const device = new DeviceCacheService();
        const kasa = new KasaWrapper(device);
        const trigger = new TriggerService(device, [kasa]);

        // TODO: clear database function for testing?
        // maybe key trigger names with test and then delete all test
        // const newTrigger = trigger.createTrigger()
    });
});