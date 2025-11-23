package service

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"context"

	"trygr-core/interfaces"
)

type LocationCacheService struct {
	client   *redis.Client
	triggers *TriggerService
	logger   *logrus.Logger
}

func NewLocationCacheService(redisURL string, triggers *TriggerService) *LocationCacheService {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		logrus.Fatalf("Failed to parse Redis URL: %v", err)
	}

	client := redis.NewClient(opt)
	
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})

	return &LocationCacheService{
		client:   client,
		triggers: triggers,
		logger:   logger,
	}
}

func (l *LocationCacheService) ConvertTimeToUnix(timeStr string) int64 {
	t, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		l.logger.WithError(err).Error("Failed to parse time")
		return 0
	}
	return t.Unix()
}

func (l *LocationCacheService) UpdateLocation(location interfaces.Location) error {
	location.LastUpdated = time.Now().Unix()
	
	payload, err := json.Marshal(location)
	if err != nil {
		return fmt.Errorf("failed to marshal location: %w", err)
	}

	l.logger.WithFields(logrus.Fields{
		"postalCode": location.PostalCode,
		"payload":    string(payload),
	}).Info("Updating location")

	// Trigger temperature-based triggers (fire and forget)
	go l.triggers.TriggerByTemperature(location.CurrentWeather.Temperature)

	ctx := context.Background()
	err = l.client.Set(ctx, location.PostalCode, payload, 0).Err()
	if err != nil {
		return fmt.Errorf("failed to set location in Redis: %w", err)
	}

	return nil
}

func (l *LocationCacheService) GetLocationByPostalCode(postalCode string) (interfaces.Location, error) {
	l.logger.WithField("postalCode", postalCode).Info("Getting location details")

	ctx := context.Background()
	payload, err := l.client.Get(ctx, postalCode).Result()
	if err != nil {
		if err == redis.Nil {
			return interfaces.Location{}, fmt.Errorf("location not found: %s", postalCode)
		}
		return interfaces.Location{}, fmt.Errorf("failed to get location from Redis: %w", err)
	}

	var location interfaces.Location
	err = json.Unmarshal([]byte(payload), &location)
	if err != nil {
		return interfaces.Location{}, fmt.Errorf("failed to unmarshal location: %w", err)
	}

	return location, nil
}

func (l *LocationCacheService) CloseConnection() error {
	return l.client.Close()
}
