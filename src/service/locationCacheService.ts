import Redis from 'ioredis';
import Logger from 'bunyan';
import { getLogger } from './loggingService';
import { TriggerService } from './triggerService';

interface location {
  postalCode: string;
  latitude: string;
  longitude: string;
  city: string;
  state: string;
  countryCode: string;
  utcOffsetSeconds: number;
  sunrise: number; // convert to unix time
  sunset: number; // convert to unix time
  currentWeather: {
    temperature: number;
    windspeed: number;
  };
  lastUpdated?: number;
}

// having the trigger service as a dep of the constructor could lead to a circular dep problem
// maybe need to use a queing / messaging service to solve this?
export class LocationCacheService {
  cache: Redis;
  triggers: TriggerService;
  logger: Logger;

  constructor(triggers: TriggerService) {
    this.logger = getLogger('Location Cache');
    this.cache = new Redis();
    this.triggers = triggers;
  }

  convertTimeToUnix = (time: string) =>
    Math.floor(new Date(time).getTime() / 1000);

  async updateLocation(location: location) {
    location.lastUpdated = Math.floor(new Date().getTime() / 1000);
    const payload = JSON.stringify(location);
    this.logger.info(
      `Updating location ${location.postalCode} with ${payload}`,
    );

    this.triggers.triggerByTemperature(location.currentWeather.temperature); // fire and forget

    return await this.cache.set(location.postalCode, payload);
  }

  async getLocationByPostalCode(postalCode: location['postalCode']) {
    this.logger.info(`getting location details for ${postalCode}`);
    const payload = await this.cache.get(postalCode);
    return JSON.parse(payload || '');
  }
}
