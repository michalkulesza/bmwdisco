import { ensureBluetoothReady, getBleManager } from './ble-manager';
import { isKnownAdapterAdvert, scanServiceUuids, type BleAdvert } from './ble-profiles';
import { TransportError } from './errors';

const SCAN_TIMEOUT_MS = 15000;

export interface BleScanOptions {
  onFound: (advert: BleAdvert) => void;
  signal: AbortSignal;
  timeoutMs?: number;
}

export const scanBleAdapters = async ({
  onFound,
  signal,
  timeoutMs = SCAN_TIMEOUT_MS,
}: BleScanOptions): Promise<void> => {
  if (signal.aborted) return;
  const ble = getBleManager();
  await ensureBluetoothReady(ble);
  if (signal.aborted) return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let found = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      void ble.stopDeviceScan().catch(() => undefined);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish();
    const timer = setTimeout(
      () => finish(found ? undefined : new TransportError('no-adapter')),
      timeoutMs,
    );
    signal.addEventListener('abort', onAbort, { once: true });

    void ble
      .startDeviceScan(scanServiceUuids(), null, (error, device) => {
        if (settled) return;
        if (error) {
          finish(new TransportError('connect-failed', error.message, { cause: error }));

          return;
        }
        if (!device) return;

        const advert: BleAdvert = {
          id: device.id,
          name: device.name ?? device.localName,
          rssi: device.rssi,
          serviceUuids: device.serviceUUIDs ?? [],
        };
        if (isKnownAdapterAdvert(advert)) {
          found = true;
          onFound(advert);
        }
      })
      .catch(finish);
  });
};
