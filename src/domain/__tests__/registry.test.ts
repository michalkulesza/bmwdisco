import { IDENTIFICATION } from '@/data/generated';
import { CarNotRespondingError, UnsupportedVehicleError } from '@/domain/errors';
import { createLinkProvider, detectCar, ModuleRegistry } from '@/domain/registry/detect-car';
import type { DiagnosticLink } from '@/link/types';
import { createProfile, knownChassis } from '@/simulator/profiles';
import { detectOnSim, makeVehicle, openSimLink, PROBE_TIMEOUT_MS } from '@/test-utils/domain-sim';

const identityOf = (address: number, sgbd?: string): Uint8Array => {
  const entry = IDENTIFICATION.find(
    (candidate) =>
      candidate.adrIndex === address && (sgbd === undefined || candidate.sgbd === sgbd),
  )!;

  return Uint8Array.from([0x62, 0xf1, 0x50, ...Buffer.from(entry.sgbdHex, 'hex')]);
};

const stubLink = (
  answer: (address: number, payload: Uint8Array) => Uint8Array | undefined,
): DiagnosticLink =>
  ({
    state: 'open',
    busy: false,
    measuredRttMs: null,
    open: async () => undefined,
    close: async () => undefined,
    onStateChange: () => () => undefined,
    request: async (address: number, payload: Uint8Array) => {
      const reply = answer(address, payload);
      if (!reply) throw new Error('no reply');

      return reply;
    },
  }) as DiagnosticLink;

const detectOnStub = (link: DiagnosticLink, addresses?: number[]) =>
  detectCar(
    createLinkProvider(link, async () => link),
    { addresses, probeTimeoutMs: PROBE_TIMEOUT_MS },
  );

describe('detectCar', () => {
  it.each(knownChassis())('identifies the default simulator profile for %s', async (chassis) => {
    const vehicle = makeVehicle(chassis);
    const { car } = await detectOnSim(vehicle);

    const expected = [...createProfile(chassis).modules].sort();
    expect(car.modules.map((module) => module.sgbd).sort()).toEqual(expected);
    expect(car.vin).toBe(vehicle.vin);
    expect(car.chassis).toBeDefined();
    expect(car.selectableElements.length).toBeGreaterThan(0);
  });

  it('exposes element sources, a cluster-free element list and filtered effects', async () => {
    const { car } = await detectOnSim(makeVehicle('F20'));

    expect(car.elementSources.get('lowBeamLeft')?.map((module) => module.sgbd)).toEqual(['FEM_20']);
    expect(car.elementSources.get('clusterFeedback')?.map((module) => module.sgbd)).toEqual([
      'KOMB25',
    ]);
    expect(car.selectableElements).toContain('lowBeamLeft');
    expect(car.selectableElements).not.toContain('clusterFeedback');
    expect(car.effects.length).toBeGreaterThan(0);
    for (const effect of car.effects) {
      for (const step of effect.steps) expect(car.elementSources.has(step.element)).toBe(true);
    }
  });

  it('guesses F20 for the F20 module set and F01 for the FRM set', async () => {
    expect((await detectOnSim(makeVehicle('F20'))).car.chassis).toBe('F20');
    expect((await detectOnSim(makeVehicle('F10'))).car.chassis).toBe('F01');
  });

  it('replaces the link when an absent module kills it', async () => {
    const vehicle = makeVehicle('F10');
    const first = await openSimLink(vehicle);
    const provider = createLinkProvider(first, () => openSimLink(vehicle));

    await detectCar(provider, { probeTimeoutMs: PROBE_TIMEOUT_MS });

    expect(provider.link).not.toBe(first);
    expect(provider.link.state).toBe('open');
    expect(first.state).not.toBe('open');
  });

  it('restricts probing to the requested addresses', async () => {
    const vehicle = makeVehicle('F20');
    const provider = createLinkProvider(await openSimLink(vehicle), () => openSimLink(vehicle));

    const car = await detectCar(provider, { addresses: [0x40], probeTimeoutMs: PROBE_TIMEOUT_MS });

    expect(car.modules.map((module) => module.sgbd)).toEqual(['FEM_20']);
    expect(ModuleRegistry.probeAddresses()).toEqual([
      ...new Set(IDENTIFICATION.map((entry) => entry.adrIndex)),
    ]);
  });

  it('survives an unreadable VIN', async () => {
    const link = stubLink((address, payload) => {
      if (payload[2] === 0x90) return undefined;

      return identityOf(address, 'FEM_20');
    });

    const car = await detectOnStub(link, [0x40]);

    expect(car.vin).toBeUndefined();
    expect(car.modules.map((module) => module.sgbd)).toEqual(['FEM_20']);
  });

  it('ignores a malformed VIN', async () => {
    const link = stubLink((address, payload) =>
      payload[2] === 0x90
        ? Uint8Array.of(0x62, 0xf1, 0x90, 0x01, 0x02)
        : identityOf(address, 'FEM_20'),
    );

    expect((await detectOnStub(link, [0x40])).vin).toBeUndefined();
  });

  it('fails closed with UnsupportedVehicleError when answers are not known identities', async () => {
    const link = stubLink(() => Uint8Array.of(0x62, 0xf1, 0x50, 0xaa, 0xbb, 0xcc));

    const error = await detectOnStub(link).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(UnsupportedVehicleError);
    expect((error as UnsupportedVehicleError).respondedAddresses.length).toBeGreaterThan(0);
  });

  it('fails closed when a response is too short to carry an identity', async () => {
    const link = stubLink(() => Uint8Array.of(0x62, 0xf1, 0x50));

    await expect(detectOnStub(link)).rejects.toBeInstanceOf(UnsupportedVehicleError);
  });

  it('fails closed when only the cluster is recognised', async () => {
    const link = stubLink((address) =>
      address === 0x60 ? identityOf(address, 'KOMB25') : undefined,
    );

    await expect(detectOnStub(link)).rejects.toBeInstanceOf(UnsupportedVehicleError);
  });

  it('reports CarNotRespondingError when nothing answers', async () => {
    const vehicle = makeVehicle('F20', { ignitionOff: true });
    const provider = createLinkProvider(await openSimLink(vehicle), () => openSimLink(vehicle));

    await expect(detectCar(provider, { probeTimeoutMs: PROBE_TIMEOUT_MS })).rejects.toBeInstanceOf(
      CarNotRespondingError,
    );
  });

  it('stops probing when aborted before the first probe', async () => {
    const vehicle = makeVehicle('F20');
    const controller = new AbortController();
    controller.abort();
    const provider = createLinkProvider(await openSimLink(vehicle), () => openSimLink(vehicle));

    await expect(detectCar(provider, { signal: controller.signal })).rejects.toThrow();
  });

  it('stops probing when aborted mid-request', async () => {
    const controller = new AbortController();
    const link = stubLink(() => {
      controller.abort();

      return undefined;
    });

    await expect(
      detectCar(
        createLinkProvider(link, async () => link),
        { signal: controller.signal },
      ),
    ).rejects.toThrow();
  });

  it('propagates a failure to reopen the link', async () => {
    const vehicle = makeVehicle('F10');
    const provider = createLinkProvider(await openSimLink(vehicle), async () => {
      throw new Error('adapter gone');
    });

    await expect(detectCar(provider, { probeTimeoutMs: PROBE_TIMEOUT_MS })).rejects.toThrow(
      'adapter gone',
    );
  });
});
