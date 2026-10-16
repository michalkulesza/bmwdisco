import { Buffer } from 'buffer';

import { Platform, PermissionsAndroid } from 'react-native';

import { AndroidSerialTransport, listAndroidSerialDevices } from '../AndroidSerialTransport';

const listeners: Record<string, (event: unknown) => void> = {};
const remove = jest.fn();
const mockNative = {
  open: jest.fn(),
  write: jest.fn(),
  close: jest.fn(),
  listBondedDevices: jest.fn(),
  listUsbDevices: jest.fn(),
  addListener: jest.fn((name: string, listener: (event: unknown) => void) => {
    listeners[name] = listener;
    return { remove };
  }),
};
jest.mock('expo', () => ({
  requireNativeModule: () => mockNative,
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  Object.defineProperty(Platform, 'Version', { value: 33, configurable: true });
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
  mockNative.open.mockResolvedValue(undefined);
  mockNative.write.mockResolvedValue(undefined);
});

test('lists bonded devices after requesting Android 12 permission', async () => {
  mockNative.listBondedDevices.mockResolvedValue([{ id: 'MAC', name: 'OBD' }]);
  await expect(listAndroidSerialDevices('bluetooth')).resolves.toEqual([
    { id: 'MAC', name: 'OBD' },
  ]);
  expect(PermissionsAndroid.request).toHaveBeenCalledWith(
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  );
});

test('USB enumeration requires no Bluetooth permission', async () => {
  mockNative.listUsbDevices.mockResolvedValue([]);
  await expect(listAndroidSerialDevices('usb')).resolves.toEqual([]);
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
});

test('iOS never attempts native adapter access', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  await expect(listAndroidSerialDevices('bluetooth')).rejects.toMatchObject({
    code: 'profile-unsupported',
  });
  expect(mockNative.listBondedDevices).not.toHaveBeenCalled();
});

test('denied Bluetooth permission prevents opening', async () => {
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
  await expect(
    new AndroidSerialTransport({ kind: 'bluetooth', deviceId: 'MAC' }).open(),
  ).rejects.toMatchObject({ code: 'bluetooth-denied' });
  expect(mockNative.open).not.toHaveBeenCalled();
});

test('streams bytes, filters other connections, writes and releases listeners', async () => {
  const transport = new AndroidSerialTransport({ kind: 'usb', deviceId: '1:0' });
  const data = jest.fn();
  transport.onData(data);
  await transport.open();
  const id = mockNative.open.mock.calls[0]?.[0] as string;
  expect(mockNative.open).toHaveBeenCalledWith(id, 'usb', '1:0', 10000, 115200, 0);
  listeners.onData?.({ id: 'other', base64: 'AA==' });
  listeners.onData?.({ id, base64: Buffer.from([0, 255, 3]).toString('base64') });
  expect(data).toHaveBeenCalledTimes(1);
  expect(data).toHaveBeenCalledWith(new Uint8Array([0, 255, 3]));
  await transport.write(new Uint8Array([1, 2]));
  expect(mockNative.write).toHaveBeenCalledWith(id, 'AQI=');
  await transport.close();
  expect(remove).toHaveBeenCalledTimes(2);
  expect(mockNative.close).toHaveBeenCalledWith(id);
  await expect(transport.write(new Uint8Array())).rejects.toMatchObject({ code: 'closed' });
});

test('USB access failures are not reported as Bluetooth permission failures', async () => {
  mockNative.open.mockRejectedValue(new Error('USB permission denied'));
  await expect(
    new AndroidSerialTransport({ kind: 'usb', deviceId: '1:0' }).open(),
  ).rejects.toMatchObject({ code: 'connect-failed' });
});

test('abort closes pending native open and ignores a late success', async () => {
  let complete!: () => void;
  mockNative.open.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const controller = new AbortController();
  const transport = new AndroidSerialTransport({ kind: 'usb', deviceId: '1:0' });
  const opening = transport.open(controller.signal);
  await Promise.resolve();
  controller.abort();
  await expect(opening).rejects.toMatchObject({ code: 'cancelled' });
  complete();
  expect(mockNative.close).toHaveBeenCalled();
});

test('native disconnect emits one close and rejects subsequent writes', async () => {
  const transport = new AndroidSerialTransport({ kind: 'usb', deviceId: '1:0' });
  const closed = jest.fn();
  transport.onClose(closed);
  await transport.open();
  const id = mockNative.open.mock.calls[0]?.[0] as string;
  listeners.onClosed?.({ id, message: 'Detached' });
  listeners.onClosed?.({ id, message: 'Detached' });
  expect(closed).toHaveBeenCalledTimes(1);
  await expect(transport.write(new Uint8Array())).rejects.toMatchObject({ code: 'closed' });
});

test('timeout closes a native connection that does not finish opening', async () => {
  jest.useFakeTimers();
  try {
    mockNative.open.mockImplementation(() => new Promise(() => {}));
    const transport = new AndroidSerialTransport({
      kind: 'usb',
      deviceId: '1:0',
      connectTimeoutMs: 50,
    });
    const opening = transport.open();
    const failure = expect(opening).rejects.toMatchObject({ code: 'timeout' });
    await Promise.resolve();
    jest.advanceTimersByTime(50);
    await failure;
    expect(mockNative.close).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

test('write errors preserve transport error classification', async () => {
  mockNative.open.mockResolvedValue(undefined);
  mockNative.write.mockRejectedValue(new Error('USB detached'));
  const transport = new AndroidSerialTransport({ kind: 'usb', deviceId: '1:0' });
  await transport.open();
  await expect(transport.write(new Uint8Array([1]))).rejects.toMatchObject({
    code: 'write-failed',
  });
  await transport.close();
});

test('disconnect during open rejects immediately and late success cannot reopen it', async () => {
  let complete!: () => void;
  mockNative.open.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const transport = new AndroidSerialTransport({ kind: 'usb', deviceId: '1:0' });
  const opening = transport.open();
  await Promise.resolve();
  const id = mockNative.open.mock.calls[0]?.[0] as string;
  listeners.onClosed?.({ id, message: 'Detached' });
  await expect(opening).rejects.toMatchObject({ code: 'closed' });
  complete();
  await Promise.resolve();
  await expect(transport.write(new Uint8Array())).rejects.toMatchObject({ code: 'closed' });
});

test('Bluetooth powered off errors retain their actionable code', async () => {
  mockNative.listBondedDevices.mockRejectedValue(new Error('Bluetooth is turned off'));
  await expect(listAndroidSerialDevices('bluetooth')).rejects.toMatchObject({
    code: 'bluetooth-off',
  });
});
