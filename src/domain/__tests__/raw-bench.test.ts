import { loadModule } from '@/data/generated';
import { ECU } from '@/domain/raw/ecus';
import {
  cleanupAllGroup,
  d542IndicatorGroup,
  femIndicatorGroup,
  hazardGroup,
  identityGroup,
  lhm2ReadGroup,
  lhm2WriteGroup,
  ON_HOLD_MS,
  remIndicatorGroup,
} from '@/domain/raw/groups';
import { lhm2DataOf } from '@/domain/raw/lhm2';
import { TestBench } from '@/domain/raw/test-bench';
import { TestSession } from '@/domain/raw/test-session';
import type { RawExchange } from '@/domain/raw/types';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import { advanceUntil, wireLog } from '@/test-utils/domain-sim';
import { createRig, DEMO_CONFIG, type SessionRig } from '@/test-utils/session-harness';

const CAR_MODULES = ['FEM_20', 'LHM2_L', 'LHM2_R', 'KOMB25', 'REM_20'] as const;
const KEEPALIVE_MS = 200;

const makeCar = (
  faults?: ConstructorParameters<typeof SimulatedVehicle>[0] extends never ? never : object,
) => {
  const vehicle = new SimulatedVehicle({ profile: { chassis: 'F32', modules: [...CAR_MODULES] } });
  if (faults) vehicle.faults.configure(faults);

  return vehicle;
};

const startRig = async (vehicle = makeCar()) => {
  const rig = createRig(vehicle, { keepaliveIntervalMs: KEEPALIVE_MS });
  rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
  await rig.waitFor('ready');
  rig.vehicle.clearLog();

  return rig;
};

const makeBench = (rig: SessionRig) => {
  const exchanges: RawExchange[] = [];
  const bench = new TestBench({
    host: rig.actor,
    onExchange: (exchange) => exchanges.push(exchange),
  });

  return { bench, exchanges };
};

const settle = async <T>(promise: Promise<T>): Promise<T> => {
  let done = false;
  void promise.finally(() => {
    done = true;
  });
  await advanceUntil(() => done, 50, 120_000);

  return promise;
};

const wire = (rig: SessionRig, ecu: number) =>
  wireLog(rig.vehicle)
    .filter((line) => line.startsWith(`${ecu.toString(16)}:`))
    .map((line) => line.slice(line.indexOf(':') + 1));

const withoutKeepalive = (lines: string[]) => lines.filter((line) => !line.startsWith('3e'));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('read-only groups', () => {
  it('reads identity from every ECU and the light status from the FEM', async () => {
    const rig = await startRig();
    const { bench, exchanges } = makeBench(rig);

    const result = await settle(bench.runGroup(identityGroup));

    expect(result).toMatchObject({ status: 'completed' });
    expect(exchanges.map((exchange) => exchange.ecu)).toEqual([0x40, 0x43, 0x44, 0x60, 0x72, 0x40]);
    expect(exchanges.every((exchange) => exchange.outcome.kind === 'positive')).toBe(true);
    expect(exchanges.at(-1)!.request).toEqual(Uint8Array.of(0x22, 0xd5, 0x42));
    expect(rig.context().ledger.hasPending).toBe(false);
    expect(rig.context().testActive).toBe(false);
    expect(rig.phase()).toBe('ready');
  });

  it('continues past a silent module because identity steps tolerate failures', async () => {
    const rig = await startRig(
      new SimulatedVehicle({ profile: { chassis: 'F32', modules: ['FEM_20', 'REM_20'] } }),
    );
    const { bench, exchanges } = makeBench(rig);

    const result = await settle(bench.runGroup(identityGroup));

    expect(result).toMatchObject({ status: 'completed' });
    expect(exchanges.map((exchange) => exchange.outcome.kind)).toEqual([
      'positive',
      'timeout',
      'timeout',
      'timeout',
      'positive',
      'positive',
    ]);
    expect(rig.phase()).toBe('ready');
  });

  it('reads the LHM2 records of both sides', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const result = await settle(bench.runGroup(lhm2ReadGroup));

    expect(result.status).toBe('completed');
    if (result.status === 'blocked') return;
    expect(result.exchanges.map((exchange) => exchange.ecu)).toEqual([0x43, 0x44]);
    for (const exchange of result.exchanges) {
      expect(exchange.outcome.kind).toBe('positive');
      const response = (exchange.outcome as { response: Uint8Array }).response;
      expect(lhm2DataOf(response)).toHaveLength(14);
    }
  });
});

describe('groups that force outputs', () => {
  it('hazard: session, on, wait, off, then default session', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const result = await settle(bench.runGroup(hazardGroup));

    expect(result).toMatchObject({ status: 'completed', cleanup: { restored: true } });
    expect(withoutKeepalive(wire(rig, ECU.fem))).toEqual([
      '1003',
      '2ed54200120064',
      '2ed54200120000',
      '2ed54200120000',
      '1001',
    ]);
    expect(rig.context().ledger.hasPending).toBe(false);
    expect(rig.phase()).toBe('ready');
  });

  it('waits ON_HOLD_MS between on and off', async () => {
    const rig = await startRig();
    const { bench, exchanges } = makeBench(rig);

    const pending = bench.runGroup(hazardGroup);
    const finished = settle(pending);
    await finished;

    const on = exchanges.find((exchange) => exchange.request[6] === 0x64)!;
    const off = exchanges.find(
      (exchange) => exchange.request[6] === 0x00 && exchange.stage === 'step',
    )!;
    expect(off.at - on.at).toBeGreaterThanOrEqual(ON_HOLD_MS);
  });

  it('captures an NRC on D542 indicator, still reads the status and cleans up', async () => {
    const rig = await startRig(makeCar({ conditionsNotCorrect: { requests: 1 } }));
    const { bench } = makeBench(rig);

    const result = await settle(bench.runGroup(d542IndicatorGroup('left')));

    expect(result.status).toBe('completed');
    if (result.status === 'blocked') return;
    const [session, forced, status, off] = result.exchanges;
    expect(session!.outcome.kind).toBe('positive');
    expect(forced!.outcome).toMatchObject({ kind: 'negative', nrc: 0x22 });
    expect(status!.request).toEqual(Uint8Array.of(0x22, 0xd5, 0x42));
    expect(off!.request).toEqual(Uint8Array.of(0x2e, 0xd5, 0x42, 0x00, 0x06, 0x00, 0x00));
    expect(result.cleanup.restored).toBe(true);
    expect(withoutKeepalive(wire(rig, ECU.fem)).at(-1)).toBe('1001');
  });

  it('holds the D542 right indicator when it is accepted', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const result = await settle(bench.runGroup(d542IndicatorGroup('right')));

    expect(result).toMatchObject({ status: 'completed' });
    expect(withoutKeepalive(wire(rig, ECU.fem))).toContain('2ed54200070064');
    expect(rig.vehicle.getLitElements()).toEqual([]);
  });

  it.each([0x10, 0x11, 0x0d, 0x0e])('FEM channel %d: on, off, return control', async (channel) => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    const hexChannel = channel.toString(16).padStart(2, '0');

    const result = await settle(bench.runGroup(femIndicatorGroup(channel)));

    expect(result).toMatchObject({ status: 'completed', cleanup: { restored: true } });
    const lines = withoutKeepalive(wire(rig, ECU.fem));
    expect(lines.slice(0, 5)).toEqual([
      '1003',
      `2f450103${hexChannel}01`,
      `2f450103${hexChannel}00`,
      '2f450100fe',
      `2f450103${hexChannel}00`,
    ]);
    expect(lines.at(-1)).toBe('1001');
  });

  it.each([
    ['left', '20'],
    ['right', '21'],
  ] as const)('REM %s indicator uses channel 0x%s', async (side, channel) => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const result = await settle(bench.runGroup(remIndicatorGroup(side)));

    expect(result).toMatchObject({ status: 'completed' });
    expect(withoutKeepalive(wire(rig, ECU.rem))).toEqual([
      '1003',
      `2e4501${channel}01`,
      `2e4501${channel}00`,
      `2e4501${channel}00`,
      '1001',
    ]);
  });
});

describe('failure and abort handling', () => {
  it('stops at the first negative response and still runs cleanup', async () => {
    const rig = await startRig(makeCar({ conditionsNotCorrect: { requests: 1 } }));
    const { bench } = makeBench(rig);

    const result = await settle(bench.runGroup(hazardGroup));

    expect(result.status).toBe('failed');
    if (result.status === 'blocked') return;
    expect(result.failure).toMatchObject({
      kind: 'step',
      exchange: { outcome: { kind: 'negative', nrc: 0x22 } },
    });
    expect(result.exchanges).toHaveLength(2);
    expect(withoutKeepalive(wire(rig, ECU.fem))).toEqual(['1003', '2ed54200120000', '1001']);
    expect(rig.context().ledger.hasPending).toBe(false);
    expect(rig.phase()).toBe('ready');
  });

  it('aborts while waiting and runs cleanup', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const pending = bench.runGroup(hazardGroup);
    await advanceUntil(() => rig.vehicle.requestLog.length >= 2, 10, 5000);
    expect(bench.isBusy).toBe(true);
    bench.abort();
    const result = await settle(pending);

    expect(result).toMatchObject({ status: 'aborted', cleanup: { restored: true } });
    expect(withoutKeepalive(wire(rig, ECU.fem)).slice(-2)).toEqual(['2ed54200120000', '1001']);
    expect(rig.phase()).toBe('ready');
    expect(bench.isBusy).toBe(false);
  });

  it('reports an unexpected error and an invalid channel as failures', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const unexpected = await settle(
      bench.runGroup(async () => {
        throw new Error('boom');
      }),
    );
    const invalid = await settle(
      bench.runGroup(lhm2WriteGroup({ ecu: ECU.lhm2Left, channel: 9, holdMs: 500 })),
    );

    expect(unexpected).toMatchObject({
      status: 'failed',
      failure: { kind: 'error', code: 'unexpected', message: 'boom' },
    });
    expect(invalid).toMatchObject({
      status: 'failed',
      failure: { kind: 'error', code: 'invalidChannel' },
    });
  });

  it('rejects a second run while one is in progress', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const first = bench.runGroup(hazardGroup);
    const second = await bench.runGroup(identityGroup);
    await settle(first);

    expect(second).toEqual({ status: 'blocked', reason: 'busy' });
  });
});

describe('LHM2 single-channel write', () => {
  const params = { ecu: ECU.lhm2Left, channel: 3, holdMs: 800 };

  it('writes the baseline with one PWM byte at 0xFA, restores it, then releases the module', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const result = await settle(bench.runGroup(lhm2WriteGroup(params)));

    expect(result).toMatchObject({ status: 'completed', cleanup: { restored: true } });
    const baseline = '00000000000000' + '14141414141414';
    expect(withoutKeepalive(wire(rig, ECU.lhm2Left))).toEqual([
      '1003',
      '226060',
      '280201',
      `2e60600000fa0000000014141414141414`,
      `2e6060${baseline}`,
      `2e6060${baseline}`,
      '280003',
      '1001',
    ]);
    expect(rig.context().ledger.hasPending).toBe(false);
  });

  it('aborts without writing when the baseline cannot be read', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    const group = lhm2WriteGroup({ ...params, ecu: 0x60 });

    const result = await settle(bench.runGroup(group));

    expect(result.status).toBe('failed');
    if (result.status === 'blocked') return;
    expect(result.failure).toMatchObject({
      kind: 'step',
      exchange: { outcome: { kind: 'negative' } },
    });
    expect(withoutKeepalive(wire(rig, 0x60))).toEqual(['1003', '226060', '1001']);
  });

  it('puts the baseline back when the write is aborted mid-hold', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const pending = bench.runGroup(lhm2WriteGroup({ ...params, holdMs: 3000 }));
    await advanceUntil(() => wire(rig, ECU.lhm2Left).some((line) => line.includes('fa')), 10, 5000);
    bench.abort();
    const result = await settle(pending);

    expect(result).toMatchObject({ status: 'aborted', cleanup: { restored: true } });
    const lines = withoutKeepalive(wire(rig, ECU.lhm2Left));
    expect(lines.slice(-3)).toEqual(['2e60600000000000000014141414141414', '280003', '1001']);
  });

  it('rejects a baseline of the wrong length', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    const link = rig.context().link!;
    const request = link.request.bind(link);
    jest
      .spyOn(link, 'request')
      .mockImplementation((ecu, payload, options) =>
        payload[0] === 0x22 && payload[1] === 0x60
          ? Promise.resolve(Uint8Array.of(0x62, 0x60, 0x60, 1, 2, 3))
          : request(ecu, payload, options),
      );

    const result = await settle(bench.runGroup(lhm2WriteGroup(params)));

    expect(result).toMatchObject({
      status: 'failed',
      failure: { kind: 'error', code: 'invalidBaseline' },
    });
    expect(withoutKeepalive(wire(rig, ECU.lhm2Left))).toEqual(['1003', '1001']);
  });
});

describe('gating against effects and toggles', () => {
  it('blocks tests while an effect is running', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    const effect = rig
      .context()
      .car!.effects.find((candidate) => candidate.id === 'flash.indicatorLeft')!;

    rig.actor.send({ type: 'RUN', item: effect });
    expect(rig.phase()).toBe('running');
    const result = await bench.runGroup(identityGroup);

    expect(result).toEqual({ status: 'blocked', reason: 'effectRunning' });
    await rig.waitFor('ready');
  });

  it('blocks tests while a toggle is held', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    const toggle = rig.context().car!.effects.find((candidate) => candidate.kind === 'toggle')!;

    rig.actor.send({ type: 'TOGGLE', effectId: toggle.id, on: true });
    await rig.waitFor('ready');
    const result = await bench.runGroup(identityGroup);

    expect(rig.context().activeToggles).toContain(toggle.id);
    expect(result).toEqual({ status: 'blocked', reason: 'toggleActive' });
  });

  it('blocks tests when not connected', async () => {
    const rig = createRig(makeCar());
    const { bench } = makeBench(rig);

    expect(await bench.runGroup(identityGroup)).toEqual({ status: 'blocked', reason: 'notReady' });
  });

  it('ignores runs and toggles while a test is engaged', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    const effect = rig
      .context()
      .car!.effects.find((candidate) => candidate.id === 'flash.indicatorLeft')!;
    const toggle = rig.context().car!.effects.find((candidate) => candidate.kind === 'toggle')!;

    const pending = bench.runGroup(hazardGroup);
    await advanceUntil(() => rig.context().testActive, 5, 1000);
    rig.actor.send({ type: 'RUN', item: effect });
    rig.actor.send({ type: 'TOGGLE', effectId: toggle.id, on: true });

    expect(rig.phase()).toBe('ready');
    expect(rig.context().lastError).toBeUndefined();
    await settle(pending);
    expect(rig.context().testActive).toBe(false);
    expect(rig.context().activeToggles).toEqual([]);

    rig.actor.send({ type: 'RUN', item: effect });
    expect(rig.phase()).toBe('running');
    await rig.waitFor('ready');
  });
});

describe('raw commands', () => {
  it('sends safe services directly without holding the test open', async () => {
    const rig = await startRig();
    const { bench, exchanges } = makeBench(rig);

    const result = await settle(bench.sendRaw(0x40, Uint8Array.of(0x22, 0xf1, 0x50)));

    expect(result).toMatchObject({ status: 'sent', exchange: { outcome: { kind: 'positive' } } });
    expect(exchanges).toHaveLength(1);
    expect(bench.isHeld).toBe(false);
    expect(rig.context().testActive).toBe(false);
    expect(rig.context().ledger.hasPending).toBe(false);
  });

  it('surfaces an NRC for an unsupported request', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    const result = await settle(bench.sendRaw(0x40, Uint8Array.of(0x22, 0x12, 0x34)));

    expect(result).toMatchObject({
      status: 'sent',
      exchange: { outcome: { kind: 'negative', nrc: 0x31 } },
    });
  });

  it('holds the session for risky services, keeps it alive, and releases through cleanup', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    const keepalive = Buffer.from(loadModule('REM_20').keepalive).toString('hex');

    await settle(bench.sendRaw(ECU.rem, Uint8Array.of(0x10, 0x03)));
    await settle(bench.sendRaw(ECU.rem, Uint8Array.of(0x28, 0x02, 0x01)));

    expect(bench.isHeld).toBe(true);
    expect(rig.context().testActive).toBe(true);
    expect(rig.context().ledger.hasPending).toBe(true);
    await advanceUntil(() => wire(rig, ECU.rem).includes(keepalive), 20, 3000);

    const released = await settle(bench.release());

    expect(released).toMatchObject({ status: 'completed', cleanup: { restored: true } });
    expect(withoutKeepalive(wire(rig, ECU.rem)).slice(-2)).toEqual(['280003', '1001']);
    expect(bench.isHeld).toBe(false);
    expect(rig.context().testActive).toBe(false);
    expect(rig.context().ledger.hasPending).toBe(false);
  });

  it('release does nothing when nothing is held', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);

    expect(await bench.release()).toBeUndefined();
  });

  it('clears the hold when the session leaves ready', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    await settle(bench.sendRaw(ECU.rem, Uint8Array.of(0x10, 0x03)));

    rig.actor.send({ type: 'DISCONNECT' });
    bench.notifyPhase('disconnecting');
    await rig.waitFor('disconnected');

    expect(bench.isHeld).toBe(false);
    expect(await bench.release()).toBeUndefined();
    bench.notifyPhase('ready');
  });

  it('release resets the hold when the session is no longer ready', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    await settle(bench.sendRaw(ECU.rem, Uint8Array.of(0x10, 0x03)));

    rig.actor.send({ type: 'DISCONNECT' });
    await rig.waitFor('disconnected');

    expect(await bench.release()).toBeUndefined();
    expect(bench.isHeld).toBe(false);
  });

  it('reports blocked when sending while an effect runs', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    const effect = rig
      .context()
      .car!.effects.find((candidate) => candidate.id === 'flash.indicatorLeft')!;

    rig.actor.send({ type: 'RUN', item: effect });

    expect(await bench.sendRaw(0x40, Uint8Array.of(0x22, 0xf1, 0x50))).toEqual({
      status: 'blocked',
      reason: 'effectRunning',
    });
    await rig.waitFor('ready');
  });
});

describe('TestSession', () => {
  it('reports an unfinished cleanup when the restore itself throws', async () => {
    const rig = await startRig();
    const session = new TestSession({
      link: rig.context().link!,
      ledger: rig.context().ledger,
      restore: () => Promise.reject(new Error('boom')),
    });

    expect(await session.cleanup()).toEqual({ restored: false, failures: [] });
    expect(session.touchedEcus).toEqual([]);
    session.arm(ECU.fem);
    session.silence(ECU.fem);
    expect(session.touchedEcus).toEqual([ECU.fem]);
    expect(session.silencedEcus).toEqual([ECU.fem]);
  });

  it('wait resolves false when the signal is already aborted', async () => {
    const rig = await startRig();
    const session = new TestSession({
      link: rig.context().link!,
      ledger: rig.context().ledger,
      restore: () => Promise.resolve({ restored: true, failures: [] }),
    });
    const controller = new AbortController();
    controller.abort();

    expect(await session.wait(10, controller.signal)).toBe(false);
  });
});

describe('held notifications', () => {
  it('tells the host when a raw session opens and when it is released', async () => {
    const rig = await startRig();
    const changes: boolean[] = [];
    const bench = new TestBench({ host: rig.actor, onHeldChange: (held) => changes.push(held) });

    await settle(bench.sendRaw(ECU.rem, Uint8Array.of(0x10, 0x03)));
    await settle(bench.release());

    expect(changes).toEqual([true, false]);
  });
});

describe('cleanup all', () => {
  it('returns control, re-enables communication and resets every touched ECU', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    await settle(bench.runGroup(lhm2WriteGroup({ ecu: ECU.lhm2Right, channel: 1, holdMs: 300 })));
    await settle(bench.runGroup(remIndicatorGroup('left')));
    rig.vehicle.clearLog();

    const result = await settle(bench.runGroup(cleanupAllGroup(bench.usage)));

    expect(result).toMatchObject({ status: 'completed' });
    expect(withoutKeepalive(wire(rig, ECU.fem))).toEqual(['2f450100fe']);
    expect(withoutKeepalive(wire(rig, ECU.lhm2Right))).toEqual(['280003', '1001']);
    expect(withoutKeepalive(wire(rig, ECU.rem))).toEqual(['1001']);
    expect(bench.usage.touched).toEqual(new Set([ECU.lhm2Right, ECU.rem]));
  });

  it('keeps going when an ECU refuses, even after abort', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    bench.usage.touched.add(0x60);
    bench.usage.silenced.add(0x60);

    const pending = bench.runGroup(cleanupAllGroup(bench.usage));
    bench.abort();
    const result = await settle(pending);

    expect(result.status).toBe('completed');
    expect(withoutKeepalive(wire(rig, 0x60))).toEqual(['280003', '1001']);
  });
});

describe('link loss during a test', () => {
  it('reconnects and restores what the test forced through the ledger', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    rig.vehicle.faults.configure({ dropAfterRequests: 2 });

    const result = await settle(bench.runGroup(hazardGroup));
    rig.vehicle.faults.configure({ dropAfterRequests: undefined });
    await rig.waitFor('ready');

    expect(result.status).toBe('failed');
    expect(rig.links.length).toBeGreaterThan(1);
    expect(rig.context().ledger.hasPending).toBe(false);
    expect(rig.context().testActive).toBe(false);
    expect(rig.vehicle.getLitElements()).toEqual([]);
    const lines = withoutKeepalive(wire(rig, ECU.fem));
    expect(lines.slice(-3)).toEqual(['1003', '2ed54200120000', '1001']);
  });

  it('writes the stored LHM2 baseline back after reconnecting', async () => {
    const rig = await startRig();
    const { bench } = makeBench(rig);
    rig.vehicle.faults.configure({ dropAfterRequests: 4 });
    const params = { ecu: ECU.lhm2Left, channel: 2, holdMs: 300 };

    const result = await settle(bench.runGroup(lhm2WriteGroup(params)));
    rig.vehicle.faults.configure({ dropAfterRequests: undefined });
    await rig.waitFor('ready');

    expect(result.status).toBe('failed');
    expect(rig.context().ledger.hasPending).toBe(false);
    expect(withoutKeepalive(wire(rig, ECU.lhm2Left)).slice(-4)).toEqual([
      '1003',
      '2e60600000000000000014141414141414',
      '280003',
      '1001',
    ]);
  });
});
