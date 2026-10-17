import { sameVehicle } from '@/domain/session/actors';
import type { SessionDeps } from '@/domain/session/types';
import type { VehicleFacts } from '@/domain/vehicle/types';
import { SimLink } from '@/link/sim-link';
import type { DiagnosticLink } from '@/link/types';
import type { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import { SEED_PRESETS } from '@/stores/presets';
import { makeVehicle, advanceUntil, wireLog } from '@/test-utils/domain-sim';
import { createRig, DEMO_CONFIG, type SessionRig } from '@/test-utils/session-harness';

const connect = async (rig: SessionRig) => {
  rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
  await rig.waitFor('ready');
};

const factsFor = (rig: SessionRig, headlightType: VehicleFacts['headlightType']): VehicleFacts => ({
  headlightType,
  source: 'userSelection',
  vehicleBinding: rig.context().car!.actionContext!.facts.vehicleBinding,
});

const startHold = async (rig: SessionRig, waitMs = 10_000) => {
  rig.actor.send({
    type: 'RUN',
    item: {
      id: 'session-hold',
      name: 'Hold',
      color: 'blue',
      icon: 'Car',
      steps: [
        { type: 'set', elements: ['lowBeamAll'], state: 'on' },
        { type: 'wait', ms: waitMs },
        { type: 'set', elements: ['lowBeamAll'], state: 'off' },
      ],
    },
  });
  await advanceUntil(() => rig.context().ledger.hasPending);
  expect(rig.phase()).toBe('running');
};

const linkWithoutVin = (vehicle: SimulatedVehicle): DiagnosticLink => {
  const link = new SimLink(vehicle);
  return {
    get state() {
      return link.state;
    },
    get busy() {
      return link.busy;
    },
    get measuredRttMs() {
      return link.measuredRttMs;
    },
    get host() {
      return undefined;
    },
    open: (signal) => link.open(signal),
    request: (ecu, payload, options) => {
      if (payload[0] === 0x22 && payload[1] === 0xf1 && payload[2] === 0x90) {
        return Promise.reject(new Error('VIN unavailable in this test'));
      }
      return link.request(ecu, payload, options);
    },
    close: () => link.close(),
    onStateChange: (listener) => link.onStateChange(listener),
  };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('logical action session integration', () => {
  it('blocks the fresh Double flash semantic seed on an F11 with unknown equipment before any actuation', async () => {
    const rig = createRig(makeVehicle('F11'));
    await connect(rig);
    expect(rig.context().car!.modules.some((module) => module.sgbd === 'FRM3')).toBe(true);
    expect(rig.context().car!.actionContext!.facts.headlightType).toBe('unknown');
    rig.vehicle.clearLog();

    rig.actor.send({ type: 'RUN', item: SEED_PRESETS[0]! });

    expect(rig.phase()).toBe('ready');
    expect(rig.context().lastError?.reason).toBe('equipmentUnknown');
    expect(rig.context().ledger.hasPending).toBe(false);
    expect(wireLog(rig.vehicle)).toEqual([]);
  });

  it.each([
    ['equipmentUnknown', 'bothHighBeams'],
    ['noSemanticMapping', 'biXenonShutterBoth'],
  ] as const)(
    'reports %s from shared action assessment and sends no wire command',
    async (reason, action) => {
      const rig = createRig(makeVehicle('F11'));
      await connect(rig);
      rig.vehicle.clearLog();

      rig.actor.send({
        type: 'RUN',
        item: {
          id: `blocked-${action}`,
          name: 'Blocked action',
          color: 'blue',
          icon: 'Car',
          steps: [{ type: 'action', actions: [action], state: 'on' }],
        },
      });

      expect(rig.phase()).toBe('ready');
      expect(rig.context().lastError?.reason).toBe(reason);
      expect(rig.context().tiles[`blocked-${action}`]).toEqual({ state: 'error', reason });
      expect(rig.context().ledger.hasPending).toBe(false);
      expect(wireLog(rig.vehicle)).toEqual([]);
    },
  );

  it('recomputes capabilities and saves changed facts while ready with a new context revision', async () => {
    const saveVehicleFacts = jest.fn<
      void,
      Parameters<NonNullable<SessionDeps['saveVehicleFacts']>>
    >();
    const rig = createRig(makeVehicle('F11'), { saveVehicleFacts });
    await connect(rig);
    const previousCar = rig.context().car!;
    expect(previousCar.actionContext!.revision).toBe(0);

    rig.actor.send({ type: 'SET_VEHICLE_FACTS', facts: factsFor(rig, 'halogen') });

    const nextCar = rig.context().car!;
    expect(nextCar).not.toBe(previousCar);
    expect(nextCar.actionContext!.facts.headlightType).toBe('halogen');
    expect(nextCar.actionContext!.revision).toBe(1);
    expect(saveVehicleFacts).toHaveBeenCalledWith(
      nextCar,
      expect.objectContaining({ headlightType: 'halogen', revision: 1 }),
      [],
      true,
    );
  });

  it('rejects a stale vehicle binding without changing the persisted profile revision', async () => {
    const saveVehicleFacts = jest.fn<
      void,
      Parameters<NonNullable<SessionDeps['saveVehicleFacts']>>
    >();
    const rig = createRig(makeVehicle('F20'), { saveVehicleFacts });
    await connect(rig);
    const car = rig.context().car!;
    const revision = car.actionContext!.revision;

    rig.actor.send({
      type: 'SET_VEHICLE_FACTS',
      facts: { ...factsFor(rig, 'halogen'), vehicleBinding: 'another-car' },
    });

    expect(rig.context().car).toBe(car);
    expect(rig.context().car!.actionContext!.revision).toBe(revision);
    expect(saveVehicleFacts).not.toHaveBeenCalled();
  });

  it('ignores equipment changes during an active run and leaves its physical ledger unchanged', async () => {
    const rig = createRig(makeVehicle('F20'));
    await connect(rig);
    await startHold(rig);
    const revision = rig.context().car!.actionContext!.revision;
    const touched = rig.context().ledger.touched.map((entry) => ({
      module: entry.module.sgbd,
      elements: [...entry.elements],
    }));

    rig.actor.send({ type: 'SET_VEHICLE_FACTS', facts: factsFor(rig, 'xenon') });

    expect(rig.phase()).toBe('running');
    expect(rig.context().car!.actionContext!.revision).toBe(revision);
    expect(
      rig.context().ledger.touched.map((entry) => ({
        module: entry.module.sgbd,
        elements: [...entry.elements],
      })),
    ).toEqual(touched);
    rig.actor.send({ type: 'STOP' });
    await rig.waitFor('ready');
  });

  it('ignores equipment changes while a toggle is held', async () => {
    const rig = createRig(makeVehicle('F20'));
    await connect(rig);
    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
    await rig.waitFor('ready');
    expect(rig.context().ledger.hasPending).toBe(true);
    const revision = rig.context().car!.actionContext!.revision;
    const touched = rig.context().ledger.touched.map((entry) => [...entry.elements]);

    rig.actor.send({ type: 'SET_VEHICLE_FACTS', facts: factsFor(rig, 'halogen') });

    expect(rig.context().car!.actionContext!.revision).toBe(revision);
    expect(rig.context().ledger.touched.map((entry) => [...entry.elements])).toEqual(touched);
    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: false });
    await rig.waitFor('ready');
  });

  it('ignores equipment changes while Test commands is active', async () => {
    const rig = createRig(makeVehicle('F20'));
    await connect(rig);
    rig.actor.send({ type: 'TEST_BEGIN' });
    expect(rig.context().testActive).toBe(true);
    const revision = rig.context().car!.actionContext!.revision;

    rig.actor.send({ type: 'SET_VEHICLE_FACTS', facts: factsFor(rig, 'halogen') });

    expect(rig.context().car!.actionContext!.revision).toBe(revision);
    rig.actor.send({ type: 'TEST_END' });
    expect(rig.context().testActive).toBe(false);
  });

  it('ignores equipment changes during pending cleanup and retains the original ledger entry', async () => {
    const rig = createRig(makeVehicle('F20'));
    await connect(rig);
    const target = rig.context().car!.elementTargets.get('lowBeamLeft')![0]!;
    rig.context().ledger.touch(target.module.module, target.element);
    let finishRestore: ((report: { restored: boolean; failures: [] }) => void) | undefined;
    jest.spyOn(rig.context().runner!, 'restore').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRestore = resolve;
        }),
    );
    rig.actor.send({ type: 'STOP' });
    await rig.waitFor('restoring');
    const revision = rig.context().car!.actionContext!.revision;

    rig.actor.send({ type: 'SET_VEHICLE_FACTS', facts: factsFor(rig, 'xenon') });

    expect(rig.context().car!.actionContext!.revision).toBe(revision);
    expect(rig.context().ledger.touched).toEqual([
      expect.objectContaining({
        module: target.module.module,
        elements: new Set([target.element]),
      }),
    ]);
    finishRestore?.({ restored: true, failures: [] });
    await rig.waitFor('ready');
    rig.context().ledger.clear();
  });

  it('rehydrates same VIN equipment facts after reconnecting the session', async () => {
    let profile: ReturnType<NonNullable<SessionDeps['loadVehicleFacts']>> | undefined;
    const deps: Partial<SessionDeps> = {
      loadVehicleFacts: jest.fn(() => profile),
      saveVehicleFacts: (_car, facts, validations) => {
        profile = { facts, validations };
      },
    };
    const rig = createRig(makeVehicle('F20'), deps);
    await connect(rig);
    const vin = rig.context().car!.vin;
    rig.actor.send({ type: 'SET_VEHICLE_FACTS', facts: factsFor(rig, 'halogen') });
    rig.actor.send({ type: 'DISCONNECT' });
    await rig.waitFor('disconnected');
    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('ready');

    expect(rig.context().car!.vin).toBe(vin);
    expect(rig.context().car!.actionContext!.facts.headlightType).toBe('halogen');
    expect(rig.context().car!.actionContext!.revision).toBe(1);
  });

  it('blocks an unsupported action mixed with a supported legacy output without partially executing', async () => {
    const rig = createRig(makeVehicle('F11'));
    await connect(rig);
    rig.vehicle.clearLog();
    const item = {
      id: 'mixed-semantic-legacy',
      name: 'Mixed',
      color: 'blue',
      icon: 'Car',
      steps: [
        { type: 'set' as const, elements: ['frontLeftIndicator' as const], state: 'on' as const },
        { type: 'action' as const, actions: ['bothHighBeams' as const], state: 'on' as const },
      ],
    };

    rig.actor.send({ type: 'RUN', item });

    expect(rig.phase()).toBe('ready');
    expect(rig.context().ledger.hasPending).toBe(false);
    expect(wireLog(rig.vehicle)).toEqual([]);
  });

  it('does not treat a changed or missing VIN as the same cleanup vehicle', async () => {
    const rig = createRig(makeVehicle('F11'));
    await connect(rig);
    const car = rig.context().car!;

    expect(sameVehicle(car, { ...car })).toBe(true);
    expect(sameVehicle(car, { ...car, vin: `${car.vin}X` })).toBe(false);
    expect(sameVehicle(car, { ...car, vin: undefined })).toBe(false);
  });

  it('retains pending cleanup when reconnect identifies a replacement with no VIN', async () => {
    let currentVehicle = makeVehicle('F20');
    const originalVehicle = currentVehicle;
    const rig = createRig(originalVehicle, {
      createLink: async () => linkWithoutVin(currentVehicle),
    });
    await connect(rig);
    expect(rig.context().car!.vin).toBeUndefined();
    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
    await rig.waitFor('ready');
    expect(rig.context().ledger.hasPending).toBe(true);
    const oldLedger = rig.context().ledger.touched.map((entry) => ({
      sgbd: entry.module.sgbd,
      address: entry.module.address,
      elements: [...entry.elements],
    }));
    currentVehicle = makeVehicle('F20', undefined, 7);

    rig.actor.send({ type: 'LINK_LOST' });
    await rig.waitFor('error');

    expect(rig.context().ledger.hasPending).toBe(true);
    expect(rig.context().lightsMayBeOn).toBe(true);
    expect(
      rig.context().ledger.touched.map((entry) => ({
        sgbd: entry.module.sgbd,
        address: entry.module.address,
        elements: [...entry.elements],
      })),
    ).toEqual(oldLedger);
    expect(
      wireLog(currentVehicle).some((entry) => entry.includes(':2f') || entry.includes(':2e')),
    ).toBe(false);
    expect(originalVehicle.getLitElements().length).toBeGreaterThan(0);
  });
});
