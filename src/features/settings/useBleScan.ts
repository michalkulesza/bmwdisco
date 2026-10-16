import { useCallback, useEffect, useState } from 'react';

import { toErrorReason, type ConnectErrorReason } from '@/features/connect/helpers';
import type { BleAdvert } from '@/transport/ble-profiles';

const BLUETOOTH_REASONS: Record<string, ConnectErrorReason> = {
  'bluetooth-off': 'bluetoothOff',
  'bluetooth-denied': 'bluetoothDenied',
};

const reasonOf = (error: unknown): ConnectErrorReason => {
  const code = (error as { code?: string } | null)?.code ?? '';

  return BLUETOOTH_REASONS[code] ?? toErrorReason(undefined);
};

const loadScanner = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/transport/ble-scan') as typeof import('@/transport/ble-scan')).scanBleAdapters;

const upsert = (devices: BleAdvert[], advert: BleAdvert): BleAdvert[] => {
  const others = devices.filter((device) => device.id !== advert.id);

  return [...others, advert].sort((a, b) => (b.rssi ?? -127) - (a.rssi ?? -127));
};

export const useBleScan = () => {
  const [devices, setDevices] = useState<BleAdvert[]>([]);
  const [error, setError] = useState<ConnectErrorReason>();
  const [attempt, setAttempt] = useState(0);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    loadScanner()({
      signal: controller.signal,
      onFound: (advert) => setDevices((current) => upsert(current, advert)),
    })
      .catch((scanError: unknown) => {
        if (!controller.signal.aborted) setError(reasonOf(scanError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setScanning(false);
      });

    return () => controller.abort();
  }, [attempt]);

  const rescan = useCallback(() => {
    setDevices([]);
    setError(undefined);
    setScanning(true);
    setAttempt((current) => current + 1);
  }, []);

  return { devices, error, rescan, scanning };
};
