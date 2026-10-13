import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State, type Subscription } from 'react-native-ble-plx';

import { TransportError } from './errors';

const POWER_ON_TIMEOUT_MS = 30000;
const ANDROID_SCAN_CONNECT_API = 31;

let manager: BleManager | undefined;

export const getBleManager = (): BleManager => {
  manager ??= new BleManager();

  return manager;
};

export const destroyBleManager = async (): Promise<void> => {
  const current = manager;
  manager = undefined;
  await current?.destroy();
};

const requestAndroidPermissions = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const needed =
    Number(Platform.Version) >= ANDROID_SCAN_CONNECT_API
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const results = await PermissionsAndroid.requestMultiple(needed);
  const denied = needed.some(
    (permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied) throw new TransportError('bluetooth-denied', 'Bluetooth permission denied');
};

const STATE_ERRORS: Partial<Record<State, TransportError>> = {
  [State.PoweredOff]: new TransportError('bluetooth-off', 'Bluetooth is turned off'),
  [State.Unauthorized]: new TransportError('bluetooth-denied', 'Bluetooth access is denied'),
  [State.Unsupported]: new TransportError('bluetooth-unsupported', 'Bluetooth LE is not available'),
};

export const ensureBluetoothReady = async (ble: BleManager): Promise<void> => {
  await requestAndroidPermissions();

  await new Promise<void>((resolve, reject) => {
    let subscription: Subscription | undefined;
    let settled = false;

    const finish = (error?: TransportError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.remove();
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(
      () => finish(new TransportError('timeout', 'Bluetooth did not become ready')),
      POWER_ON_TIMEOUT_MS,
    );

    subscription = ble.onStateChange((state) => {
      const failure = STATE_ERRORS[state];
      if (state === State.PoweredOn) finish();
      else if (failure) finish(failure);
    }, true);

    if (settled) subscription.remove();
  });
};
