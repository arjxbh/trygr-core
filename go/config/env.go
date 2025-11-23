package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
)

type Config struct {
	RingRefreshToken  string
	ZipCodeBaseAPIKey string
	ZipCode           string
	CountryCode       string
	SMTPHost          string
	SMTPPort          int
	SMTPSecure        bool
	SMTPUsername      string
	SMTPPassword      string
	RedisURL          string
	APIPort           string
}

func Load() *Config {
	// Try to load .env file (ignore error if it doesn't exist)
	_ = godotenv.Load()

	smtpPort, err := strconv.Atoi(getEnv("SMTP_PORT", "25"))
	if err != nil {
		logrus.Warnf("Invalid SMTP_PORT value, using default: %v", err)
		smtpPort = 25
	}

	smtpSecure, err := strconv.ParseBool(getEnv("SMTP_SECURE", "false"))
	if err != nil {
		logrus.Warnf("Invalid SMTP_SECURE value, using default: %v", err)
		smtpSecure = false
	}

	return &Config{
		RingRefreshToken:  getEnv("RING_REFRESH_TOKEN", ""),
		ZipCodeBaseAPIKey: getEnv("ZIPCODEBASE_API_KEY", ""),
		ZipCode:           getEnv("ZIP_CODE", "0"),
		CountryCode:       getEnv("COUNTRY_CODE", "US"),
		SMTPHost:          getEnv("SMTP_HOST", ""),
		SMTPPort:          smtpPort,
		SMTPSecure:        smtpSecure,
		SMTPUsername:      getEnv("SMTP_USERNAME", ""),
		SMTPPassword:      getEnv("SMTP_PASSWORD", ""),
		RedisURL:          getEnv("REDIS_URL", "redis://localhost:6379"),
		APIPort:           getEnv("API_PORT", "3333"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
