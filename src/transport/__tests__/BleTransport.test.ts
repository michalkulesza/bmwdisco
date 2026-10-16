import { Buffer } from 'buffer';

import { Platform } from 'react-native';

import { BleTransport } from '../BleTransport';

import type { BleError, Characteristic } from 'react-native-ble-plx';

const mockManager = { connectToDevice: jest.fn(), cancelDeviceConnection: jest.fn() };
const mockReady = jest.fn();
jest.mock('../ble-manager', () => ({
  getBleManager: () => mockManager,
  ensureBluetoothReady: () => mockReady(),
}));

describe('BleTransport', () => {
  let notify: (error: BleError | null, characteristic: Characteristic | null) => void;
  const removeNotify = jest.fn();
  const removeDisconnect = jest.fn();
  const writer = {
    uuid: 'fff2',
    isWritableWithResponse: true,
    isWritableWithoutResponse: true,
    isNotifiable: false,
    writeWithResponse: jest.fn(),
    writeWithoutResponse: jest.fn(),
  };
  const notifier = {
    uuid: 'fff1',
    isWritableWithResponse: false,
    isWritableWithoutResponse: false,
    isNotifiable: true,
    monitor: jest.fn(),
  };
  const service = { uuid: 'fff0', characteristics: jest.fn() };
  const device = {
    mtu: 185,
    requestMTU: jest.fn(),
    discoverAllServicesAndCharacteristics: jest.fn(),
    services: jest.fn(),
    onDisconnected: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'android');
    writer.isWritableWithResponse = true;
    writer.isWritableWithoutResponse = true;
    writer.writeWithResponse.mockResolvedValue(undefined);
    writer.writeWithoutResponse.mockResolvedValue(undefined);
    mockReady.mockResolvedValue(undefined);
    mockManager.connectToDevice.mockReset().mockResolvedValue(device);
    mockManager.cancelDeviceConnection.mockResolvedValue(undefined);
    device.discoverAllServicesAndCharacteristics.mockResolvedValue(device);
    device.services.mockResolvedValue([service]);
    device.onDisconnected.mockReturnValue({ remove: removeDisconnect });
    service.uuid = 'fff0';
    service.characteristics.mockResolvedValue([writer, notifier]);
    notifier.monitor.mockImplementation((callback) => {
      notify = callback;
      return { remove: removeNotify };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses FFF0 serial with default MTU and acknowledged 20-byte Android writes', async () => {
    const transport = new BleTransport({ deviceId: 'AA:BB' });
    const received = jest.fn();
    transport.onData(received);
    await transport.open();
    await transport.write(new Uint8Array(45));
    expect(device.requestMTU).not.toHaveBeenCalled();
    expect(
      writer.writeWithResponse.mock.calls.map(([value]) => Buffer.from(value, 'base64').length),
    ).toEqual([20, 20, 5]);
    expect(writer.writeWithoutResponse).not.toHaveBeenCalled();
    notify(null, { value: Buffer.from('OK\r>').toString('base64') } as Characteristic);
    expect(received).toHaveBeenCalledWith(new Uint8Array(Buffer.from('OK\r>')));
    await transport.close();
  });

  it('preserves iOS MTU sizing and without-response preference', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const transport = new BleTransport({ deviceId: 'ios-id' });
    await transport.open();
    await transport.write(new Uint8Array(200));
    expect(
      writer.writeWithoutResponse.mock.calls.map(([value]) => Buffer.from(value, 'base64').length),
    ).toEqual([182, 18]);
    expect(writer.writeWithResponse).not.toHaveBeenCalled();
    expect(device.requestMTU).not.toHaveBeenCalled();
    await transport.close();
  });

  it('falls back to without-response when Android characteristic requires it', async () => {
    writer.isWritableWithResponse = false;
    const transport = new BleTransport({ deviceId: 'AA:BB' });
    await transport.open();
    await transport.write(Uint8Array.of(1));
    expect(writer.writeWithoutResponse).toHaveBeenCalledTimes(1);
    await transport.close();
  });

  it('rejects unknown services and releases connection resources', async () => {
    service.uuid = '180f';
    const transport = new BleTransport({ deviceId: 'AA:BB' });
    await expect(transport.open()).rejects.toMatchObject({ code: 'profile-unsupported' });
    expect(removeDisconnect).toHaveBeenCalledTimes(1);
    expect(mockManager.cancelDeviceConnection).toHaveBeenCalledWith('AA:BB');
  });

  it('cancels an in-flight connection and reports cancellation', async () => {
    let rejectConnection: (error: Error) => void = () => undefined;
    mockManager.connectToDevice.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectConnection = reject;
        }),
    );
    const transport = new BleTransport({ deviceId: 'AA:BB' });
    const controller = new AbortController();
    const opening = transport.open(controller.signal);
    await Promise.resolve();
    controller.abort();
    rejectConnection(new Error('cancelled by native'));
    await expect(opening).rejects.toMatchObject({ code: 'cancelled' });
    expect(mockManager.cancelDeviceConnection).toHaveBeenCalledWith('AA:BB');
  });

  it('reports notification failure once and removes subscriptions', async () => {
    const transport = new BleTransport({ deviceId: 'AA:BB' });
    const closed = jest.fn();
    transport.onClose(closed);
    await transport.open();
    notify({ message: 'lost' } as BleError, null);
    notify({ message: 'late' } as BleError, null);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(removeNotify).toHaveBeenCalledTimes(1);
    expect(removeDisconnect).toHaveBeenCalledTimes(1);
    await expect(transport.write(Uint8Array.of(1))).rejects.toMatchObject({ code: 'closed' });
  });

  it('rejects cancellation even if native connect resolves after cancellation', async () => {
    let finishConnect!: (value: typeof device) => void;
    mockManager.connectToDevice.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishConnect = resolve;
        }),
    );
    const controller = new AbortController();
    const transport = new BleTransport({ deviceId: 'AA:BB' });
    const opening = transport.open(controller.signal);
    await Promise.resolve();
    controller.abort();
    finishConnect(device);
    await expect(opening).rejects.toMatchObject({ code: 'cancelled' });
    expect(notifier.monitor).not.toHaveBeenCalled();
  });
});
