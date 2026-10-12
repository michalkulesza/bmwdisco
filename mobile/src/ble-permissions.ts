import { PermissionsAndroid, Platform } from 'react-native';

const ANDROID_12 = 31;

export async function ensureBlePermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const permissions = Number(Platform.Version) >= ANDROID_12
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  if (permissions.some(permission => results[permission] !== PermissionsAndroid.RESULTS.GRANTED)) {
    throw new Error('Bluetooth permission denied. Allow Nearby devices (or Location on Android 11 and older) for BimmerDisco in system settings.');
  }
}
