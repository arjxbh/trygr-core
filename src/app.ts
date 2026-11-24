import { startDashboard } from './service/dashboard';
import { ZIPCODEBASE_API_KEY, ZIP_CODE, COUNTRY_CODE } from './config/env';
import { connectRing } from './model/ringWrapper';
import { MatterWrapper } from './model/matterWrapper';
import { KasaWrapper } from './model/tpLinkWrapper';
import { ZipCodeProxy } from './model/zipCodeProxy';
import { WeatherProxy } from './model/weatherProxy';
import { DeviceCacheService } from './service/deviceCacheService';
import { TriggerService } from './service/triggerService';
import { LocationCacheService } from './service/locationCacheService';
import { ApiService } from './service/apiService';

async function startWeather(triggers: TriggerService) {
  const zipCodes = new ZipCodeProxy(ZIPCODEBASE_API_KEY, COUNTRY_CODE);
  const details = await zipCodes.getDetails(ZIP_CODE);
  triggers.setSolarLocation(
    Number(details.latitude),
    Number(details.longitude),
  );
  const weather = new WeatherProxy({ timezone: details.timezone });
  const locationCache = new LocationCacheService(triggers);
  async function update() {
    try {
      const { postal_code, latitude, longitude, city, state, country_code } =
        details;
      const weatherInfo = await weather.getDetails(latitude, longitude);
      const cacheUpdate = {
        latitude,
        longitude,
        city,
        state,
        postalCode: postal_code,
        countryCode: country_code,
        utcOffsetSeconds: weatherInfo.utc_offset_seconds,
        sunrise: weatherInfo.daily.sunrise[0],
        sunset: weatherInfo.daily.sunset[0],
        currentWeather: {
          temperature: weatherInfo.current_weather.temperature,
          windspeed: weatherInfo.current_weather.windspeed,
        },
      };

      await locationCache.updateLocation(cacheUpdate);
    } catch {
      console.error('Weather update failed');
    } finally {
      setTimeout(update, 60000);
    }
  }
  setTimeout(update, 60000);
}

const deviceCache = new DeviceCacheService();
const kasa = new KasaWrapper(deviceCache);
const matter = new MatterWrapper();
const triggers = new TriggerService(deviceCache, [kasa], matter);
void matter
  .start((id) => triggers.bindWalkway(id))
  .catch(() => console.error('Matter controller failed to start'));
new ApiService(triggers);
let refreshRing = async () => 'Connection unavailable';
startDashboard(triggers, {
  Kasa: () => kasa.refresh(),
  Ring: () => refreshRing(),
});
void connectRing(
  (device) => deviceCache.updateDevice(device),
  (cameraName) =>
    void triggers
      .triggerFrontDoorMotion(cameraName)
      .catch(() => console.error('Motion action failed')),
  (name, lat, lon) => {
    if (name === 'Front Door') triggers.setSolarLocation(lat, lon);
  },
  (refresh) => {
    refreshRing = refresh;
  },
);
async function enableWeather() {
  try {
    await startWeather(triggers);
  } catch {
    console.error('Location lookup failed. Retrying in one minute.');
    setTimeout(enableWeather, 60000);
  }
}
if (ZIPCODEBASE_API_KEY && ZIP_CODE !== '0') void enableWeather();
