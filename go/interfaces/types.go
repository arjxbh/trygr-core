package interfaces

import "time"

// Device represents a smart home device
type Device struct {
	ID            string    `json:"id" redis:"id"`
	Status        string    `json:"status" redis:"status"`
	OnACPower     bool      `json:"onACPower" redis:"onACPower"`
	Name          string    `json:"name" redis:"name"`
	HasBrightness bool      `json:"hasBrightness" redis:"hasBrightness"`
	HasVolume     bool      `json:"hasVolume" redis:"hasVolume"`
	Brightness    *int      `json:"brightness,omitempty" redis:"brightness"`
	Volume        *int      `json:"volume,omitempty" redis:"volume"`
	Vendor        string    `json:"vendor" redis:"vendor"`
	Type          string    `json:"type" redis:"type"`
	OnTime        int64     `json:"onTime" redis:"onTime"`
	LastUpdated   time.Time `json:"lastUpdated" redis:"lastUpdated"`
	IP            *string   `json:"ip,omitempty" redis:"ip"`
	Port          *int      `json:"port,omitempty" redis:"port"`
}

// Location represents geographic location and weather data
type Location struct {
	PostalCode        string  `json:"postalCode" redis:"postalCode"`
	Latitude          string  `json:"latitude" redis:"latitude"`
	Longitude         string  `json:"longitude" redis:"longitude"`
	City              string  `json:"city" redis:"city"`
	State             string  `json:"state" redis:"state"`
	CountryCode       string  `json:"countryCode" redis:"countryCode"`
	UTCOffsetSeconds  int     `json:"utcOffsetSeconds" redis:"utcOffsetSeconds"`
	Sunrise           int64   `json:"sunrise" redis:"sunrise"`
	Sunset            int64   `json:"sunset" redis:"sunset"`
	CurrentWeather    Weather `json:"currentWeather" redis:"currentWeather"`
	LastUpdated       int64   `json:"lastUpdated,omitempty" redis:"lastUpdated"`
}

// Weather represents current weather conditions
type Weather struct {
	Temperature float64 `json:"temperature" redis:"temperature"`
	Windspeed   float64 `json:"windspeed" redis:"windspeed"`
}

// TriggerType represents the type of trigger
type TriggerType string

const (
	TriggerTypeDevice       TriggerType = "device"
	TriggerTypeAbsoluteTime TriggerType = "absoluteTime"
	TriggerTypeRelativeTime TriggerType = "relativeTime"
	TriggerTypeMinTemp      TriggerType = "minTemp"
	TriggerTypeMaxTemp      TriggerType = "maxTemp"
)

// Trigger represents an automation trigger
type Trigger struct {
	AffectedDeviceID string      `json:"affectedDeviceId"`
	TriggerType      TriggerType `json:"triggerType"`
	TriggerValue     interface{} `json:"triggerValue"` // can be string or number
	TriggerOffset    *int        `json:"triggerOffset,omitempty"`
	Action           string      `json:"action"`
	ActionValue      interface{} `json:"actionValue"` // can be string or number
	ChainDeviceID    *string     `json:"chainDeviceId,omitempty"`
	Notify           []string    `json:"notify"`
}

// ActionResult represents the result of performing a device action
type ActionResult struct {
	ResultText string
	NoOp       bool
}

// DeviceWrapper interface for device vendor implementations
type DeviceWrapper interface {
	GetVendor() string
	PerformDeviceAction(device Device, action string, actionValue interface{}) ActionResult
}

// ExternalDeviceCache function type for caching devices
type ExternalDeviceCache func(device Device) error

// ExternalDeviceLookup function type for looking up devices
type ExternalDeviceLookup func(deviceID string) (Device, error)
