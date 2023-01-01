const RING_REFRESH_TOKEN = process.env.ring_refresh_token || '';
const ZIPCODEBASE_API_KEY = process.env.zipcodebase_api_key || '';
const ZIP_CODE = process.env.zip_code || '0';
const COUNTRY_CODE = process.env.country_code || 'US';
const SMTP_HOST = process.env.smtp_host || '';
const SMTP_PORT = parseInt(process.env.smtp_port || '25', 10);
const SMTP_SECURE = process.env.smtp_secure === 'true';
const SMTP_USERNAME = process.env.smtp_username || '';
const SMTP_PASSWORD = process.env.smtp_password || '';

export {
  RING_REFRESH_TOKEN,
  ZIPCODEBASE_API_KEY,
  ZIP_CODE,
  COUNTRY_CODE,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USERNAME,
  SMTP_PASSWORD,
};
