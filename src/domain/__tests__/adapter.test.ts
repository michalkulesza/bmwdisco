import { createLink, type LinkFactoryDeps } from '@/domain/adapter/create-link';
import { nativeLinkDeps } from '@/domain/adapter/native-deps';
import { ElmIsoTpLink } from '@/link/elm-isotp-link';
import { HsfzLink } from '@/link/hsfz-link';
import { SimLink } from '@/link/sim-link';
import { ThorLink } from '@/link/thor-link';
import { AdapterError } from '@/protocol/errors';
import { makeVehicle } from '@/test-utils/domain-sim';
import { FakeTransport } from '@/test-utils/fake-transport';

jest.mock('@/transport/TcpTransport', () => ({
  TcpTransport: class {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  },
}));
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
      throw new AdapterError('no-adapter');
    });
    const { deps } = makeDeps({ createUdpSocket });

    await expect(createLink({ adapter: 'enet' }, deps)).rejects.toBeInstanceOf(AdapterError);
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
