import { expect, test } from '@jest/globals';
import { batteryReadings, ecoflowHeaders } from './ecoflowWrapper';

test('signs the serial before authentication fields without sending the secret', () => {
  expect(
    ecoflowHeaders(
      'test-access',
      'test-secret',
      '123456',
      '1234567890000',
      'TEST',
    ),
  ).toEqual({
    accessKey: 'test-access',
    nonce: '123456',
    timestamp: '1234567890000',
    sign: '9298fa9900895a9255bdd1cf5a3a74c2d07d75edf4a5e1cfeb38802ebbf7d807',
  });
});

test('distinguishes a dark panel from an unreported panel', () => {
  expect(
    batteryReadings({ 'pd.soc': 75, 'mppt.inWatts': 0, 'inv.outputWatts': 12 }),
  ).toEqual({
    batteryPercent: 75,
    solarDcInputWatts: 0,
    secondSolarDcInputWatts: null,
    acOutputWatts: 12,
  });
});
