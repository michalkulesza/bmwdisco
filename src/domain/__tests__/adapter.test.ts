import { createLink, type AdapterConfig, type LinkFactoryDeps } from '@/domain/adapter/create-link';
import { nativeLinkDeps } from '@/domain/adapter/native-deps';
import { openNewLink, pinResolvedHost } from '@/domain/session/actors';
import type { SessionDeps } from '@/domain/session/types';
import { ElmIsoTpLink } from '@/link/elm-isotp-link';
import { HsfzLink } from '@/link/hsfz-link';
import { SimLink } from '@/link/sim-link';
import { ThorLink } from '@/link/thor-link';
import { makeVehicle } from '@/test-utils/domain-sim';
import { FakeTransport } from '@/test-utils/fake-transport';
import { TransportError } from '@/transport/errors';

jest.mock('@/transport/TcpTransport', () => ({
  TcpTransport: class {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  },
}));
jest.mock('@/transport/UdpSocket', () => ({ createUdpSocket: jest.fn() }));
jest.mock('@/transport/BleTransport', () => ({
  BleTransport: class {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  },
}));

const makeDeps = (overrides: Partial<LinkFactoryDeps> = {}) => {
  const tcp: [string, number][] = [];
  const ble: string[] = [];
  const deps: LinkFactoryDeps = {
    createTcpTransport: (host, port) => {
      tcp.push([host, port]);

      return new FakeTransport();
    },
    createBleTransport: (deviceId) => {
      ble.push(deviceId);

      return new FakeTransport();
    },
    ...overrides,
  };

  return { deps, tcp, ble };
};

describe('createLink', () => {
  it('builds an HSFZ link on 6801 for an ENET host', async () => {
    const { deps, tcp } = makeDeps();

    const link = await createLink({ adapter: 'enet', host: '169.254.10.1' }, deps);

    expect(link).toBeInstanceOf(HsfzLink);
    expect(tcp).toEqual([['169.254.10.1', 6801]]);
  });

  it('falls back to discovery when no ENET host is given', async () => {
    const discover = jest.fn(async () => [
      { host: '169.254.5.5', diagAddress: 1, mac: 'AA', vin: 'V' },
    ]);
    const { deps, tcp } = makeDeps({ discover });

    await createLink({ adapter: 'enet' }, deps);

    expect(tcp).toEqual([['169.254.5.5', 6801]]);
    expect(discover).toHaveBeenCalledTimes(1);
  });

  it('uses discoverEnet with the injected UDP socket factory by default', async () => {
    const createUdpSocket = jest.fn(async () => {
      throw new Error('EHOSTUNREACH');
    });
    const { deps } = makeDeps({ createUdpSocket });

    await expect(createLink({ adapter: 'enet' }, deps)).rejects.toMatchObject({
      code: 'no-adapter',
    });
    expect(createUdpSocket).toHaveBeenCalled();
  });

  it('tells the user to enter an IP when discovery finds nothing', async () => {
    const { deps } = makeDeps();

    await expect(createLink({ adapter: 'enet' }, deps)).rejects.toMatchObject({
      code: 'no-adapter',
    });
  });

  it.each([
    [{ adapter: 'enet', host: '8.8.8.8' } as const],
    [{ adapter: 'thor', host: 'example.com' } as const],
  ])('rejects public hosts for %j', async (config) => {
    await expect(createLink(config, makeDeps().deps)).rejects.toMatchObject({
      code: 'invalid-host',
    });
  });

  it('builds a Thor link on port 23 by default and honours an override', async () => {
    const { deps, tcp } = makeDeps();

    const link = await createLink({ adapter: 'thor', host: '192.168.0.10' }, deps);
    await createLink({ adapter: 'thor', host: '192.168.0.10', port: 2323 }, deps);

    expect(link).toBeInstanceOf(ThorLink);
    expect(tcp).toEqual([
      ['192.168.0.10', 23],
      ['192.168.0.10', 2323],
    ]);
  });

  it('builds an ELM link over BLE for an iCar', async () => {
    const { deps, ble } = makeDeps();

    const link = await createLink({ adapter: 'icar', deviceId: 'AA:BB' }, deps);

    expect(link).toBeInstanceOf(ElmIsoTpLink);
    expect(ble).toEqual(['AA:BB']);
  });

  it('builds Android Classic ELM and USB BMW-FAST links with independent transports', async () => {
    const createSerialTransport = jest.fn(() => new FakeTransport());
    const { deps } = makeDeps({ createSerialTransport });
    expect(await createLink({ adapter: 'elm-bluetooth', deviceId: 'paired' }, deps)).toBeInstanceOf(
      ElmIsoTpLink,
    );
    expect(await createLink({ adapter: 'usb', deviceId: '1:0' }, deps)).toBeInstanceOf(ThorLink);
    expect(createSerialTransport.mock.calls).toEqual([
      ['bluetooth', 'paired'],
      ['usb', '1:0'],
    ]);
  });

  it.each(['elm-bluetooth', 'usb'] as const)(
    'rejects unavailable Android serial transport %s',
    async (adapter) => {
      await expect(
        createLink({ adapter, deviceId: 'device' }, makeDeps().deps),
      ).rejects.toMatchObject({ code: 'no-adapter' });
    },
  );

  it('builds ELM Wi-Fi separately from the Thor binary protocol', async () => {
    const { deps, tcp } = makeDeps();
    expect(
      await createLink({ adapter: 'elm-wifi', host: '192.168.0.10', port: 35000 }, deps),
    ).toBeInstanceOf(ElmIsoTpLink);
    expect(tcp).toEqual([['192.168.0.10', 35000]]);
    await expect(
      createLink({ adapter: 'elm-wifi', host: '8.8.8.8', port: 35000 }, deps),
    ).rejects.toMatchObject({ code: 'invalid-host' });
    await expect(
      createLink({ adapter: 'elm-wifi', host: '192.168.0.10', port: 65536 }, deps),
    ).rejects.toMatchObject({ code: 'no-adapter' });
  });

  it('builds a simulated link with faults applied', async () => {
    const vehicle = makeVehicle('F20');
    const createVehicle = jest.fn(() => vehicle);

    const link = await createLink(
      { adapter: 'demo', chassis: 'F20', faults: { ignitionOff: true }, seed: 3 },
      makeDeps({ createVehicle }).deps,
    );

    expect(link).toBeInstanceOf(SimLink);
    expect(createVehicle).toHaveBeenCalledWith('F20', 3);
    expect(vehicle.faults.plan(0x22).action).toBe('silent');
  });

  it('creates its own vehicle by default', async () => {
    const link = await createLink({ adapter: 'demo', chassis: 'F10' }, makeDeps().deps);

    await link.open();
    expect(link.state).toBe('open');
  });
});

describe('nativeLinkDeps', () => {
  it('constructs the native transports with the right options', () => {
    expect(nativeLinkDeps.createTcpTransport('10.0.0.1', 6801)).toMatchObject({
      options: { host: '10.0.0.1', port: 6801 },
    });
    expect(nativeLinkDeps.createBleTransport('dev')).toMatchObject({
      options: { deviceId: 'dev' },
    });
  });
});

describe('ENET preferred host', () => {
  const GATEWAY = { host: '169.254.5.5', diagAddress: 1, mac: 'AA', vin: 'V' };

  const makeSessionDeps = (failingHosts: string[], discover = jest.fn(async () => [GATEWAY])) => {
    const hosts: string[] = [];
    const { deps } = makeDeps({
      discover,
      createTcpTransport: (host) => {
        hosts.push(host);
        const transport = new FakeTransport();
        if (failingHosts.includes(host)) transport.openError = new TransportError('connect-failed');

        return transport;
      },
    });

    return {
      hosts,
      discover,
      sessionDeps: {
        createLink: (config: AdapterConfig, signal?: AbortSignal) =>
          createLink(config, deps, signal),
        appState: { subscribe: () => () => undefined },
      } satisfies SessionDeps,
    };
  };

  it('exposes the host the link was built for', async () => {
    const { deps } = makeDeps();

    const manual = await createLink({ adapter: 'enet', host: '169.254.10.1' }, deps);
    const discovered = await createLink(
      { adapter: 'enet' },
      makeDeps({ discover: async () => [GATEWAY] }).deps,
    );

    expect(manual.host).toBe('169.254.10.1');
    expect(discovered.host).toBe('169.254.5.5');
  });

  it('tries the preferred host first and skips discovery when it connects', async () => {
    const { hosts, discover, sessionDeps } = makeSessionDeps([]);

    const link = await openNewLink(sessionDeps, { adapter: 'enet', preferredHost: '169.254.9.9' });

    expect(link.host).toBe('169.254.9.9');
    expect(hosts).toEqual(['169.254.9.9']);
    expect(discover).not.toHaveBeenCalled();
  });

  it('falls back to discovery when the preferred host fails', async () => {
    const { hosts, discover, sessionDeps } = makeSessionDeps(['169.254.9.9']);

    const link = await openNewLink(sessionDeps, { adapter: 'enet', preferredHost: '169.254.9.9' });

    expect(link.host).toBe('169.254.5.5');
    expect(hosts).toEqual(['169.254.9.9', '169.254.5.5']);
    expect(discover).toHaveBeenCalledTimes(1);
  });

  it('does not fall back after a cancel', async () => {
    const { hosts, sessionDeps } = makeSessionDeps(['169.254.9.9']);
    const controller = new AbortController();
    controller.abort();

    await expect(
      openNewLink(
        sessionDeps,
        { adapter: 'enet', preferredHost: '169.254.9.9' },
        controller.signal,
      ),
    ).rejects.toBeDefined();
    expect(hosts).toEqual(['169.254.9.9']);
  });

  it('never falls back when a manual host is set', async () => {
    const { hosts, discover, sessionDeps } = makeSessionDeps(['169.254.1.1']);

    await expect(
      openNewLink(sessionDeps, {
        adapter: 'enet',
        host: '169.254.1.1',
        preferredHost: '169.254.9.9',
      }),
    ).rejects.toBeDefined();
    expect(hosts).toEqual(['169.254.1.1']);
    expect(discover).not.toHaveBeenCalled();
  });

  it('pins the resolved host only for ENET configs without a manual host', async () => {
    const { deps } = makeDeps({ discover: async () => [GATEWAY] });
    const link = await createLink({ adapter: 'enet' }, deps);

    expect(pinResolvedHost({ adapter: 'enet' }, link)).toEqual({
      adapter: 'enet',
      preferredHost: '169.254.5.5',
    });
    expect(pinResolvedHost({ adapter: 'enet', host: '169.254.1.1' }, link)).toEqual({
      adapter: 'enet',
      host: '169.254.1.1',
    });
    const demo: AdapterConfig = { adapter: 'demo', chassis: 'F20' };
    expect(pinResolvedHost(demo, link)).toBe(demo);
    expect(pinResolvedHost({ adapter: 'enet' }, await createLink(demo, deps))).toEqual({
      adapter: 'enet',
    });
  });
});
