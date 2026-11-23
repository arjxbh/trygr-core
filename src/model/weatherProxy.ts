import axios from 'axios';
import Logger from 'bunyan';
import { getLogger } from '../service/loggingService';

// TODO: make this interface more explicit
interface WeatherUnits {
  temperatureUnit?: string; //fahrenheit or celcius?
  windspeedUnit?: string; // kph or mph?
  precipitationUnit?: string; // inch or cm?
  timezone?: string; // America/New_York
}

const WEATHER_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const HOURLY_PARAMS = '&hourly=temperature_2m&current_weather=true';

export class WeatherProxy {
  temperatureUnit: WeatherUnits['temperatureUnit'];
  windspeedUnit: WeatherUnits['windspeedUnit'];
  precipitationUnit: WeatherUnits['precipitationUnit'];
  timezone: WeatherUnits['timezone'];
  logger: Logger;

  constructor(units: WeatherUnits) {
    this.logger = getLogger('Weather Proxy');

    this.temperatureUnit = units.temperatureUnit || 'fahrenheit';
    this.windspeedUnit = units.windspeedUnit || 'mph';
    this.precipitationUnit = units.precipitationUnit || 'inch';
    this.timezone = units.timezone || 'America%2FNew_York';
  }

  // TODO: improve error handling
  getDetails = async (latitude: string, longitude: string) => {
    this.logger.info(
      `Fetching weather details for ${latitude}, ${longitude} in ${this.timezone}`,
    );

    const url = `${WEATHER_BASE_URL}?latitude=${latitude.substring(
      0,
      7,
    )}&longitude=${longitude.substring(
      0,
      7,
    )}&${HOURLY_PARAMS}&temperature_unit=${
      this.temperatureUnit
    }&windspeed_unit=${
      this.windspeedUnit
    }&timeformat=unixtime&precipitation_unit=${
      this.precipitationUnit
    }&timezone=${this.timezone}&daily=sunrise,sunset`;

    try {
      const res = await axios.get(url);
      return res.data;
    } catch {
      throw new Error('Weather request failed');
    }
  };
}
