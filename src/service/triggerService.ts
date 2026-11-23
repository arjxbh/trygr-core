import FSDB from 'file-system-db';
import type { device } from '../interfaces';
import { DeviceCacheService } from '../service/deviceCacheService';
import { MailService } from './mailService';
import { getLogger } from '../service/loggingService';
import Logger from 'bunyan';
import { solarWindow } from '../model/solar';
import { readSetting } from '../config/secrets';

// TODO: move to interfaces file when ready

type DeviceTriggerType =
  | 'device'
  | 'absoluteTime'
  | 'relativeTime'
  | 'minTemp'
  | 'maxTemp';

export interface Trigger {
  affectedDeviceId: string; // device related to this trigger
  triggerType: DeviceTriggerType;
  triggerValue: string | number; // number or device id related to trigger type
  triggerOffset?: number; // used for relative time
  action: string; // action to be performed
  actionValue: string | number; // value associated with action
  chainDeviceId?: string; // next trigger to perform when this is complete
  notify: string[];
}

interface FSDbEntry {
  ID: string;
  data: Trigger;
}

interface ActionAdapter {
  vendor: string;
  performDeviceAction(
    device: device,
    action: string,
    value: string | number,
  ): Promise<{ resultText: string; noOp: boolean }>;
}

const dbName = 'triggerDb';

/*
 * I originally wanted to use mongodb, a tried and true system for this
 * Unforunately, I plan to run this on a raspberry pi clone, and all older hardware of
 * this type runs on ARMv7l CPUs, which are 32 bit.  Mongo does NOT support this.
 * Because the expected size and complexity of this database is very minimal, using
 * a much simpler json based data store will have to be sufficient.
 *
 * This is certainly NOT scalable, but for a system where you would expect
 * maybe a max of 100 triggers, it's okay.
 */
export class TriggerService {
  db: FSDB<Trigger>;
  dayStart: number;
  dayEnd: number;
  deviceCache: DeviceCacheService;
  wrappers: ActionAdapter[];
  notification: MailService;
  private solarCoordinates?: [number, number];
  setSolarLocation(latitude: number, longitude: number) {
    if (solarWindow(latitude, longitude))
      this.solarCoordinates = [latitude, longitude];
  }
  getSolarWindow() {
    if (this.solarCoordinates) return solarWindow(...this.solarCoordinates);
  }
  motionTimers: Map<string, NodeJS.Timeout>;
  logger: Logger;

  // TODO: fix ts for wrappers.  Wrappers should extend a base class,
  // and TS should be an array of instances of the wrapper base class?
  constructor(deviceCache: DeviceCacheService, wrappers: ActionAdapter[]) {
    this.logger = getLogger('Trigger Service');
    this.dayStart = 0;
    this.dayEnd = 0;
    this.#setDayLimits();
    this.db = new FSDB(`./${dbName}.json`);
    this.deviceCache = deviceCache;
    this.wrappers = wrappers;
    this.notification = new MailService();
    const lat = readSetting('LATITUDE'),
      lon = readSetting('LONGITUDE');
    if (lat && lon) this.setSolarLocation(Number(lat), Number(lon));
    this.motionTimers = new Map();
  }

  listTriggers = () => {
    return this.db.all();
  };

  // note: setHours(...) uses the current timezone
  #setDayLimits = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    this.dayStart = Math.floor(start.getTime() / 1000);

    const end = new Date();
    end.setHours(24, 0, 0, 0);
    this.dayEnd = Math.floor(end.getTime() / 1000);
  };

  // note: don't use . in naming, it breaks FSDB
  #createTriggerId = (triggerType: Trigger['triggerType']) => {
    const numEntries = this.db.all().length;
    return `${triggerType}:${String(numEntries + 1).padStart(4, '0')}`;
  };

  createTrigger = (trigger: Trigger) => {
    // TODO: add some logic to prevent duplicate triggers
    const id = this.#createTriggerId(trigger.triggerType);
    this.db.set(id, trigger);
    return id;
  };

  deleteTrigger = (triggerId: string) => {
    this.db.delete(triggerId);
  };

  getTriggersByTime() {}

  // This only applies to time related and any triggers that can ONLY trigger once a day
  // 🤔
  // #filterTriggered = (triggers: Trigger[]) => {
  //   this.#setDayLimits;
  //   return triggers.filter((t: Trigger) => {
  //     if (t.lastTriggered > this.dayStart) return false;
  //     return true;
  //   });
  // };

  #handleHitActions = async (hits: Trigger[]) => {
    for (const hit of hits) {
      try {
        const device = await this.deviceCache.getDeviceById(
          hit.affectedDeviceId,
        );
        this.logger.info('Performing trigger for device:', device);
        const wrapper = this.wrappers.find(
          (wrapper) => wrapper.vendor === device.vendor,
        );
        if (!wrapper) continue;
        this.logger.info(`device belongs to ${wrapper.vendor}`);
        const { resultText, noOp } = await wrapper.performDeviceAction(
          device,
          hit.action,
          hit.actionValue,
        );
        this.logger.info(resultText);
        if (!noOp && hit.notify && hit.notify?.length) {
          await this.notification.sendNotification(hit.notify, resultText);
        }
      } catch {
        this.logger.error(
          'Trigger action failed for device %s',
          hit.affectedDeviceId,
        );
      }
    }
  };

  // TODO: there is probably a better way to do this
  #handleStringOrNumber = (value: string | number): number => {
    if (typeof value === 'number') {
      return value;
    } else {
      return parseInt(value, 10);
    }
  };

  getTemperatureHits = async (temperature: number) => {
    const triggers = this.db.all();

    return triggers
      .filter((entry: FSDbEntry) => {
        const { triggerType, triggerValue } = entry.data;

        switch (triggerType) {
          case 'minTemp':
            return temperature <= this.#handleStringOrNumber(triggerValue);
          case 'maxTemp':
            return temperature >= this.#handleStringOrNumber(triggerValue);
          default:
            return false;
        }
      })
      .map((entry: FSDbEntry) => {
        return {
          ...entry.data,
        };
      });
  };

  triggerByTemperature = async (temperature: number) => {
    this.logger.debug('triggering by temperature, getting hits...');
    const hits = await this.getTemperatureHits(temperature);
    this.logger.debug(hits);
    await this.#handleHitActions(hits);
  };

  triggerFrontDoorMotion = async (cameraName: string) => {
    if (cameraName !== 'Front Door') return;
    if (!this.getSolarWindow()?.nighttime) return;
    const light = this.db
      .all()
      .find(
        (entry: FSDbEntry) =>
          entry.data.action === 'turnOn' &&
          entry.data.triggerValue === 'ring-motion:Front Door',
      );
    if (!light) return;
    const targetId = light.data.affectedDeviceId;
    const target = targetId.startsWith('kasa-name:')
      ? await this.deviceCache.findKasaDevice(targetId.slice(10))
      : await this.deviceCache.getDeviceById(targetId);
    if (!target) {
      this.logger.warn('Lighting target unavailable or ambiguous');
      return;
    }
    const wrapper = this.wrappers.find(
      (candidate) => candidate.vendor === target.vendor,
    );
    if (!wrapper) return;
    await wrapper.performDeviceAction(target, 'turnOn', 1);
    const priorTimer = this.motionTimers.get(target.id);
    if (priorTimer) clearTimeout(priorTimer);
    const timer = setTimeout(async () => {
      try {
        await wrapper.performDeviceAction(target, 'turnOff', 0);
      } catch {
        this.logger.error('Failed to turn off pathway light');
      }
      this.motionTimers.delete(target.id);
    }, 15 * 60 * 1000);
    this.motionTimers.set(target.id, timer);
  };

  getTriggersBySourceDevice() {}
}
