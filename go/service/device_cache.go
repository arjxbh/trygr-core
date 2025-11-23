package service

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"golang.org/x/net/context"

	"trygr-core/interfaces"
)

type DeviceCacheService struct {
	client *redis.Client
	logger *logrus.Logger
}

func NewDeviceCacheService(redisURL string) *DeviceCacheService {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		logrus.Fatalf("Failed to parse Redis URL: %v", err)
	}

	client := redis.NewClient(opt)
	
	// Test connection
	ctx := context.Background()
	_, err = client.Ping(ctx).Result()
	if err != nil {
		logrus.Fatalf("Failed to connect to Redis: %v", err)
	}

	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})

	return &DeviceCacheService{
		client: client,
		logger: logger,
	}
}

func (d *DeviceCacheService) UpdateDevice(device interfaces.Device) error {
	device.LastUpdated = time.Now()
	
	payload, err := json.Marshal(device)
	if err != nil {
		return fmt.Errorf("failed to marshal device: %w", err)
	}

	d.logger.WithFields(logrus.Fields{
		"deviceId": device.ID,
		"device":   string(payload),
	}).Info("Updating device")

	ctx := context.Background()
	err = d.client.Set(ctx, device.ID, payload, 0).Err()
	if err != nil {
		return fmt.Errorf("failed to set device in Redis: %w", err)
	}

	return nil
}

func (d *DeviceCacheService) AddDevice(device interfaces.Device) error {
	return d.UpdateDevice(device)
}

func (d *DeviceCacheService) GetDeviceByID(deviceID string) (interfaces.Device, error) {
	d.logger.WithField("deviceId", deviceID).Info("Getting device details")

	ctx := context.Background()
	payload, err := d.client.Get(ctx, deviceID).Result()
	if err != nil {
		if err == redis.Nil {
			return interfaces.Device{}, fmt.Errorf("device not found: %s", deviceID)
		}
		return interfaces.Device{}, fmt.Errorf("failed to get device from Redis: %w", err)
	}

	d.logger.WithField("payload", payload).Debug("Retrieved device payload")

	var device interfaces.Device
	err = json.Unmarshal([]byte(payload), &device)
	if err != nil {
		return interfaces.Device{}, fmt.Errorf("failed to unmarshal device: %w", err)
	}

	return device, nil
}

func (d *DeviceCacheService) GetDeviceByName(name string) (interfaces.Device, error) {
	// TODO: implement this with secondary index or scan
	return interfaces.Device{}, fmt.Errorf("GetDeviceByName not yet implemented")
}

func (d *DeviceCacheService) CloseConnection() error {
	return d.client.Close()
}
