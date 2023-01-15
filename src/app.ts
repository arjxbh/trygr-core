import {
  RING_REFRESH_TOKEN,
  ZIPCODEBASE_API_KEY,
  ZIP_CODE,
  COUNTRY_CODE,
} from './config/env';
import { RingWrapper } from './model/ringWrapper';
import { KasaWrapper } from './model/tpLinkWrapper';
import { ZipCodeProxy } from './model/zipCodeProxy';
import { WeatherProxy } from './model/weatherProxy';
import { DeviceCacheService } from './service/deviceCacheService';
import { TriggerService } from './service/triggerService';
import { LocationCacheService } from './service/locationCacheService';
import { ApiService } from './service/apiService';

// TODO: use message bird api to send messages on events

// TODO: organize the logic in this file into a controller(s)
const doTheThing = async () => {
  // console.log(await ring.getDevices());

  const deviceCache = new DeviceCacheService();
  // const ring = new RingWrapper(RING_REFRESH_TOKEN, (d) => cache.updateDevice(d));
  const kasa = new KasaWrapper(deviceCache);
  const triggers = new TriggerService(deviceCache, [kasa]);
  const ZipCodeBase = new ZipCodeProxy(ZIPCODEBASE_API_KEY, COUNTRY_CODE);

  const details = await ZipCodeBase.getDetails(ZIP_CODE);

  console.log(details);

  const weather = new WeatherProxy({ timezone: details.timezone });
  const locationCache = new LocationCacheService(triggers);

  const api = new ApiService();

  setInterval(
    async (
      locationDetails: any,
      weather: WeatherProxy,
      locationCache: LocationCacheService,
    ) => {
      const { postal_code, latitude, longitude, city, state, country_code } =
        locationDetails;

      const weatherInfo = await weather.getDetails(latitude, longitude);
      const cacheUpdate = {
        latitude,
        longitude,
        city,
        state,
        postalCode: postal_code,
        countryCode: country_code,
        utcOffsetSeconds: weatherInfo.utc_offset_seconds,
        sunrise: locationCache.convertTimeToUnix(weatherInfo.daily.sunrise[0]),
        sunset: locationCache.convertTimeToUnix(weatherInfo.daily.sunset[0]),
        currentWeather: {
          temperature: weatherInfo.current_weather.temperature,
          windspeed: weatherInfo.current_weather.windspeed,
        },
      };

      console.log(cacheUpdate);

      locationCache.updateLocation(cacheUpdate);
    },
    60000,
    details,
    weather,
    locationCache,
  );

    triggers.createTrigger({
      affectedDeviceId: '80065139E8A7D9BA92405DEE56064F2F204591A8',
      triggerType: 'maxTemp',
      triggerValue: 40,
      action: 'turnOff',
      actionValue: 0,
      notify: ['8622283280@tmomail.net', 'dapcwiz@gmail.com'],
    });

    triggers.createTrigger({
      affectedDeviceId: '80065139E8A7D9BA92405DEE56064F2F204591A8',
      triggerType: 'minTemp',
      triggerValue: 35,
      action: 'turnOn',
      actionValue: 1,
      notify: ['8622283280@tmomail.net', 'dapcwiz@gmail.com'],
    });
};

doTheThing();
