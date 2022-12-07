import axios from 'axios';

const ZIPCODEBASE_URL = 'https://app.zipcodebase.com/api/v1/search';

export class ZipCodeProxy {
   apiKey: string
   countryCode: string

   constructor (apiKey: string, countryCode: string) {
      this.apiKey = apiKey;
      this.countryCode = countryCode;
   }

   // TODO: add error handling
   // TODO: don't use any
   getDetails = async (zipCode: string) => {
      const res = await axios.get(
         `${ZIPCODEBASE_URL}?codes=${zipCode}`,
         { headers: { apiKey: this.apiKey } },
      )

      return res.data.results[zipCode].find((r: any) => r.country_code === this.countryCode);
   }
}