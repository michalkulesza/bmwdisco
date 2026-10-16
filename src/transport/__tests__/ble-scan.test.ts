import { scanBleAdapters } from '../ble-scan';

import type { BleError, Device } from 'react-native-ble-plx';

const mockBle = {
  startDeviceScan: jest.fn(),
  stopDeviceScan: jest.fn(),
};
const mockReady = jest.fn();

jest.mock('../ble-manager', () => ({
  getBleManager: () => mockBle,
  ensureBluetoothReady: () => mockReady(),
}));

describe('BLE scan lifecycle', () => {
  let callback: (error: BleError | null, device: Device | null) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    mockReady.mockReset().mockResolvedValue(undefined);
    mockBle.stopDeviceScan.mockReset().mockResolvedValue(undefined);
    mockBle.startDeviceScan.mockReset().mockImplementation((_services, _options, listener) => {
      callback = listener;

      return Promise.resolve();
    });
  });

  afterEach(() => jest.useRealTimers());

  const start = async () => {
    const controller = new AbortController();
    const onFound = jest.fn();
    const result = scanBleAdapters({ signal: controller.signal, onFound, timeoutMs: 100 });
    await Promise.resolve();

    return { controller, onFound, result };
  };

  it('propagates asynchronous native failures and stops the scan', async () => {
    const { result } = await start();
    const rejected = expect(result).rejects.toMatchObject({ code: 'connect-failed' });
    callback({ message: 'scan failed' } as BleError, null);
    await rejected;
    expect(mockBle.stopDeviceScan).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ends an empty scan with a retryable error', async () => {
    const { result } = await start();
    const rejected = expect(result).rejects.toMatchObject({ code: 'no-adapter' });
    await jest.advanceTimersByTimeAsync(100);
    await rejected;
    expect(mockBle.stopDeviceScan).toHaveBeenCalledTimes(1);
  });

  it('retains discovered adapters when the bounded scan finishes', async () => {
    const { result, onFound } = await start();
    callback(null, { id: 'icar', name: 'Vgate', rssi: -40, serviceUUIDs: ['ffe0'] } as Device);
    expect(onFound).toHaveBeenCalledWith(expect.objectContaining({ id: 'icar' }));
    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBeUndefined();
    expect(mockBle.stopDeviceScan).toHaveBeenCalledTimes(1);
  });

  it('cleans up on cancellation and ignores late callbacks', async () => {
    const { controller, result, onFound } = await start();
    controller.abort();
    await result;
    callback(null, { id: 'late', serviceUUIDs: ['ffe0'] } as Device);
    expect(onFound).not.toHaveBeenCalled();
    expect(mockBle.stopDeviceScan).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not request Bluetooth readiness for an already cancelled scan', async () => {
    const controller = new AbortController();
    controller.abort();
    await scanBleAdapters({ signal: controller.signal, onFound: jest.fn() });
    expect(mockReady).not.toHaveBeenCalled();
    expect(mockBle.startDeviceScan).not.toHaveBeenCalled();
  });

  it('propagates scan startup rejection and removes its timeout', async () => {
    mockBle.startDeviceScan.mockRejectedValueOnce(new Error('startup failed'));
    const { result } = await start();
    await expect(result).rejects.toThrow('startup failed');
    expect(mockBle.stopDeviceScan).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
