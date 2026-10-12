import Storage from 'expo-sqlite/kv-store';
import { RememberedDevice } from './protocol/elm';

const KEY = 'bimmerdisco.bleDevice.v1';

export async function getRememberedDevice(): Promise<RememberedDevice | null> {
  try {
    const json = await Storage.getItem(KEY);
    if (json === null) return null;
    const value = JSON.parse(json) as Partial<RememberedDevice>;
    return typeof value.id === 'string' && value.id ? { id: value.id, name: typeof value.name === 'string' ? value.name : null } : null;
  } catch { return null; }
}

export const rememberDevice = (device: RememberedDevice) => Storage.setItem(KEY, JSON.stringify(device));
export const forgetDevice = () => Storage.removeItem(KEY);
