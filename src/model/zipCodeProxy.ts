import axios from 'axios';
import Logger from 'bunyan';
import tzlookup from 'tz-lookup';
interface ZipDetails {
  latitude: string;
  longitude: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
}
import { getLogger } from '../service/loggingService';

const ZIPCODEBASE_URL = 'https://app.zipcodebase.com/api/v1/search';

export class ZipCodeProxy {
  apiKey: string;
  countryCode: string;
  logger: Logger;

  constructor(apiKey: string, countryCode: string) {
    this.logger = getLogger('Zip Code Proxy');
    this.apiKey = apiKey;
    this.countryCode = countryCode;
  }

  // TODO: add error handling
  // TODO: don't use any
  getDetails = async (zipCode: string) => {
    const res = await axios.get<{ results: Record<string, ZipDetails[]> }>(
      `${ZIPCODEBASE_URL}?codes=${zipCode}`,
      {
        headers: { apiKey: this.apiKey },
      },
    );

    const zipCodeDetails = res.data.results[zipCode].find(
      (r) => r.country_code === this.countryCode,
    );

    if (!zipCodeDetails) throw new Error('Postal code not found');
    const timezone = tzlookup(
      Number(zipCodeDetails.latitude),
      Number(zipCodeDetails.longitude),
    );

    this.logger.info(`Zip code details for ${zipCode}`, zipCodeDetails);

    return { ...zipCodeDetails, timezone };
  };
}
