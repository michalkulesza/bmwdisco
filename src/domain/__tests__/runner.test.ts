import { loadModule } from '@/data/generated';
import type { Effect } from '@/data/types';
import { RunLimitError, NothingToRunError } from '@/domain/errors';
import { parsePreset } from '@/domain/preset/schema';
import type { DetectedCar } from '@/domain/registry/types';
import { classifyRunError } from '@/domain/runner/classify';
import { ControlLedger } from '@/domain/runner/ledger';
import { PresetRunner } from '@/domain/runner/runner';
import type { RunnableItem, RunnerEvent } from '@/domain/runner/types';
import type { DiagnosticLink } from '@/link/types';
import { hex } from '@/protocol/bytes';
import { NegativeResponseError } from '@/protocol/errors';
import type { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import { detectOnSim, litIds, makeVehicle, settle, wireLog } from '@/test-utils/domain-sim';

const fem = loadModule('FEM_20');
const komb25 = loadModule('KOMB25');
const frm = loadModule('FRM3');
const bytes = (payload: readonly number[]) =>
  hex(Uint8Array.from(payload)).replaceAll(' ', '').toLowerCase();
const FEM = 0x40;

interface Harness {
  vehicle: SimulatedVehicle;
  link: DiagnosticLink;
  car: DetectedCar;
  runner: PresetRunner;
  ledger: ControlLedger;
  events: RunnerEvent[];
}

const harness = async (
  chassis = 'F20',
  options: { rttMs?: number | null; trace?: boolean; led?: boolean } = {},
): Promise<Harness> => {
  jest.useRealTimers();
  const vehicle = makeVehicle(chassis, undefined, 1, options.led);
  const { link, car } = await detectOnSim(vehicle);
  if (options.rttMs !== undefined) {
    Object.defineProperty(link, 'measuredRttMs', { get: () => options.rttMs });
  }
  const ledger = new ControlLedger();
  const events: RunnerEvent[] = [];
  const runner = new PresetRunner({
    link,
    car,
    ledger,
    onEvent: (event) => events.push(event),
    trace: options.trace,
  });
  vehicle.clearLog();
  jest.useFakeTimers();

  return { vehicle, link, car, runner, ledger, events };
};

const enterExtended = (link: DiagnosticLink, ecu: number) =>
  link.request(ecu, Uint8Array.of(0x10, 0x03));

const presetItem = (steps: unknown[], id = 'test'): RunnableItem => ({
  kind: 'preset',
  preset: { id, name: 'Test', color: 'blue', icon: 'Car', steps } as never,
});

const effectNamed = (car: DetectedCar, id: string): Effect => {
  const effect = car.effects.find((candidate) => candidate.id === id);
  if (!effect) throw new Error(`effect ${id} unavailable`);

  return effect;
};

afterEach(() => {
  jest.useRealTimers();
});

describe('PresetRunner bytes and order', () => {
  it('sends sessions, cluster feedback, steps and the full cleanup in order', async () => {
    const { runner, car, vehicle } = await harness();

    const result = await settle(
      runner.run({ kind: 'effect', effect: effectNamed(car, 'flash.lowBeamLeft') }),
    );

    const lowBeam = fem.elements.lowBeamLeft!;
    const cluster = komb25.elements.clusterFeedback!;
    expect(wireLog(vehicle)).toEqual([
      `40:1003`,
      `60:1003`,
      `60:${bytes(cluster.on)}`,
      `40:${bytes(lowBeam.on)}`,
      `40:${bytes(lowBeam.off)}`,
      `40:${bytes(lowBeam.off)}`,
      `60:${bytes(cluster.off)}`,
      `40:${bytes(fem.returnControl[0]!)}`,
      `40:1001`,
      `60:1001`,
    ]);
    expect(result.status).toBe('completed');
    expect(result.cleanup).toEqual({ restored: true, failures: [] });
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('runs a preset exactly as written, including multi-element steps', async () => {
    const { runner, vehicle } = await harness();
    const preset = parsePreset({
      id: 'p',
      name: 'N',
      color: 'blue',
      icon: 'Car',
      steps: [
        { type: 'set', elements: ['lowBeamLeft', 'lowBeamRight'], state: 'on', durationMs: 100 },
        { type: 'set', elements: ['lowBeamLeft', 'lowBeamRight'], state: 'off' },
      ],
    });

    await settle(runner.run({ kind: 'preset', preset }));

    const left = fem.elements.lowBeamLeft!;
    const right = fem.elements.lowBeamRight!;
    expect(wireLog(vehicle).slice(0, 6)).toEqual([
      '40:1003',
      `40:${bytes(left.on)}`,
      `40:${bytes(right.on)}`,
      `40:${bytes(left.off)}`,
      `40:${bytes(right.off)}`,
      `40:${bytes(left.off)}`,
    ]);
  });

  it('silences communication before headlight LED effects and restores it with 28 00 03', async () => {
    const { runner, car, vehicle } = await harness('F20', { led: true });
    const effect = car.effects.find(
      (candidate) =>
        candidate.silenceCommunication && candidate.id.startsWith('headlight_flash.leftHeadlight'),
    )!;

    const result = await settle(runner.run({ kind: 'effect', effect }));

    const log = wireLog(vehicle);
    const silence = log.indexOf('43:280201');
    const restore = log.indexOf('43:280003');
    expect(silence).toBeGreaterThan(log.indexOf('43:1003'));
    expect(silence).toBeLessThan(log.findIndex((entry) => entry.startsWith('43:31')));
    expect(restore).toBeGreaterThan(
      log.lastIndexOf(log.find((entry) => entry.startsWith('43:31'))!),
    );
    expect(log.indexOf('43:1001')).toBeGreaterThan(restore);
    expect(result.cleanup.restored).toBe(true);
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('cleans up in the documented order: off, return control, communication, default session', async () => {
    const { runner, car, vehicle } = await harness('F20', { led: true });
    const effect = car.effects.find((candidate) => candidate.silenceCommunication)!;

    await settle(runner.run({ kind: 'effect', effect }));

    const log = wireLog(vehicle);
    const firstReturnControl = log.indexOf(`40:${bytes(fem.returnControl[0]!)}`);
    const lastDefault = log.lastIndexOf('43:1001');
    expect(log.indexOf('43:280003')).toBeGreaterThan(-1);
    expect(firstReturnControl === -1 || firstReturnControl < log.indexOf('43:280003')).toBe(true);
    expect(log.indexOf('43:280003')).toBeLessThan(lastDefault);
  });

  it('can re-enter the extended session before restoring on a fresh link', async () => {
    const { runner, ledger, vehicle } = await harness();
    ledger.touch(fem, 'lowBeamLeft');

    const report = await settle(runner.restore({ reenterSession: true }));

    const lowBeam = fem.elements.lowBeamLeft!;
    expect(wireLog(vehicle)).toEqual([
      '40:1003',
      `40:${bytes(lowBeam.off)}`,
      `40:${bytes(fem.returnControl[0]!)}`,
      '40:1001',
    ]);
    expect(report.restored).toBe(true);
    expect(ledger.hasPending).toBe(false);
  });

  it('has no return-control step for FRM3, relying on element off and 10 01', async () => {
    const { runner, car, vehicle } = await harness('F10');

    await settle(runner.run(presetItem([{ type: 'set', elements: ['lowBeamLeft'], state: 'on' }])));

    const off = frm.elements.lowBeamLeft!.off;
    expect(wireLog(vehicle)).toEqual([
      '72:1003',
      `72:${bytes(frm.elements.lowBeamLeft!.on)}`,
      `72:${bytes(off)}`,
      '72:1001',
    ]);
    expect(car.modules.some((module) => module.sgbd === 'FRM3')).toBe(true);
  });
});

describe('PresetRunner timing', () => {
  it('keeps step times drift-free on the absolute timeline', async () => {
    const { runner, vehicle } = await harness();
    vehicle.faults.configure({ latency: { fixedMs: 7, jitterMs: 0 } });
    const steps = Array.from({ length: 6 }, (_, index) => ({
      type: 'set',
      elements: ['lowBeamLeft'],
      state: index % 2 === 0 ? 'on' : 'off',
      durationMs: 100,
    }));

    await settle(runner.run(presetItem(steps)));

    const starts = vehicle.requestLog
      .filter((entry) => entry.request[0] === 0x2f)
      .slice(0, 6)
      .map((entry) => entry.at);
    starts.forEach((at, index) => expect(at - starts[0]!).toBe(index * 100));
  });

  it('honours wait steps and trailing durations', async () => {
    const { runner, vehicle } = await harness();

    await settle(
      runner.run(
        presetItem([
          { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 100 },
          { type: 'wait', ms: 200 },
          { type: 'set', elements: ['lowBeamLeft'], state: 'off' },
        ]),
      ),
    );

    const [on, off] = vehicle.requestLog.filter((entry) => entry.request[0] === 0x2f);
    expect(off!.at - on!.at).toBe(300);
  });

  it('warns once when a preset is faster than the adapter round trip', async () => {
    const { runner, events } = await harness('F20', { rttMs: 80 });

    await settle(
      runner.run(
        presetItem([
          { type: 'set', elements: ['lowBeamLeft', 'lowBeamRight'], state: 'on', durationMs: 50 },
          { type: 'set', elements: ['lowBeamLeft', 'lowBeamRight'], state: 'off', durationMs: 50 },
          { type: 'set', elements: ['lowBeamLeft'], state: 'on' },
        ]),
      ),
    );

    const warnings = events.filter((event) => event.type === 'tooFast');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ rttMs: 80, requiredMs: 160, availableMs: 50 });
  });

  it('rebases the timeline when the link falls behind instead of bursting', async () => {
    const { runner, vehicle, events } = await harness('F20', { rttMs: null });
    vehicle.faults.configure({ latency: { fixedMs: 120, jitterMs: 0 } });

    await settle(
      runner.run(
        presetItem([
          { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 50 },
          { type: 'set', elements: ['lowBeamLeft'], state: 'off', durationMs: 50 },
          { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 50 },
          { type: 'set', elements: ['lowBeamLeft'], state: 'off' },
        ]),
      ),
    );

    const times = vehicle.requestLog.filter((entry) => entry.request[0] === 0x2f).map((e) => e.at);
    expect(times[2]! - times[1]!).toBeGreaterThanOrEqual(120);
    expect(events.filter((event) => event.type === 'tooFast')).toHaveLength(1);
  });
});

describe('PresetRunner element resolution', () => {
  it('skips elements this car does not have and reports them', async () => {
    const { runner, events, vehicle } = await harness('F10');

    const result = await settle(
      runner.run(
        presetItem([
          { type: 'set', elements: ['lowBeamLeft', 'corneringLeft'], state: 'on', durationMs: 50 },
          { type: 'set', elements: ['lowBeamLeft'], state: 'off' },
        ]),
      ),
    );

    expect(result.status).toBe('completed');
    expect(result.skipped).toEqual(['corneringLeft']);
    expect(events).toContainEqual({ type: 'elementSkipped', element: 'corneringLeft' });
    expect(wireLog(vehicle).every((entry) => entry.startsWith('72:'))).toBe(true);
  });

  it('fails without touching the car when nothing is runnable', async () => {
    const { runner, vehicle, ledger } = await harness('F10');

    const result = await settle(
      runner.run(presetItem([{ type: 'set', elements: ['corneringLeft'], state: 'on' }])),
    );

    expect(result.status).toBe('failed');
    expect(result.error).toBeInstanceOf(NothingToRunError);
    expect(classifyRunError(result.error)).toBe('nothingToRun');
    expect(vehicle.requestLog).toEqual([]);
    expect(ledger.hasPending).toBe(false);
  });

  it('emits request events only when tracing', async () => {
    const quiet = await harness();
    await settle(
      quiet.runner.run(presetItem([{ type: 'set', elements: ['lowBeamLeft'], state: 'on' }])),
    );
    const traced = await harness('F20', { trace: true });
    await settle(
      traced.runner.run(presetItem([{ type: 'set', elements: ['lowBeamLeft'], state: 'on' }])),
    );

    expect(
      quiet.events.some((event) => event.type === 'request' || event.type === 'response'),
    ).toBe(false);
    expect(traced.events.some((event) => event.type === 'response')).toBe(true);
    expect(traced.events.filter((event) => event.type === 'request').length).toBeGreaterThan(3);
  });
});

describe('PresetRunner failures', () => {
  it('surfaces NRC 0x22 as a typed error and still restores everything', async () => {
    const { runner, vehicle } = await harness();
    vehicle.faults.configure({ conditionsNotCorrect: { requests: 1 } });

    const result = await settle(
      runner.run(
        presetItem([
          { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 50 },
          { type: 'set', elements: ['lowBeamRight'], state: 'on' },
        ]),
      ),
    );

    expect(result.status).toBe('failed');
    expect(result.error).toBeInstanceOf(NegativeResponseError);
    expect((result.error as NegativeResponseError).nrc).toBe(0x22);
    expect(classifyRunError(result.error)).toBe('conditionsNotCorrect');
    expect(result.cleanup.restored).toBe(true);
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('keeps going when only the cluster feedback routine is rejected', async () => {
    const { runner, car, vehicle, events } = await harness();
    vehicle.faults.configure({ conditionsNotCorrect: { requests: 1 } });

    const result = await settle(
      runner.run({ kind: 'effect', effect: effectNamed(car, 'flash.lowBeamLeft') }),
    );

    expect(result.status).toBe('completed');
    expect(events.some((event) => event.type === 'clusterFeedbackFailed')).toBe(true);
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it.each(['hold', 'loop'] as const)(
    'runs %s beyond 90 seconds and restores on Stop',
    async (playback) => {
      const { runner, vehicle, ledger } = await harness();
      const controller = new AbortController();
      const preset = parsePreset({
        id: 'continuous',
        name: 'Continuous',
        color: 'blue',
        icon: 'Car',
        ...(playback === 'hold' ? { playback } : {}),
        steps: [
          { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 60_000 },
          ...(playback === 'loop' ? [{ type: 'loop' }] : []),
        ],
      });
      let finished = false;
      const pending = runner.run({ kind: 'preset', preset }, controller.signal).then((result) => {
        finished = true;
        return result;
      });
      await jest.advanceTimersByTimeAsync(95_000);
      expect(finished).toBe(false);
      expect(litIds(vehicle)).toEqual(['FEM_20:lowBeamLeft']);
      const onCommands = wireLog(vehicle).filter(
        (entry) => entry === `40:${bytes(fem.elements.lowBeamLeft!.on)}`,
      );
      expect(onCommands).toHaveLength(playback === 'loop' ? 2 : 1);
      controller.abort();
      const result = await settle(pending);
      expect(result.status).toBe('aborted');
      expect(result.cleanup.restored).toBe(true);
      expect(ledger.hasPending).toBe(false);
      expect(vehicle.getLitElements()).toEqual([]);
    },
  );

  it('yields during a loop with only immediate blocks so Stop can interrupt it', async () => {
    const { runner, vehicle } = await harness();
    const controller = new AbortController();
    const preset = parsePreset({
      id: 'immediate-loop',
      name: 'Immediate loop',
      color: 'blue',
      icon: 'Car',
      steps: [{ type: 'set', elements: ['lowBeamLeft'], state: 'on' }, { type: 'loop' }],
    });
    const pending = runner.run({ kind: 'preset', preset }, controller.signal);
    await jest.advanceTimersByTimeAsync(200);
    expect(
      wireLog(vehicle).filter((entry) => entry === `40:${bytes(fem.elements.lowBeamLeft!.on)}`)
        .length,
    ).toBeGreaterThan(1);
    controller.abort();
    expect((await settle(pending)).cleanup.restored).toBe(true);
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('cancels between steps, restores and reports aborted', async () => {
    const { runner, vehicle } = await harness();
    const controller = new AbortController();
    const startedAt = Date.now();

    const pending = runner.run(
      presetItem([
        { type: 'set', elements: ['lowBeamLeft'], state: 'on' },
        { type: 'wait', ms: 5000 },
        { type: 'set', elements: ['lowBeamLeft'], state: 'off' },
      ]),
      controller.signal,
    );
    await jest.advanceTimersByTimeAsync(1000);
    expect(litIds(vehicle)).toEqual(['FEM_20:lowBeamLeft']);
    controller.abort();
    const result = await settle(pending);

    expect(result.status).toBe('aborted');
    expect(result.cleanup.restored).toBe(true);
    expect(vehicle.getLitElements()).toEqual([]);
    expect(Date.now() - startedAt).toBeLessThan(2500);
  });

  it('stops between the elements of one step when aborted', async () => {
    const { runner, vehicle } = await harness();
    const controller = new AbortController();
    const original = vehicle.handle.bind(vehicle);
    jest.spyOn(vehicle, 'handle').mockImplementation((ecu, request) => {
      if (request[0] === 0x2f) controller.abort();

      return original(ecu, request);
    });

    const result = await settle(
      runner.run(
        presetItem([{ type: 'set', elements: ['lowBeamLeft', 'lowBeamRight'], state: 'on' }]),
        controller.signal,
      ),
    );

    expect(result.status).toBe('aborted');
    expect(
      wireLog(vehicle).filter((entry) => entry.startsWith('40:2f') && entry.includes('01')).length,
    ).toBeLessThan(5);
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('treats an already-aborted signal as a stop before any step', async () => {
    const { runner, vehicle } = await harness();
    const controller = new AbortController();
    controller.abort();

    const result = await settle(
      runner.run(
        presetItem([{ type: 'set', elements: ['lowBeamLeft'], state: 'on' }]),
        controller.signal,
      ),
    );

    expect(result.status).toBe('aborted');
    expect(vehicle.getLitElements()).toEqual([]);
    expect(
      wireLog(vehicle).some((entry) => entry === `40:${bytes(fem.elements.lowBeamLeft!.on)}`),
    ).toBe(false);
  });

  it('enforces the 90 second hard limit even for unvalidated input', async () => {
    const { runner, vehicle } = await harness();
    const startedAt = Date.now();

    const result = await settle(
      runner.run(
        presetItem([
          { type: 'set', elements: ['lowBeamLeft'], state: 'on' },
          { type: 'wait', ms: 120_000 },
          { type: 'set', elements: ['lowBeamLeft'], state: 'off' },
        ]),
      ),
    );

    expect(result.status).toBe('timeout');
    expect(result.error).toBeInstanceOf(RunLimitError);
    expect(classifyRunError(result.error)).toBe('limitExceeded');
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(90_000);
    expect(Date.now() - startedAt).toBeLessThan(92_000);
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('cleans up even if execute itself throws', async () => {
    const { runner, ledger, vehicle, link } = await harness();
    await settle(enterExtended(link, FEM));
    ledger.touch(fem, 'lowBeamLeft');
    jest.spyOn(runner, 'execute').mockRejectedValue(new Error('boom'));

    const outcome = settle(runner.run(presetItem([{ type: 'wait', ms: 50 }])));

    await expect(outcome).rejects.toThrow('boom');
    expect(ledger.hasPending).toBe(false);
    expect(wireLog(vehicle)).toContain('40:1001');
  });

  it('reports a dead link without hanging and keeps the ledger for a later restore', async () => {
    const { runner, link, ledger } = await harness();
    ledger.touch(fem, 'lowBeamLeft');
    await link.close();

    const report = await runner.restore();

    expect(report.restored).toBe(false);
    expect(report.failures).toEqual([expect.objectContaining({ sgbd: 'FEM_20', step: 'link' })]);
    expect(ledger.hasPending).toBe(true);
  });

  it('is best effort: one failed step does not stop the rest, and a retry finishes the job', async () => {
    const { runner, ledger, link, vehicle } = await harness();
    await settle(enterExtended(link, FEM));
    ledger.touch(fem, 'lowBeamLeft');
    ledger.touch(fem, 'lowBeamRight');
    const request = link.request.bind(link);
    const failOnce = jest
      .spyOn(link, 'request')
      .mockImplementationOnce(() => Promise.reject(new NegativeResponseError(0x2f, 0x22)));
    failOnce.mockImplementation(request);

    const first = await settle(runner.restore());

    expect(first.restored).toBe(false);
    expect(first.failures).toHaveLength(1);
    expect(first.failures[0]).toMatchObject({ step: 'elementOff', element: 'lowBeamLeft' });
    const log = wireLog(vehicle);
    expect(log).toContain(`40:${bytes(fem.elements.lowBeamRight!.off)}`);
    expect(log).toContain(`40:${bytes(fem.returnControl[0]!)}`);
    expect(log).toContain('40:1001');
    expect(ledger.hasPending).toBe(true);

    const second = await settle(runner.restore());

    expect(second).toEqual({ restored: true, failures: [] });
    expect(ledger.hasPending).toBe(false);
  });

  it('shares one cleanup between concurrent restore calls and no-ops when nothing is pending', async () => {
    const { runner, ledger, events } = await harness();

    expect(await runner.restore()).toEqual({ restored: true, failures: [] });
    expect(events.some((event) => event.type === 'restoring')).toBe(false);

    ledger.touch(fem, 'lowBeamLeft');
    const [a, b] = await settle(Promise.all([runner.restore(), runner.restore()]));

    expect(a).toBe(b);
    expect(events.filter((event) => event.type === 'restoring')).toHaveLength(1);
  });
});

describe('PresetRunner toggles', () => {
  it('holds the lights on after switching on and releases them on off plus restore', async () => {
    const { runner, car, vehicle, ledger } = await harness();
    const effect = effectNamed(car, 'toggle.hazard');

    const on = await settle(runner.execute({ kind: 'effect', effect, on: true }));

    expect(on.status).toBe('completed');
    expect(vehicle.getLitElements().length).toBeGreaterThan(0);
    expect(ledger.hasPending).toBe(true);

    const off = await settle(runner.execute({ kind: 'effect', effect, on: false }));
    const report = await settle(runner.restore());

    expect(off.status).toBe('completed');
    expect(report.restored).toBe(true);
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('does not silence communication again when switching off', async () => {
    const { runner, car, vehicle } = await harness();
    const effect = {
      ...effectNamed(car, 'toggle.hazard'),
      silenceCommunication: true,
      clusterFeedback: true,
    };

    await settle(runner.execute({ kind: 'effect', effect, on: false }));

    expect(wireLog(vehicle).some((entry) => entry.endsWith(':280201'))).toBe(false);
    expect(wireLog(vehicle).some((entry) => entry.startsWith('60:31'))).toBe(false);
  });
});

describe('PresetRunner link loss', () => {
  it('reports failure and an unconfirmed restore when the link drops mid-run', async () => {
    const { runner, vehicle } = await harness();
    vehicle.faults.configure({ dropAfterRequests: 2 });

    const result = await settle(
      runner.run(
        presetItem([
          { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 100 },
          { type: 'set', elements: ['lowBeamRight'], state: 'on', durationMs: 100 },
          { type: 'set', elements: ['frontFogLeft'], state: 'on' },
        ]),
      ),
    );

    expect(result.status).toBe('failed');
    expect(classifyRunError(result.error)).toBe('connectionLost');
    expect(result.cleanup.restored).toBe(false);
    expect(vehicle.getLitElements().length).toBeGreaterThan(0);
  });
});
