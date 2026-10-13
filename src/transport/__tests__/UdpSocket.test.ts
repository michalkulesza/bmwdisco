import { ENET_DISCOVERY_HOST } from '@/link/discovery';

import { createUdpSocket } from '../UdpSocket';

type NativeListener = (event: { id: number; data: string; host: string }) => void;

const mockNative = {
  nativeListeners: new Set<NativeListener>(),
  open: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  getBroadcastAddresses: jest.fn(),
  addListener: jest.fn(),
};

jest.mock('../../../modules/bimmerdisco-udp', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

const emit = (event: { id: number; data: string; host: string }) =>
  mockNative.nativeListeners.forEach((listener) => listener(event));

describe('UdpSocket', () => {
  beforeEach(() => {
    mockNative.nativeListeners.clear();
    mockNative.open.mockReset().mockResolvedValue(7);
    mockNative.send.mockReset().mockResolvedValue(undefined);
    mockNative.close.mockReset();
    mockNative.getBroadcastAddresses.mockReset().mockReturnValue([]);
    mockNative.addListener.mockReset().mockImplementation((_name, listener: NativeListener) => {
      mockNative.nativeListeners.add(listener);

      return { remove: () => mockNative.nativeListeners.delete(listener) };
    });
  });

  it('sends bytes as base64 to a unicast host', async () => {
    const socket = await createUdpSocket();
    await socket.send(Uint8Array.of(0, 1, 0xff), '192.168.0.10', 6811);

    expect(mockNative.send).toHaveBeenCalledTimes(1);
    expect(mockNative.send).toHaveBeenCalledWith(7, 'AAH/', '192.168.0.10', 6811);
  });

  it('fans the link-local broadcast out to interface broadcast addresses once each', async () => {
    mockNative.getBroadcastAddresses.mockReturnValue(['192.168.1.255', ENET_DISCOVERY_HOST]);
    const socket = await createUdpSocket();
    await socket.send(Uint8Array.of(1), ENET_DISCOVERY_HOST, 6811);

    const hosts = mockNative.send.mock.calls.map((call) => call[2]);
    expect(hosts).toEqual([ENET_DISCOVERY_HOST, '192.168.1.255']);
  });

  it('succeeds when only some broadcast targets fail', async () => {
    mockNative.getBroadcastAddresses.mockReturnValue(['192.168.1.255']);
    mockNative.send.mockRejectedValueOnce(new Error('network unreachable'));
    const socket = await createUdpSocket();

    await expect(socket.send(Uint8Array.of(1), ENET_DISCOVERY_HOST, 6811)).resolves.toBeUndefined();
  });

  it('rejects when every target fails', async () => {
    mockNative.send.mockRejectedValue(new Error('network unreachable'));
    const socket = await createUdpSocket();

    await expect(socket.send(Uint8Array.of(1), ENET_DISCOVERY_HOST, 6811)).rejects.toThrow(
      'network unreachable',
    );
  });

  it('delivers decoded messages of its own socket id only', async () => {
    const socket = await createUdpSocket();
    const received: [number[], string][] = [];
    socket.onMessage((data, host) => received.push([[...data], host]));

    emit({ id: 8, data: 'AAH/', host: '10.0.0.1' });
    emit({ id: 7, data: 'AAH/', host: '169.254.1.5' });

    expect(received).toEqual([[[0, 1, 255], '169.254.1.5']]);
  });

  it('stops delivering after unsubscribe', async () => {
    const socket = await createUdpSocket();
    const listener = jest.fn();
    const unsubscribe = socket.onMessage(listener);
    unsubscribe();

    emit({ id: 7, data: 'AAH/', host: '169.254.1.5' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('closes idempotently and refuses to send afterwards', async () => {
    const socket = await createUdpSocket();
    const listener = jest.fn();
    socket.onMessage(listener);

    socket.close();
    socket.close();
    emit({ id: 7, data: 'AAH/', host: '169.254.1.5' });

    expect(mockNative.close).toHaveBeenCalledTimes(1);
    expect(mockNative.close).toHaveBeenCalledWith(7);
    expect(mockNative.nativeListeners.size).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    await expect(socket.send(Uint8Array.of(1), '10.0.0.1', 6811)).rejects.toThrow('closed');
  });
});
