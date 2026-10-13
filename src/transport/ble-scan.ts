import { ensureBluetoothReady, getBleManager } from './ble-manager';
import { isKnownAdapterAdvert, scanServiceUuids, type BleAdvert } from './ble-profiles';

export interface BleScanOptions {
  onFound: (advert: BleAdvert) => void;
  signal: AbortSignal;
}

export const scanBleAdapters = async ({ onFound, signal }: BleScanOptions): Promise<void> => {
  const ble = getBleManager();
  await ensureBluetoothReady(ble);
  if (signal.aborted) return;

  const stop = () => void ble.stopDeviceScan().catch(() => undefined);
  signal.addEventListener('abort', stop, { once: true });

  await ble.startDeviceScan(scanServiceUuids(), null, (error, device) => {
    if (error) {
      stop();

      return;
    }
    if (!device) return;

    const advert: BleAdvert = {
      id: device.id,
      name: device.name ?? device.localName,
      rssi: device.rssi,
      serviceUuids: device.serviceUUIDs ?? [],
    };
    if (isKnownAdapterAdvert(advert)) onFound(advert);
  });
};
