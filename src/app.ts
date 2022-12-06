import { RING_REFRESH_TOKEN, ZIPCODEBASE_API_KEY, ZIP_CODE, COUNTRY_CODE } from './config/env';
import { triggers } from './config/runDef';
import { RingWrapper } from './model/ringWrapper';
import { KasaWrapper } from './model/tpLinkWrapper';
import { ZipCodeProxy } from './model/zipCodeProxy';

const doTheThing = async () => {
    // const ring = new RingWrapper(RING_REFRESH_TOKEN);

    // console.log(await ring.getDevices());

    // const kasa = new KasaWrapper();
    const ZipCodeBase = new ZipCodeProxy(ZIPCODEBASE_API_KEY, COUNTRY_CODE);

    const details = await ZipCodeBase.getDetails(ZIP_CODE);

    console.log(details);
}

doTheThing();