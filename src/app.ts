import { RING_REFRESH_TOKEN } from './config/env';
import { triggers } from './config/runDef';
import { KasaWrapper } from './model/tpLinkWrapper';

const kasa = new KasaWrapper();