import { loadEffects } from '@/data/generated';
import {
  CarNotRespondingError,
  InvalidPresetError,
  NothingToRunError,
  RunLimitError,
  UnsupportedVehicleError,
} from '@/domain/errors';
import { classifyRunError, classifySessionError } from '@/domain/runner/classify';
import { buildPlan, planInputOf } from '@/domain/runner/plan';
import type { ExecutionResult, RunnerEvent } from '@/domain/runner/types';
import { openNewLink } from '@/domain/session/actors';
import {
  backoffMs,
  describeRunnerEvent,
  isEffect,
  noticeOf,
  tileForResult,
  togglesAfter,
} from '@/domain/session/helpers';
import type { SessionDeps } from '@/domain/session/types';
import { SimLink } from '@/link/sim-link';
import {
  AdapterError,
  CancelledError,
  LinkClosedError,
  NegativeResponseError,
  TimeoutError,
} from '@/protocol/errors';
import { detectOnSim, makeVehicle } from '@/test-utils/domain-sim';

describe('classifyRunError', () => {
  it.each([
    [new NegativeResponseError(0x2f, 0x22), 'conditionsNotCorrect'],
    [new NegativeResponseError(0x2f, 0x31), 'rejected'],
    [new TimeoutError('response'), 'timeout'],
    [new LinkClosedError(), 'connectionLost'],
    [new AdapterError('no-data'), 'connectionLost'],
    [new RunLimitError(90_000), 'limitExceeded'],
    [new NothingToRunError(), 'nothingToRun'],
    [new InvalidPresetError(['x']), 'invalidPreset'],
    [new CancelledError(), 'unknown'],
    ['text', 'unknown'],
  ])('maps %s to %s', (error, reason) => {
    expect(classifyRunError(error)).toBe(reason);
  });
});

describe('classifySessionError', () => {
  it.each([
    [new UnsupportedVehicleError([1]), 'unsupportedVehicle'],
    [new CarNotRespondingError(), 'carNotResponding'],
    [new AdapterError('bluetooth-off'), 'bluetoothOff'],
    [new AdapterError('bluetooth-denied'), 'bluetoothDenied'],
    [new AdapterError('connect-failed'), 'adapterUnreachable'],
    [new Error('anything'), 'adapterUnreachable'],
  ])('maps %s to %s', (error, reason) => {
    expect(classifySessionError(error)).toBe(reason);
  });
});

describe('session helpers', () => {
  const events: RunnerEvent[] = [
    { type: 'started', itemId: 'a' },
    { type: 'elementSkipped', element: 'lowBeamLeft' },
    { type: 'tooFast', rttMs: 60, requiredMs: 120, availableMs: 50 },
    { type: 'clusterFeedbackFailed', error: new Error('nope') },
    {
      type: 'commandFailed',
      sgbd: 'FEM_20',
      element: 'indicatorLeftAll',
      error: new Error('timed out'),
    },
    { type: 'request', ecu: 0x40, payload: Uint8Array.of(0x10, 0x03) },
    { type: 'response', ecu: 0x40, payload: Uint8Array.of(0x50, 0x03) },
    { type: 'requestFailed', ecu: 0x40, error: new Error('timeout') },
    { type: 'restoring' },
    { type: 'restored', report: { restored: true, failures: [] } },
  ];

  it('describes every runner event', () => {
    expect(events.map(describeRunnerEvent)).toEqual([
      'run a',
      'skipped lowBeamLeft',
      'faster than adapter: needs 120 ms',
      'cluster feedback failed: nope',
      'command failed FEM_20 indicatorLeftAll: timed out',
      '-> 40 10 03',
      '<- 40 50 03',
      'request failed 40: timeout',
      'restoring',
      'restored=true',
    ]);
  });

  it('turns only user-relevant runner events into notices', () => {
    expect(events.map(noticeOf).filter(Boolean)).toHaveLength(3);
  });

  it('computes exponential backoff', () => {
    expect([0, 1, 2].map((attempt) => backoffMs(attempt))).toEqual([500, 1000, 2000]);
    expect(backoffMs(2, 10)).toBe(40);
  });

  it('tells effects from presets', () => {
    expect(isEffect(loadEffects()[0]!)).toBe(true);
    expect(isEffect({ id: 'p', name: 'n', color: 'c', icon: 'I', steps: [] })).toBe(false);
  });

  it('maps run results to tile status and toggle membership', () => {
    const oneShot = {
      kind: 'effect',
      effect: loadEffects().find((e) => e.kind === 'oneShot')!,
    } as const;
    const toggle = {
      kind: 'effect',
      effect: loadEffects().find((e) => e.kind === 'toggle')!,
    } as const;
    const done: ExecutionResult = { status: 'completed', skipped: [] };

    expect(tileForResult(oneShot, done)).toEqual({ state: 'justRan' });
    expect(tileForResult(toggle, done)).toBeUndefined();
    expect(tileForResult(oneShot, { status: 'aborted', skipped: [] })).toBeUndefined();
    expect(tileForResult(oneShot, { status: 'timeout', skipped: [] })).toEqual({
      state: 'error',
      reason: 'limitExceeded',
    });
    expect(
      tileForResult(oneShot, {
        status: 'failed',
        skipped: [],
        error: new TimeoutError('response'),
      }),
    ).toEqual({ state: 'error', reason: 'timeout' });

    expect(togglesAfter(['x'], toggle, done)).toEqual(['x', toggle.effect.id]);
    expect(togglesAfter(['x', toggle.effect.id], { ...toggle, on: false }, done)).toEqual(['x']);
    expect(togglesAfter(['x'], toggle, { status: 'failed', skipped: [] })).toEqual(['x']);
    expect(togglesAfter(['x'], oneShot, done)).toEqual(['x']);
  });
});

describe('plan input', () => {
  it('uses on steps with effect flags for a toggle switched on, none for off', () => {
    const toggle = loadEffects().find((effect) => effect.kind === 'toggle')!;

    expect(planInputOf({ kind: 'effect', effect: toggle })).toMatchObject({
      clusterFeedback: toggle.clusterFeedback,
    });
    expect(planInputOf({ kind: 'effect', effect: toggle, on: false })).toMatchObject({
      clusterFeedback: false,
      silenceCommunication: false,
    });
  });

  it('has nothing to run for a toggle without off steps switched off', async () => {
    const { car } = await detectOnSim(makeVehicle('F20'));
    const toggle = {
      ...loadEffects().find((effect) => effect.kind === 'toggle')!,
      offSteps: undefined,
    };

    expect(() =>
      buildPlan(planInputOf({ kind: 'effect', effect: toggle, on: false }), car),
    ).toThrow(NothingToRunError);
  });
});

describe('openNewLink', () => {
  const depsFor = (create: SessionDeps['createLink']): SessionDeps => ({
    createLink: create,
    appState: { subscribe: () => () => undefined },
  });
  const config = { adapter: 'demo', chassis: 'F20' } as const;

  it('closes and rethrows when the link fails to open', async () => {
    const link = new SimLink(makeVehicle('F20'));
    jest.spyOn(link, 'open').mockRejectedValue(new Error('open failed'));
    const close = jest.spyOn(link, 'close');

    await expect(
      openNewLink(
        depsFor(async () => link),
        config,
      ),
    ).rejects.toThrow('open failed');
    expect(close).toHaveBeenCalled();
  });

  it('closes the link when cancelled right after opening', async () => {
    const link = new SimLink(makeVehicle('F20'));
    const controller = new AbortController();
    jest.spyOn(link, 'open').mockImplementation(async () => controller.abort());

    await expect(
      openNewLink(
        depsFor(async () => link),
        config,
        controller.signal,
      ),
    ).rejects.toThrow('cancelled');
    expect(link.state).toBe('closed');
  });

  it('rethrows the abort reason when it is an Error', async () => {
    const link = new SimLink(makeVehicle('F20'));
    const controller = new AbortController();
    jest
      .spyOn(link, 'open')
      .mockImplementation(async () => controller.abort(new TimeoutError('open')));

    await expect(
      openNewLink(
        depsFor(async () => link),
        config,
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
