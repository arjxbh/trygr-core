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

export class triggerService {
  db: typeof MongoClient.db;
  collection: typeof this.db.collection;
  dayStart: number;
  dayEnd: number;
  deviceCache: DeviceCacheService;
  wrappers: any[];

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
    const start = new Date;
    start.setHours(0, 0, 0, 0);
    this.dayStart = Math.floor(start.getTime() / 1000);

    const end = new Date;
    end.setHours(24, 0, 0, 0);
    this.dayEnd = Math.floor(end.getTime() / 1000);
  }

  #connect = async () => {
    const client = new MongoClient(`mongodb://${dbHost}:${dbPort}`);
    await client.connect();
    this.db = client.db(dbName);
    this.collection = this.db.collection(collectionName);
  };

  // store new trigger to db
  // TODO: add error handling, input validation
  createTrigger = async (trigger: Trigger) => {
    const res = await this.collection.insertMany([trigger]);
    console.log(res);
  }

  getTriggersByTime() {}

  // This only applies to time related and any triggers that can ONLY trigger once a day 
  // 🤔
  #filterTriggered = (triggers: Trigger[]) => {
    this.#setDayLimits;
    return triggers.filter((t: Trigger) => {
        if (t.lastTriggered > this.dayStart) return false;
        return true;
    })
  }

  // TODO: optimize this by doing logic in query
  triggerByTemperature = async (temperature: number) => {
    const matches = await this.collection.find({ triggerType: { $in: ['minTemp', 'maxTemp' ]}})
    const hits = matches.filter((t: Trigger) => {
        const { triggerType, triggerValue } = t;

        switch(triggerType) {
            case 'minTemp':
                return triggerValue <= temperature;
            case 'maxTemp':
                return triggerValue >= temperature;
        }

        return false;
    })

    hits.forEach(async (hit: Trigger) => {
      const { vendor } = await this.deviceCache.getDeviceById(hit.affectedDeviceId);

    })

    // TODO: think about how to apply the action to the hits
    // return list of hits
    // look up device id in hits in device cache to get vendor
    // have mapping table from vendor to wrapper
    // call action in wrapper
  }

  getTriggersBySourceDevice() {}
}
