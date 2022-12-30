const { MongoClient } = require('mongodb');
import { DeviceCacheService } from '../service/deviceCacheService';

// TODO: move to interfaces file when ready
interface Trigger {
  id: string; // identifier for trigger
  lastTriggered: number;
  affectedDeviceId: string; // device related to this trigger
  triggerType: string; // device | absoluteTime | relativeTime | minTemp | maxTemp
  triggerValue: string | number; // number or device id related to trigger type
  triggerOffset?: number; // used for relative time
  action: string; // action to be performed
  chainDeviceId?: string; // next trigger to perform when this is complete
}

// TODO: move to config / env
const dbHost = 'localhost';
const dbPort = 27017;
const dbName = 'triggerDb';
const collectionName = 'triggers';

export class TriggerService {
  db: typeof MongoClient.db;
  collection: typeof this.db.collection;
  dayStart: number;
  dayEnd: number;
  deviceCache: DeviceCacheService;
  wrappers: any[];
  vendorMap: any; // TODO: interface

  // TODO: fix ts for wrappers.  Wrappers should extend a base class,
  // and TS should be an array of instances of the wrapper base class?
  constructor(deviceCache: DeviceCacheService, wrappers: any[]) {
    this.dayStart = 0;
    this.dayEnd = 0;
    this.#setDayLimits();
    this.#connect();
    this.deviceCache = deviceCache;
    this.wrappers = wrappers;
  }

  // note: setHours(...) uses the current timezone
  #setDayLimits = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    this.dayStart = Math.floor(start.getTime() / 1000);

    const end = new Date();
    end.setHours(24, 0, 0, 0);
    this.dayEnd = Math.floor(end.getTime() / 1000);
  };

  #connect = async () => {
    const client = new MongoClient(`mongodb://${dbHost}:${dbPort}`);
    await client.connect();
    this.db = await client.db(dbName);
    this.collection = await this.db.collection(collectionName);
  };

  // store new trigger to db
  // TODO: add error handling, input validation
  createTrigger = async (trigger: Trigger) => {
    // TODO: should the trigger service handle creating unique trigger ids?
    const res = await this.collection.insertMany([trigger]);
    console.log(res);
  };

  getTriggersByTime() {}

  // This only applies to time related and any triggers that can ONLY trigger once a day
  // 🤔
  #filterTriggered = (triggers: Trigger[]) => {
    this.#setDayLimits;
    return triggers.filter((t: Trigger) => {
      if (t.lastTriggered > this.dayStart) return false;
      return true;
    });
  };

  #handleHitActions = (hits: Trigger[]) => {
    hits.forEach(async (hit: Trigger) => {
      const device = await this.deviceCache.getDeviceById(hit.affectedDeviceId);
      console.log(`Performing trigger for device:`);
      console.log(device);
      const wrapper = this.wrappers.find(
        (wrapper: any) => wrapper.vendor === device.vendor,
      );
      console.log(`device belongs to ${wrapper.vendor}`);
      wrapper.performDeviceAction(device, hit.action);
    });
  };

  triggerByTemperature = async (temperature: number) => {
    const query = {
      triggerType: { $in: ['minTemp', 'maxTemp'] },
    };

    try {
      await this.collection.find(query).toArray((err: any, docs: any) => {
        if (err) throw err;

        const hits = docs.filter((t: Trigger) => {
          const { triggerType, triggerValue } = t;

          switch (triggerType) {
            case 'minTemp':
              return temperature <= triggerValue;
            case 'maxTemp':
              return temperature >= triggerValue;
          }

          return false;
        });

        console.log(hits);

        this.#handleHitActions(hits);
      });
    } catch (e) {
      console.log('CAUGHT QUERY ERROR');
      console.log(e);
    }
  };

  getTriggersBySourceDevice() {}
}
