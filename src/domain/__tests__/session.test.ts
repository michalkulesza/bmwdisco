import { loadModule } from '@/data/generated';
import type { Effect } from '@/data/types';
import { PresetRunner } from '@/domain/runner/runner';
import { LOG_CAPACITY } from '@/domain/session/helpers';
import type { RunInput } from '@/domain/session/types';
import { SimLink } from '@/link/sim-link';
import { AdapterError, NegativeResponseError } from '@/protocol/errors';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import {
  advanceUntil,
  litIds,
  makeVehicle,
  NRC_SERVICE_NOT_SUPPORTED_IN_SESSION,
  wireLog,
} from '@/test-utils/domain-sim';
import { createRig, DEMO_CONFIG, type SessionRig } from '@/test-utils/session-harness';

const fem = loadModule('FEM_20');
const LOW_BEAM_ON = Uint8Array.from(fem.elements.lowBeamLeft!.on);

const holdPreset = (waitMs = 5000, id = 'hold') => ({
  id,
  name: 'Hold',
  color: 'blue',
  icon: 'Car',
  steps: [
    { type: 'set' as const, elements: ['lowBeamLeft' as const], state: 'on' as const },
    { type: 'wait' as const, ms: waitMs },
    { type: 'set' as const, elements: ['lowBeamLeft' as const], state: 'off' as const },
  ],
});

const connect = async (rig: SessionRig) => {
  rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
  await rig.waitFor('ready');
};

const startReady = async (faults?: Parameters<typeof makeVehicle>[1], chassis = 'F20') => {
  const rig = createRig(makeVehicle(chassis, faults));
  await connect(rig);

  return rig;
};

const effectOf = (rig: SessionRig, id: string): Effect =>
  rig.context().car!.effects.find((effect) => effect.id === id)!;

const run = (rig: SessionRig, item: RunInput) => rig.actor.send({ type: 'RUN', item });

const startHold = async (rig: SessionRig) => {
  run(rig, holdPreset());
  await advanceUntil(() => rig.vehicle.getLitElements().length > 0);
  expect(rig.phase()).toBe('running');
};

const expectDefaultSession = async (vehicle: SimulatedVehicle) => {
  const link = new SimLink(vehicle);
  await link.open();
  const result = link.request(0x40, LOW_BEAM_ON);
  const outcome = result.catch((error: unknown) => error);
  await advanceUntil(() => true, 5, 5);
  await jest.advanceTimersByTimeAsync(50);
  const error = await outcome;

  expect(error).toBeInstanceOf(NegativeResponseError);
  expect((error as NegativeResponseError).nrc).toBe(NRC_SERVICE_NOT_SUPPORTED_IN_SESSION);
  await link.close();
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('connecting and identifying', () => {
  it('reaches ready with the detected car, adapter and measured RTT', async () => {
    const rig = await startReady();

    const context = rig.context();
    expect(context.adapter).toBe('demo');
    expect(context.car!.modules.map((module) => module.sgbd).sort()).toEqual([
      'FEM_20',
      'FLE02_L',
      'FLE02_R',
      'KOMB25',
      'REM_20',
    ]);
    expect(context.measuredRttMs).not.toBeNull();
    expect(context.lastError).toBeUndefined();
    expect(context.lightsMayBeOn).toBe(false);
  });

  it.each([
    ['bluetooth-off', 'bluetoothOff'],
    ['bluetooth-denied', 'bluetoothDenied'],
    ['connect-failed', 'adapterUnreachable'],
  ] as const)('maps adapter failure %s to %s', async (code, reason) => {
    const rig = createRig(makeVehicle('F20'), {
      createLink: async () => {
        throw new AdapterError(code);
      },
    });

    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('error');

    expect(rig.context().lastError?.reason).toBe(reason);
  });

  it('reports carNotResponding when the car is silent and closes the link', async () => {
    const rig = createRig(makeVehicle('F20', { ignitionOff: true }));

    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('error');

    expect(rig.context().lastError?.reason).toBe('carNotResponding');
    expect(rig.links.every((link) => link.state !== 'open')).toBe(true);
  });

  it('reports unsupportedVehicle and stays locked when no light module is recognised', async () => {
    const vehicle = new SimulatedVehicle({
      profile: { chassis: 'F01', modules: ['LHM2_L', 'KOMB01'] },
    });
    const rig = createRig(vehicle);

    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('error');
    run(rig, holdPreset());
    await jest.advanceTimersByTimeAsync(100);

    expect(rig.context().lastError?.reason).toBe('unsupportedVehicle');
    expect(rig.phase()).toBe('error');
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('cancels while the adapter is still connecting and closes the late link', async () => {
    let release: () => void = () => undefined;
    const vehicle = makeVehicle('F20');
    const link = new SimLink(vehicle);
    const rig = createRig(vehicle, {
      createLink: () => new Promise((resolve) => (release = () => resolve(link))),
    });

    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await jest.advanceTimersByTimeAsync(10);
    expect(rig.phase()).toBe('connecting');
    rig.actor.send({ type: 'CANCEL' });
    release();
    await jest.advanceTimersByTimeAsync(10);

    expect(rig.phase()).toBe('idle');
    expect(link.state).toBe('closed');
  });

  it('cancels during identification and closes the link', async () => {
    const vehicle = makeVehicle('F20', { latency: { fixedMs: 100, jitterMs: 0 } });
    const rig = createRig(vehicle, { probeTimeoutMs: 1000 });

    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('identifying');
    await jest.advanceTimersByTimeAsync(150);
    rig.actor.send({ type: 'CANCEL' });
    await jest.advanceTimersByTimeAsync(2000);

    expect(rig.phase()).toBe('idle');
    expect(rig.links.every((link) => link.state !== 'open')).toBe(true);
  });

  it('treats DISCONNECT while connecting like a cancel', async () => {
    const rig = createRig(makeVehicle('F20'), { createLink: () => new Promise(() => undefined) });

    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await jest.advanceTimersByTimeAsync(10);
    rig.actor.send({ type: 'DISCONNECT' });

    expect(rig.phase()).toBe('idle');
  });

  it('can connect again after an error and after a disconnect', async () => {
    const rig = createRig(makeVehicle('F20'));
    rig.availability.linkAvailable = false;
    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('error');

    rig.availability.linkAvailable = true;
    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('ready');
    rig.actor.send({ type: 'DISCONNECT' });
    await rig.waitFor('disconnected');
    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('ready');

    expect(rig.context().lastError).toBeUndefined();
  });

  it('leaves the error state with DISCONNECT', async () => {
    const rig = createRig(makeVehicle('F20'));
    rig.availability.linkAvailable = false;
    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('error');

    rig.actor.send({ type: 'DISCONNECT' });

    expect(rig.phase()).toBe('disconnected');
  });

  it('closes the link on DISCONNECT from ready', async () => {
    const rig = await startReady();
    const link = rig.context().link!;

    rig.actor.send({ type: 'DISCONNECT' });
    await rig.waitFor('disconnected');

    expect(link.state).toBe('closed');
    expect(rig.context().car).toBeDefined();
    expect(rig.context().link).toBeUndefined();
  });
});

describe('running items', () => {
  it('runs a one-shot effect, marks the tile justRan, then clears it', async () => {
    const rig = await startReady();
    const effect = effectOf(rig, 'flash.lowBeamLeft');

    run(rig, effect);
    expect(rig.phase()).toBe('running');
    expect(rig.context().tiles[effect.id]).toEqual({ state: 'running' });
    expect(rig.context().runningItemId).toBe(effect.id);
    await rig.waitFor('ready');

    expect(rig.context().tiles[effect.id]).toEqual({ state: 'justRan' });
    expect(rig.context().lightsMayBeOn).toBe(false);
    expect(rig.vehicle.getLitElements()).toEqual([]);
    await jest.advanceTimersByTimeAsync(2000);
    expect(rig.context().tiles[effect.id]).toBeUndefined();
  });

  it('runs a user preset', async () => {
    const rig = await startReady();

    run(rig, holdPreset(100));
    await rig.waitFor('ready');

    expect(rig.context().tiles.hold).toEqual({ state: 'justRan' });
    expect(wireLog(rig.vehicle)).toContain('40:' + Buffer.from(LOW_BEAM_ON).toString('hex'));
  });

  it('rejects invalid presets and toggle effects with an inline tile error', async () => {
    const rig = await startReady();
    const toggle = effectOf(rig, 'toggle.hazard');

    run(rig, { ...holdPreset(), name: '' });
    run(rig, toggle);
    run(rig, { notAPreset: true } as unknown as RunInput);

    expect(rig.phase()).toBe('ready');
    expect(rig.context().tiles.hold).toEqual({ state: 'error', reason: 'invalidPreset' });
    expect(rig.context().tiles[toggle.id]).toEqual({ state: 'error', reason: 'invalidPreset' });
    expect(rig.context().lastError?.reason).toBe('invalidPreset');
    expect(rig.vehicle.requestLog.filter((entry) => entry.request[0] === 0x10)).toHaveLength(0);
  });

  it('shows NRC 0x22 as conditionsNotCorrect on the tile and still restores', async () => {
    const rig = await startReady({ conditionsNotCorrect: { requests: 1 } });

    run(rig, holdPreset(100));
    await rig.waitFor('ready');

    expect(rig.context().tiles.hold).toEqual({ state: 'error', reason: 'conditionsNotCorrect' });
    expect(rig.context().lastError).toMatchObject({
      reason: 'conditionsNotCorrect',
      itemId: 'hold',
    });
    expect(rig.vehicle.getLitElements()).toEqual([]);
    expect(rig.context().lightsMayBeOn).toBe(false);
  });

  it('shows the 90 second limit as an error and restores', async () => {
    const rig = await startReady({ latency: 'enet' });

    run(rig, {
      ...holdPreset(),
      steps: [
        { type: 'set', elements: ['lowBeamLeft'], state: 'on' },
        { type: 'wait', ms: 60_000 },
        { type: 'wait', ms: 30_000 },
      ],
    });
    await rig.waitFor('ready');

    expect(rig.context().tiles.hold).toEqual({ state: 'error', reason: 'limitExceeded' });
    expect(rig.vehicle.getLitElements()).toEqual([]);
  });

  it('collects notices about skipped elements', async () => {
    const rig = await startReady(undefined, 'F10');

    run(rig, {
      ...holdPreset(100),
      steps: [
        { type: 'set', elements: ['lowBeamLeft', 'corneringLeft'], state: 'on' },
        { type: 'wait', ms: 100 },
      ],
    });
    await rig.waitFor('ready');

    expect(rig.context().notices).toContainEqual({
      type: 'elementSkipped',
      element: 'corneringLeft',
    });
  });

  it('ignores RUN and TOGGLE while a run is active', async () => {
    const rig = await startReady();
    await startHold(rig);

    run(rig, holdPreset(100, 'second'));
    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });

    expect(rig.context().tiles.second).toBeUndefined();
    expect(rig.context().runningItemId).toBe('hold');
    rig.actor.send({ type: 'STOP' });
    await rig.waitFor('ready');
  });

  it('records a capped debug log only when debug is on', async () => {
    const quiet = await startReady();
    run(quiet, holdPreset(100));
    await quiet.waitFor('ready');
    expect(quiet.context().log).toEqual([]);

    const vehicle = makeVehicle('F20');
    const loud = createRig(vehicle, { debug: true });
    await connect(loud);
    for (let index = 0; index < 120; index++) run(loud, holdPreset(50, `p${index}`));
    for (let index = 0; index < 40; index++) {
      run(loud, holdPreset(50, `q${index}`));
      await loud.waitFor('ready');
    }

    const { log } = loud.context();
    expect(log.length).toBeGreaterThan(0);
    expect(log.length).toBeLessThanOrEqual(LOG_CAPACITY);
    expect(log.some((entry) => entry.message.startsWith('->'))).toBe(true);
  });
});

describe('toggles', () => {
  it('holds a toggle on and releases it, restoring when the last one goes off', async () => {
    const rig = await startReady();

    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
    await rig.waitFor('ready');

    expect(rig.context().activeToggles).toEqual(['toggle.hazard']);
    expect(rig.context().lightsMayBeOn).toBe(true);
    expect(rig.vehicle.getLitElements().length).toBeGreaterThan(0);

    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: false });
    await rig.waitFor('ready');

    expect(rig.context().activeToggles).toEqual([]);
    expect(rig.vehicle.getLitElements()).toEqual([]);
    expect(rig.context().lightsMayBeOn).toBe(false);
  });

  it('keeps the remaining toggle when one of two is switched off', async () => {
    const rig = await startReady();
    for (const effectId of ['toggle.hazard', 'toggle.brakeForce']) {
      rig.actor.send({ type: 'TOGGLE', effectId, on: true });
      await rig.waitFor('ready');
    }

    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: false });
    await advanceUntil(() => rig.context().activeToggles.length === 1);
    await rig.waitFor('ready');

    expect(rig.context().activeToggles).toEqual(['toggle.brakeForce']);
    expect(rig.context().lightsMayBeOn).toBe(true);
  });

  it('ignores unknown toggle ids', async () => {
    const rig = await startReady();

    rig.actor.send({ type: 'TOGGLE', effectId: 'nope', on: true });
    rig.actor.send({ type: 'TOGGLE', effectId: 'flash.lowBeamLeft', on: true });

    expect(rig.phase()).toBe('ready');
  });

  it('sends keepalives to modules in session only, and not while idle', async () => {
    const rig = await startReady();
    await jest.advanceTimersByTimeAsync(6000);
    expect(wireLog(rig.vehicle).some((entry) => entry.endsWith(':3eff'))).toBe(false);

    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
    await rig.waitFor('ready');
    rig.vehicle.clearLog();
    await jest.advanceTimersByTimeAsync(6000);

    const keepalives = wireLog(rig.vehicle).filter((entry) => entry.endsWith(':3eff'));
    expect(keepalives.length).toBeGreaterThanOrEqual(2);
    expect(keepalives.every((entry) => entry.startsWith('40:') || entry.startsWith('60:'))).toBe(
      true,
    );
  });
});

describe('safety invariant: every termination path ends with nothing forced', () => {
  const terminations: [string, (rig: SessionRig) => Promise<void>][] = [
    [
      'completes',
      async (rig) => {
        run(rig, holdPreset(300));
        await rig.waitFor('ready');
      },
    ],
    [
      'STOP',
      async (rig) => {
        await startHold(rig);
        rig.actor.send({ type: 'STOP' });
        await rig.waitFor('ready');
      },
    ],
    [
      'APP_BACKGROUND',
      async (rig) => {
        await startHold(rig);
        rig.actor.send({ type: 'APP_BACKGROUND' });
        await rig.waitFor('ready');
      },
    ],
    [
      'app state source going to background',
      async (rig) => {
        await startHold(rig);
        rig.appState.emit('background');
        await rig.waitFor('ready');
      },
    ],
    [
      'DISCONNECT',
      async (rig) => {
        await startHold(rig);
        rig.actor.send({ type: 'DISCONNECT' });
        await rig.waitFor('disconnected');
      },
    ],
    [
      'STOP while holding a toggle',
      async (rig) => {
        rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
        await rig.waitFor('ready');
        rig.actor.send({ type: 'STOP' });
        await rig.waitFor('ready');
      },
    ],
    [
      'APP_BACKGROUND while holding a toggle',
      async (rig) => {
        rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
        await rig.waitFor('ready');
        rig.actor.send({ type: 'APP_BACKGROUND' });
        await rig.waitFor('ready');
      },
    ],
    [
      'DISCONNECT while holding a toggle',
      async (rig) => {
        rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
        await rig.waitFor('ready');
        rig.actor.send({ type: 'DISCONNECT' });
        await rig.waitFor('disconnected');
      },
    ],
    [
      'an NRC while running',
      async (rig) => {
        rig.vehicle.faults.configure({ conditionsNotCorrect: { requests: 2 } });
        run(rig, {
          ...holdPreset(),
          steps: [
            { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 100 },
            { type: 'set', elements: ['lowBeamRight'], state: 'on' },
            { type: 'wait', ms: 1000 },
          ],
        });
        await rig.waitFor('ready');
      },
    ],
    [
      'the 90 second limit',
      async (rig) => {
        rig.vehicle.faults.configure({ latency: 'enet' });
        run(rig, {
          ...holdPreset(),
          steps: [
            { type: 'set', elements: ['lowBeamLeft'], state: 'on' },
            { type: 'wait', ms: 90_000 },
          ],
        });
        await rig.waitFor('ready');
      },
    ],
    [
      'a link drop followed by a successful reconnect',
      async (rig) => {
        await startHold(rig);
        await rig.context().link!.close();
        await rig.waitFor('reconnecting');
        await rig.waitFor('ready');
      },
    ],
  ];

  it.each(terminations)('%s', async (_, terminate) => {
    const rig = await startReady();

    await terminate(rig);
    await jest.advanceTimersByTimeAsync(100);

    expect(rig.vehicle.getLitElements()).toEqual([]);
    expect(rig.context().lightsMayBeOn).toBe(false);
    await expectDefaultSession(rig.vehicle);
  });

  it('restores communication silenced for headlight LED effects when stopped', async () => {
    const rig = await startReady();
    const effect = rig
      .context()
      .car!.effects.find(
        (candidate) => candidate.silenceCommunication && candidate.steps.length > 1,
      )!;

    run(rig, effect);
    await advanceUntil(() => rig.vehicle.getLitElements().length > 0);
    rig.actor.send({ type: 'STOP' });
    await rig.waitFor('ready');

    const log = wireLog(rig.vehicle);
    const silenced = log.filter((entry) => entry.endsWith(':280201'));
    const restored = log.filter((entry) => entry.endsWith(':280003'));
    expect(silenced.length).toBeGreaterThan(0);
    expect(restored.length).toBe(silenced.length);
    expect(rig.vehicle.getLitElements()).toEqual([]);
  });
});

describe('link loss and reconnecting', () => {
  it('reports connection lost while running, reconnects, restores first, then resumes', async () => {
    const rig = await startReady();
    await startHold(rig);
    rig.vehicle.clearLog();

    await rig.context().link!.close();
    await rig.waitFor('reconnecting');

    expect(rig.context().lightsMayBeOn).toBe(true);
    expect(rig.context().lastError).toMatchObject({ reason: 'connectionLost', whileRunning: true });
    expect(rig.context().tiles.hold).toEqual({ state: 'error', reason: 'connectionLost' });
    expect(rig.vehicle.getLitElements().length).toBeGreaterThan(0);

    await rig.waitFor('ready');

    const afterLoss = wireLog(rig.vehicle);
    const firstActuation = afterLoss.findIndex((entry) =>
      /^[0-9a-f]+:(2f|2e|31|28|10)/.test(entry),
    );
    expect(afterLoss[firstActuation]).toBe('40:1003');
    expect(
      afterLoss.some((entry) => entry === '40:' + Buffer.from(LOW_BEAM_ON).toString('hex')),
    ).toBe(false);
    expect(rig.vehicle.getLitElements()).toEqual([]);
    expect(rig.context().lightsMayBeOn).toBe(false);
    expect(rig.context().lastError).toBeUndefined();
    await expectDefaultSession(rig.vehicle);
  });

  it('keeps lights-may-be-on and restores first when the car comes back on a later session', async () => {
    const rig = await startReady();
    await startHold(rig);
    rig.availability.linkAvailable = false;
    await rig.context().link!.close();
    await rig.waitFor('error');

    expect(rig.context().lastError?.reason).toBe('connectionLost');
    expect(rig.context().lightsMayBeOn).toBe(true);
    expect(litIds(rig.vehicle)).toEqual(['FEM_20:lowBeamLeft']);

    const second = new SimLink(rig.vehicle);
    await second.open();
    expect(second.state).toBe('open');
    expect(litIds(rig.vehicle)).toEqual(['FEM_20:lowBeamLeft']);
    await second.close();

    rig.availability.linkAvailable = true;
    rig.vehicle.clearLog();
    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('ready');

    const log = wireLog(rig.vehicle);
    expect(log.indexOf('40:1003')).toBeGreaterThan(-1);
    expect(log.some((entry) => entry === '40:' + Buffer.from(LOW_BEAM_ON).toString('hex'))).toBe(
      false,
    );
    expect(rig.vehicle.getLitElements()).toEqual([]);
    expect(rig.context().lightsMayBeOn).toBe(false);
  });

  it('makes three attempts with exponential backoff before giving up', async () => {
    const rig = await startReady();
    const attempts: number[] = [];
    rig.availability.linkAvailable = false;
    const started = Date.now();
    const original = rig.context().deps.createLink;
    Object.assign(rig.context().deps, {
      createLink: (...args: Parameters<typeof original>) => {
        attempts.push(Date.now() - started);

        return original(...args);
      },
    });

    await rig.context().link!.close();
    await rig.waitFor('error');

    expect(attempts).toEqual([500, 1500, 3500]);
    expect(rig.context().lightsMayBeOn).toBe(false);
    expect(rig.context().lastError?.reason).toBe('connectionLost');
  });

  it('resumes without a restore when nothing was forced', async () => {
    const rig = await startReady();
    const staleLink = rig.context().link!;

    await staleLink.close();
    await rig.waitFor('reconnecting');
    await rig.waitFor('ready');

    expect(rig.context().link).not.toBe(staleLink);
    expect(rig.context().lastError).toBeUndefined();
  });

  it('fails the attempts when a different car answers', async () => {
    const rig = await startReady();
    const other = makeVehicle('F10');
    Object.assign(rig.context().deps, { createLink: async () => new SimLink(other) });

    await rig.context().link!.close();
    await rig.waitFor('error');

    expect(rig.context().lastError?.reason).toBe('connectionLost');
  });

  it('reconnects on foreground when the link died while in the background', async () => {
    const rig = await startReady();
    rig.appState.emit('background');
    await rig.context().link!.close();
    await rig.waitFor('reconnecting');
    await rig.waitFor('ready');

    rig.appState.emit('inactive');
    rig.appState.emit('active');

    expect(rig.phase()).toBe('ready');
  });

  it('treats APP_FOREGROUND with a healthy link as a no-op', async () => {
    const rig = await startReady();
    const link = rig.context().link;

    rig.actor.send({ type: 'APP_FOREGROUND' });

    expect(rig.phase()).toBe('ready');
    expect(rig.context().link).toBe(link);
  });

  it('can be cancelled or disconnected while reconnecting', async () => {
    for (const type of ['CANCEL', 'DISCONNECT'] as const) {
      const rig = await startReady();
      await startHold(rig);
      rig.availability.linkAvailable = false;
      await rig.context().link!.close();
      await rig.waitFor('reconnecting');

      rig.actor.send({ type });

      expect(rig.phase()).toBe('disconnected');
      expect(rig.context().lightsMayBeOn).toBe(true);
    }
  });

  it('goes back to reconnecting when the link dies during the restore', async () => {
    const rig = await startReady();
    await startHold(rig);
    const link = rig.context().link!;
    const request = link.request.bind(link);
    jest.spyOn(link, 'request').mockImplementation(async (...args) => {
      if (args[1][0] === 0x2f && args[1][5] === 0x00) {
        await link.close();
      }

      return request(...args);
    });

    rig.actor.send({ type: 'STOP' });
    await rig.waitFor('reconnecting');
    await rig.waitFor('ready');

    expect(rig.vehicle.getLitElements()).toEqual([]);
    expect(rig.context().lightsMayBeOn).toBe(false);
  });

  it('retries an unconfirmed restore on a fresh link, then gives up flagged, then recovers', async () => {
    const vehicle = makeVehicle('F20');
    const broken = { value: true };
    const rig = createRig(vehicle, {
      createLink: async () => {
        const link = new SimLink(vehicle);
        const request = link.request.bind(link);
        link.request = (ecu, payload, options) =>
          broken.value && payload[0] === 0x2f && payload[payload.length - 1] === 0x00
            ? Promise.reject(new NegativeResponseError(0x2f, 0x22))
            : request(ecu, payload, options);

        return link;
      },
    });
    await connect(rig);
    await startHold(rig);

    rig.actor.send({ type: 'STOP' });
    await rig.waitFor('error');

    expect(rig.context().lightsMayBeOn).toBe(true);
    expect(rig.context().lastError).toMatchObject({ reason: 'connectionLost', whileRunning: true });

    broken.value = false;
    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await rig.waitFor('ready');

    expect(vehicle.getLitElements()).toEqual([]);
    expect(rig.context().lightsMayBeOn).toBe(false);
  });

  it('keeps lights-may-be-on after a DISCONNECT whose restore failed', async () => {
    const vehicle = makeVehicle('F20');
    const rig = createRig(vehicle);
    await connect(rig);
    await startHold(rig);
    const link = rig.context().link!;
    const request = link.request.bind(link);
    jest
      .spyOn(link, 'request')
      .mockImplementation((ecu, payload, options) =>
        payload[0] === 0x2f && payload[payload.length - 1] === 0x00
          ? Promise.reject(new NegativeResponseError(0x2f, 0x22))
          : request(ecu, payload, options),
      );

    rig.actor.send({ type: 'DISCONNECT' });
    await rig.waitFor('disconnected');

    expect(rig.context().lightsMayBeOn).toBe(true);
  });

  it('handles a DISCONNECT during the restore itself', async () => {
    const rig = await startReady({ latency: { fixedMs: 20, jitterMs: 0 } });
    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
    await rig.waitFor('ready');

    rig.actor.send({ type: 'STOP' });
    await rig.waitFor('restoring');
    rig.actor.send({ type: 'DISCONNECT' });
    await rig.waitFor('disconnected');

    expect(rig.vehicle.getLitElements()).toEqual([]);
    expect(rig.context().lightsMayBeOn).toBe(false);
  });

  it('recovers from a LINK_LOST that arrives while running', async () => {
    const rig = await startReady();
    await startHold(rig);

    rig.actor.send({ type: 'LINK_LOST' });
    await rig.waitFor('reconnecting');
    await rig.waitFor('ready');

    expect(rig.vehicle.getLitElements()).toEqual([]);
  });
});

describe('application state', () => {
  it('does nothing on background when nothing is forced', async () => {
    const rig = await startReady();

    rig.appState.emit('background');

    expect(rig.phase()).toBe('ready');
  });

  it('ignores STOP when nothing is forced', async () => {
    const rig = await startReady();

    rig.actor.send({ type: 'STOP' });

    expect(rig.phase()).toBe('ready');
  });
});

describe('unexpected runner failures', () => {
  it('turns a rejected execute into a tile error and still restores', async () => {
    const rig = await startReady();
    const runner = rig.context().runner!;
    jest.spyOn(runner, 'execute').mockRejectedValue(new Error('bug'));

    run(rig, holdPreset());
    await rig.waitFor('ready');

    expect(rig.context().tiles.hold).toEqual({ state: 'error', reason: 'unknown' });
    expect(rig.context().lastError).toMatchObject({ reason: 'unknown', message: 'bug' });
  });

  it('goes to reconnecting when the restore itself rejects, then error after repeated failures', async () => {
    const rig = await startReady();
    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
    await rig.waitFor('ready');
    jest.spyOn(rig.context().runner!, 'restore').mockRejectedValue(new Error('bug'));

    rig.actor.send({ type: 'STOP' });
    await rig.waitFor('reconnecting');
    jest.spyOn(PresetRunner.prototype, 'restore').mockRejectedValue(new Error('bug'));
    await rig.waitFor('error');

    expect(rig.context().lightsMayBeOn).toBe(true);
  });

  it('still disconnects when the restore rejects', async () => {
    const rig = await startReady();
    rig.actor.send({ type: 'TOGGLE', effectId: 'toggle.hazard', on: true });
    await rig.waitFor('ready');
    jest.spyOn(rig.context().runner!, 'restore').mockRejectedValue(new Error('bug'));

    rig.actor.send({ type: 'DISCONNECT' });
    await rig.waitFor('disconnected');

    expect(rig.context().lightsMayBeOn).toBe(true);
  });
});
