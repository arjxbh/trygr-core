import { RING_REFRESH_TOKEN } from './config/env';
import { triggers } from './config/runDef';
import { RingWrapper } from './model/ringWrapper';
import { KasaWrapper } from './model/tpLinkWrapper';

const doTheThing = async () => {
    const ring = new RingWrapper(RING_REFRESH_TOKEN);

    console.log(await ring.getDevices());
    
    const kasa = new KasaWrapper();
}

doTheThing();



