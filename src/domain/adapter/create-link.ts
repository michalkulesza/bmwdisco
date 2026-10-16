import { discoverEnet, type EnetGateway, type UdpSocketLike } from '@/link/discovery';
import { ElmIsoTpLink, type ElmProfile } from '@/link/elm-isotp-link';
import { HsfzLink, ENET_PORT } from '@/link/hsfz-link';
import { SimLink } from '@/link/sim-link';
import { THOR_PORT, ThorLink } from '@/link/thor-link';
import type { DiagnosticLink } from '@/link/types';
import { AdapterError } from '@/protocol/errors';
import type { FaultOptions } from '@/simulator/faults';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import { assertAllowedHost } from '@/transport/host';
import type { Transport } from '@/transport/types';

export type AdapterConfig =
  | { adapter: 'enet'; host?: string; preferredHost?: string }
  | { adapter: 'thor'; host: string; port?: number }
  | { adapter: 'icar'; deviceId: string }
  | { adapter: 'elm-bluetooth'; deviceId: string }
  | { adapter: 'elm-wifi'; host: string; port: number }
  | { adapter: 'usb'; deviceId: string }
  | { adapter: 'demo'; chassis: string; faults?: FaultOptions; seed?: number };

export type AdapterId = AdapterConfig['adapter'];

export interface LinkFactoryDeps {
  createTcpTransport(host: string, port: number): Transport;
  createBleTransport(deviceId: string): Transport;
  createSerialTransport?: (kind: 'bluetooth' | 'usb', deviceId: string) => Transport;
  elmProfile?: ElmProfile;
  createUdpSocket?: () => Promise<UdpSocketLike>;
  discover?: (signal?: AbortSignal) => Promise<EnetGateway[]>;
  createVehicle?: (chassis: string, seed?: number) => SimulatedVehicle;
}

const defaultVehicle = (chassis: string, seed?: number): SimulatedVehicle =>
  new SimulatedVehicle({ profile: chassis, seed });

const resolveEnetHost = async (
  host: string | undefined,
  deps: LinkFactoryDeps,
  signal?: AbortSignal,
): Promise<string> => {
  if (host) return host;

  const discover =
    deps.discover ??
    ((discoverySignal?: AbortSignal) =>
      discoverEnet({ createSocket: deps.createUdpSocket, signal: discoverySignal }));
  const [gateway] = await discover(signal).catch((): EnetGateway[] => []);
  if (!gateway) throw new AdapterError('no-adapter', 'No ENET gateway found; enter its IP address');

  return gateway.host;
};

const assertHost = (host: string): void => {
  try {
    assertAllowedHost(host);
  } catch {
    throw new AdapterError('invalid-host', 'Only private or link-local IPv4 addresses are allowed');
  }
};

export const createLink = async (
  config: AdapterConfig,
  deps: LinkFactoryDeps,
  signal?: AbortSignal,
): Promise<DiagnosticLink> => {
  switch (config.adapter) {
    case 'enet': {
      const host = await resolveEnetHost(config.host, deps, signal);
      assertHost(host);

      return new HsfzLink(deps.createTcpTransport(host, ENET_PORT), host);
    }
    case 'thor': {
      assertHost(config.host);

      return new ThorLink(deps.createTcpTransport(config.host, config.port ?? THOR_PORT));
    }
    case 'icar':
      return new ElmIsoTpLink(deps.createBleTransport(config.deviceId), {}, deps.elmProfile);
    case 'elm-bluetooth': {
      if (!deps.createSerialTransport)
        throw new AdapterError('no-adapter', 'Android Bluetooth is unavailable');
      return new ElmIsoTpLink(
        deps.createSerialTransport('bluetooth', config.deviceId),
        {},
        'android-mode2',
      );
    }
    case 'elm-wifi': {
      assertHost(config.host);
      if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
        throw new AdapterError('no-adapter', 'Invalid adapter port');
      }
      return new ElmIsoTpLink(
        deps.createTcpTransport(config.host, config.port),
        {},
        'android-mode2',
      );
    }
    case 'usb': {
      if (!deps.createSerialTransport)
        throw new AdapterError('no-adapter', 'Android USB is unavailable');
      return new ThorLink(deps.createSerialTransport('usb', config.deviceId));
    }
    case 'demo': {
      const vehicle = (deps.createVehicle ?? defaultVehicle)(config.chassis, config.seed);
      if (config.faults) vehicle.faults.configure(config.faults);

      return new SimLink(vehicle);
    }
  }
};
