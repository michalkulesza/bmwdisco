import { bytesToAscii } from '@/protocol/bytes';
import { encodeHsfzControl } from '@/protocol/hsfz';
import { isAllowedHost } from '@/transport/host';

export const ENET_DISCOVERY_HOST = '169.254.255.255';
export const ENET_DISCOVERY_PORT = 6811;

const DEFAULT_DISCOVERY_TIMEOUT_MS = 2000;
const VEHICLE_IDENT_REQUEST_TYPE = 0x11;
const ANNOUNCE_PATTERN = /DIAGADR(\d+)BMWMAC([0-9A-F]{12})BMWVIN([A-Z0-9]{17})/;

export interface EnetGateway {
  host: string;
  diagAddress: number;
  mac: string;
  vin: string;
}

export interface UdpSocketLike {
  send(data: Uint8Array, host: string, port: number): Promise<void>;
  onMessage(listener: (data: Uint8Array, fromHost: string) => void): () => void;
  close(): void;
}

export interface DiscoveryOptions {
  createSocket?: () => Promise<UdpSocketLike>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export const encodeDiscoveryRequest = (): Uint8Array =>
  encodeHsfzControl(VEHICLE_IDENT_REQUEST_TYPE);

export const parseDiscoveryResponse = (
  data: Uint8Array,
  fromHost: string,
): EnetGateway | undefined => {
  const match = ANNOUNCE_PATTERN.exec(bytesToAscii(data));
  if (!match || !isAllowedHost(fromHost)) return undefined;

  return { host: fromHost, diagAddress: Number(match[1]), mac: match[2]!, vin: match[3]! };
};

const waitFor = (timeoutMs: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    if (signal?.aborted) done();
    else signal?.addEventListener('abort', done, { once: true });
  });

export const discoverEnet = async (options: DiscoveryOptions = {}): Promise<EnetGateway[]> => {
  const { createSocket, timeoutMs = DEFAULT_DISCOVERY_TIMEOUT_MS, signal } = options;
  if (!createSocket) return [];

  const socket = await createSocket();
  const found = new Map<string, EnetGateway>();
  const stop = socket.onMessage((data, fromHost) => {
    const gateway = parseDiscoveryResponse(data, fromHost);
    if (gateway) found.set(gateway.host, gateway);
  });

  try {
    await socket.send(encodeDiscoveryRequest(), ENET_DISCOVERY_HOST, ENET_DISCOVERY_PORT);
    await waitFor(timeoutMs, signal);
  } finally {
    stop();
    socket.close();
  }

  return [...found.values()];
};
