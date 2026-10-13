import { bytesToAscii, asciiToBytes } from '@/protocol/bytes';
import { TransportError } from '@/transport/errors';

import {
  discoverEnet,
  ENET_DISCOVERY_HOST,
  ENET_DISCOVERY_PORT,
  encodeDiscoveryRequest,
  parseDiscoveryResponse,
  type UdpSocketLike,
} from '../discovery';
import { mapTransportError } from '../map-transport-error';

const announcement = (vin = 'WBA1234567890ABCD') =>
  asciiToBytes(`DIAGADR10BMWMAC0019AB123456BMWVIN${vin}`);

const fakeSocket = (replies: [Uint8Array, string][]) => {
  const listeners: ((data: Uint8Array, from: string) => void)[] = [];
  const socket: UdpSocketLike & { sent: unknown[]; closed: boolean } = {
    sent: [],
    closed: false,
    async send(data, host, port) {
      this.sent.push({ data, host, port });
      for (const [payload, from] of replies)
        listeners.forEach((listener) => listener(payload, from));
    },
    onMessage(listener) {
      listeners.push(listener);

      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    close() {
      this.closed = true;
    },
  };

  return socket;
};

describe('discoverEnet', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns an empty list when no UDP implementation is available', async () => {
    await expect(discoverEnet()).resolves.toEqual([]);
  });

  it('broadcasts to the link-local address and collects announcements', async () => {
    const socket = fakeSocket([
      [announcement(), '169.254.10.20'],
      [announcement(), '169.254.10.20'],
      [announcement('WBA0000000000EFGH'), '192.168.0.9'],
      [announcement('WBA1111111111IJKL'), '8.8.8.8'],
      [asciiToBytes('noise'), '169.254.1.1'],
    ]);

    const pending = discoverEnet({ createSocket: async () => socket, timeoutMs: 500 });
    await jest.advanceTimersByTimeAsync(500);
    const gateways = await pending;

    expect(socket.sent[0]).toMatchObject({ host: ENET_DISCOVERY_HOST, port: ENET_DISCOVERY_PORT });
    expect(gateways.map((gateway) => gateway.host)).toEqual(['169.254.10.20', '192.168.0.9']);
    expect(gateways[0]).toMatchObject({ diagAddress: 10, mac: '0019AB123456' });
    expect(socket.closed).toBe(true);
  });

  it('stops early when aborted', async () => {
    const socket = fakeSocket([]);
    const controller = new AbortController();

    const pending = discoverEnet({ createSocket: async () => socket, signal: controller.signal });
    await jest.advanceTimersByTimeAsync(10);
    controller.abort();

    await expect(pending).resolves.toEqual([]);
    expect(socket.closed).toBe(true);
  });

  it('returns immediately when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      discoverEnet({ createSocket: async () => fakeSocket([]), signal: controller.signal }),
    ).resolves.toEqual([]);
  });

  it('encodes a vehicle identification request', () => {
    expect(encodeDiscoveryRequest()).toEqual(Uint8Array.of(0, 0, 0, 0, 0, 0x11));
    expect(bytesToAscii(announcement())).toContain('DIAGADR10');
    expect(parseDiscoveryResponse(announcement(), '10.0.0.1')?.vin).toBe('WBA1234567890ABCD');
  });
});

describe('mapTransportError', () => {
  it.each([
    ['timeout', 'TimeoutError'],
    ['cancelled', 'CancelledError'],
    ['closed', 'LinkClosedError'],
    ['write-failed', 'LinkClosedError'],
    ['connect-failed', 'AdapterError'],
    ['invalid-host', 'AdapterError'],
    ['bluetooth-off', 'AdapterError'],
    ['profile-unsupported', 'AdapterError'],
  ] as const)('maps %s', (code, name) => {
    expect(mapTransportError(new TransportError(code)).name).toBe(name);
  });

  it('passes other errors through', () => {
    const original = new Error('x');

    expect(mapTransportError(original)).toBe(original);
    expect(mapTransportError('plain').message).toBe('plain');
  });
});
