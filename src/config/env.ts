import { readSetting } from './secrets';
const ZIPCODEBASE_API_KEY = readSetting('ZIPCODEBASE_API_KEY') || '';
const ZIP_CODE = readSetting('ZIP_CODE') || '0';
const COUNTRY_CODE = readSetting('COUNTRY_CODE') || 'US';
const SMTP_HOST = readSetting('SMTP_HOST') || '';
const SMTP_PORT = parseInt(readSetting('SMTP_PORT') || '25', 10);
const SMTP_SECURE = readSetting('SMTP_SECURE') === 'true';
const SMTP_USERNAME = readSetting('SMTP_USERNAME') || '';
const SMTP_PASSWORD = readSetting('SMTP_PASSWORD') || '';

export {
  ZIPCODEBASE_API_KEY,
  ZIP_CODE,
  COUNTRY_CODE,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USERNAME,
  SMTP_PASSWORD,
};
