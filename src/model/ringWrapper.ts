import { RingApi, type RingDeviceData, type RingCamera } from 'ring-client-api';
import { useLogger } from 'ring-client-api/util';
import { readSetting, writeSecret } from '../config/secrets';
import type { device, ExternalDeviceCache } from '../interfaces';

export async function connectRing(
  cacheDevice: ExternalDeviceCache,
  onMotion: (cameraName: string, latitude?: number, longitude?: number) => void,
  onLocation?: (name: string, latitude: number, longitude: number) => void,
  onReady?: (refresh: () => Promise<string>) => void,
) {
  const token = readSetting('RING_REFRESH_TOKEN');
  if (!token) return;
  // SDK errors can contain raw HTTP requests and authorization headers.
  useLogger({
    logInfo: () => {},
    logError: () => console.error('Ring SDK request failed'),
  });
  const api = new RingApi({ refreshToken: token });
  const rotation = api.onRefreshTokenUpdated.subscribe(
    ({ newRefreshToken }) => {
      writeSecret('RING_REFRESH_TOKEN', newRefreshToken);
    },
  );
  try {
    for (const camera of await api.getCameras()) {
      await cacheDevice(formatCamera(camera));
      subscribeCamera(camera, cacheDevice);
      const data = camera.data;
      const coordinates = 'latitude' in data ? data : undefined;
      if (coordinates)
        onLocation?.(camera.name, coordinates.latitude, coordinates.longitude);
      camera.onMotionStarted.subscribe(() =>
        onMotion(camera.name, coordinates?.latitude, coordinates?.longitude),
      );
    }
    for (const location of await api.getLocations()) {
      for (const sensor of await location.getDevices()) {
        sensor.onData.subscribe((data) => {
          cacheDevice(formatDevice(data)).catch(() =>
            console.error('Could not cache Ring device'),
          );
        });
      }
    }
    onReady?.(async () => {
      const { allCameras } = await api.fetchRingDevices();
      const cameras = await api.getCameras();
      for (const data of allCameras) {
        const camera = cameras.find((item) => item.id === data.id);
        if (camera) {
          camera.updateData(data);
          await cacheDevice(formatCamera(camera));
        }
      }
      for (const location of await api.getLocations())
        for (const asset of location.assets ?? [])
          await location.requestList('DeviceInfoDocGetList', asset.uuid);
      return 'Cameras refreshed; sensor updates requested';
    });
    console.info('Ring devices and cameras subscribed');
  } catch {
    rotation.unsubscribe();
    api.disconnect();
    console.error('Ring connection failed. Retrying in one minute.');
    setTimeout(
      () => void connectRing(cacheDevice, onMotion, onLocation, onReady),
      60000,
    );
  }
}

function formatDevice(data: RingDeviceData): device {
  return {
    name: data.name,
    id: data.zid,
    type: data.deviceType,
    status: data.faulted ? 'fault' : 'normal',
    onACPower: data.acStatus === 'ok',
    hasBrightness: false,
    hasVolume: false,
    vendor: 'ring',
    onTime: 0,
    lastUpdated: Date.now(),
  };
}

function formatCamera(camera: RingCamera): device {
  const data = camera.data;
  return {
    id: `camera:${camera.id}`,
    name: camera.name,
    type: String(camera.deviceType),
    status: data.alerts.connection,
    onACPower: !camera.operatingOnBattery,
    hasBrightness: camera.hasLight,
    hasVolume: false,
    vendor: 'ring',
    onTime: 0,
    lastUpdated: Date.now(),
  };
}

function subscribeCamera(camera: RingCamera, cacheDevice: ExternalDeviceCache) {
  camera.onData.subscribe(() => {
    void cacheDevice(formatCamera(camera)).catch(() =>
      console.error('Could not cache Ring camera'),
    );
  });
}
