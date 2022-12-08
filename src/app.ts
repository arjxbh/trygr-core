import { RING_REFRESH_TOKEN, ZIPCODEBASE_API_KEY, ZIP_CODE, COUNTRY_CODE } from './config/env';
import { triggers } from './config/runDef';
import { RingWrapper } from './model/ringWrapper';
import { KasaWrapper } from './model/tpLinkWrapper';
import { ZipCodeProxy } from './model/zipCodeProxy';
import { WeatherProxy } from './model/weatherProxy';
import { DeviceCacheService } from './service/deviceCacheService';

const doTheThing = async () => {

    // console.log(await ring.getDevices());

    const cache = new DeviceCacheService();
    const ring = new RingWrapper(RING_REFRESH_TOKEN, (d) => cache.updateDevice(d));
    const kasa = new KasaWrapper((d) => cache.updateDevice(d));
    // const ZipCodeBase = new ZipCodeProxy(ZIPCODEBASE_API_KEY, COUNTRY_CODE);

    // const details = await ZipCodeBase.getDetails(ZIP_CODE);

    // console.log(details);

    // const Weather = new WeatherProxy({});

    // const weatherInfo = await Weather.getDetails(details.latitude, details.longitude);

    // console.log(weatherInfo);
}

doTheThing();