import { hex } from '@/protocol/bytes';
import { NegativeResponseError } from '@/protocol/errors';
import { detectOnSim, makeVehicle, settle, wireLog } from '@/test-utils/domain-sim';

import { parsePreset } from '../preset/schema';
import { ControlLedger } from '../runner/ledger';
import { PresetRunner } from '../runner/runner';

import type { RunnableItem } from '../runner/types';

const bytes = (value: Uint8Array): string => hex(value).replaceAll(' ', '').toLowerCase();

const setup = async () => {
  jest.useRealTimers();
  const vehicle = makeVehicle('F10');
  const { link, car } = await detectOnSim(vehicle);
  const frm = car.modules.find((module) => module.sgbd === 'FRM3')!;
  car.actionContext = {
    facts: { headlightType: 'unknown', vehicleBinding: 'sim-fr-mapping', revision: 0 },
    validations: [
      {
        mappingId: 'frm3-indicators-left-candidate-v1',
        mappingVersion: 1,
        vehicleBinding: 'sim-fr-mapping',
        moduleIdentity: `FRM3:${frm.address}:${frm.identity}`,
        equipmentRevision: 0,
        observedOutputs: ['frontLeftIndicator', 'rearLeftIndicator'],
        releaseVerified: true,
        source: 'physicalConfirmation',
      },
    ],
    revision: 0,
  };
  vehicle.clearLog();
  const ledger = new ControlLedger();
  const runner = new PresetRunner({ link, car, ledger });
  jest.useFakeTimers();
  return { vehicle, link, car, frm, ledger, runner };
};

const semanticItem = (states: ('on' | 'off')[] = ['on', 'off']): RunnableItem => ({
  kind: 'preset',
  preset: parsePreset({
    id: 'frm-indicators',
    name: 'FRM indicators',
    color: 'blue',
    icon: 'Car',
    steps: states.map((state, index) => ({
      type: 'action',
      actions: ['indicatorsLeft'],
      state,
      ...(index === 0 ? { durationMs: 50 } : {}),
    })),
  }),
});

afterEach(() => jest.useRealTimers());

describe('logical action runner physical expansion', () => {
  it('sends validated FRM3 indicator targets front then rear and restores both before default session', async () => {
    const { vehicle, frm, runner } = await setup();
    const result = await settle(runner.run(semanticItem()));
    const front = frm.module.elements.frontLeftIndicator!;
    const rear = frm.module.elements.rearLeftIndicator!;
    expect(result.status).toBe('completed');
    expect(wireLog(vehicle)).toEqual([
      `${frm.address.toString(16)}:1003`,
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(front.on))}`,
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(rear.on))}`,
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(front.off))}`,
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(rear.off))}`,
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(front.off))}`,
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(rear.off))}`,
      `${frm.address.toString(16)}:1001`,
    ]);
    expect(result.cleanup.restored).toBe(true);
  });

  it('stops after a definitive NRC on the second output and cleans only the first touched output', async () => {
    const { vehicle, link, frm, ledger, runner } = await setup();
    const front = frm.module.elements.frontLeftIndicator!;
    const rear = frm.module.elements.rearLeftIndicator!;
    const original = link.request.bind(link);
    const attempts: string[] = [];
    jest.spyOn(link, 'request').mockImplementation((ecu, payload, options) => {
      attempts.push(bytes(payload));
      if (ecu === frm.address && bytes(payload) === bytes(Uint8Array.from(rear.on))) {
        return Promise.reject(new NegativeResponseError(payload[0]!, 0x22));
      }
      return original(ecu, payload, options);
    });
    const result = await settle(runner.run(semanticItem(['on'])));
    expect(result.status).toBe('failed');
    expect(result.cleanup.restored).toBe(true);
    expect(attempts).toEqual([
      '1003',
      bytes(Uint8Array.from(front.on)),
      bytes(Uint8Array.from(rear.on)),
      bytes(Uint8Array.from(front.off)),
      '1001',
    ]);
    expect(wireLog(vehicle)).not.toContain(
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(rear.off))}`,
    );
    expect(ledger.hasPending).toBe(false);
  });

  it('retains both previously touched targets and cleanup warning when a later OFF is rejected', async () => {
    const { link, frm, ledger, runner } = await setup();
    const rear = frm.module.elements.rearLeftIndicator!;
    const original = link.request.bind(link);
    jest.spyOn(link, 'request').mockImplementation((ecu, payload, options) => {
      if (ecu === frm.address && bytes(payload) === bytes(Uint8Array.from(rear.off))) {
        return Promise.reject(new NegativeResponseError(payload[0]!, 0x22));
      }
      return original(ecu, payload, options);
    });
    const result = await settle(runner.run(semanticItem()));
    expect(result.status).toBe('failed');
    expect(result.cleanup.restored).toBe(false);
    expect(result.cleanup.failures).toContainEqual(
      expect.objectContaining({ step: 'elementOff', element: 'rearLeftIndicator' }),
    );
    expect(ledger.touched.flatMap((entry) => [...entry.elements])).toEqual([
      'frontLeftIndicator',
      'rearLeftIndicator',
    ]);
  });

  it('keeps an uncertain second target armed after a simulator timeout and records the unavailable cleanup link', async () => {
    const { vehicle, link, frm, ledger, runner } = await setup();
    const front = frm.module.elements.frontLeftIndicator!;
    const rear = frm.module.elements.rearLeftIndicator!;
    const original = link.request.bind(link);
    jest.spyOn(link, 'request').mockImplementation((ecu, payload, options) => {
      if (ecu === frm.address && bytes(payload) === bytes(Uint8Array.from(front.on)))
        return original(ecu, payload, options).then((response) => {
          vehicle.faults.configure({ timeouts: { probability: 1 } });
          return response;
        });
      return original(ecu, payload, options);
    });
    const result = await settle(runner.run(semanticItem(['on'])));
    expect(result.status).toBe('failed');
    expect(result.cleanup.restored).toBe(false);
    expect(result.cleanup.failures).toContainEqual(expect.objectContaining({ step: 'link' }));
    expect(ledger.touched.flatMap((entry) => [...entry.elements])).toEqual([
      'frontLeftIndicator',
      'rearLeftIndicator',
    ]);
    expect(wireLog(vehicle)).not.toContain(
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(front.off))}`,
    );
    expect(wireLog(vehicle)).not.toContain(
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(rear.off))}`,
    );
  });

  it('honors Stop between serial targets and restores the target already sent', async () => {
    const { vehicle, link, frm, runner } = await setup();
    const front = frm.module.elements.frontLeftIndicator!;
    const rear = frm.module.elements.rearLeftIndicator!;
    const controller = new AbortController();
    const original = link.request.bind(link);
    jest.spyOn(link, 'request').mockImplementation((ecu, payload, options) =>
      original(ecu, payload, options).then((response) => {
        if (ecu === frm.address && bytes(payload) === bytes(Uint8Array.from(front.on)))
          controller.abort();
        return response;
      }),
    );
    const result = await settle(runner.run(semanticItem(['on']), controller.signal));
    expect(result.status).toBe('aborted');
    expect(wireLog(vehicle)).toContain(
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(front.off))}`,
    );
    expect(wireLog(vehicle)).not.toContain(
      `${frm.address.toString(16)}:${bytes(Uint8Array.from(rear.on))}`,
    );
    expect(wireLog(vehicle).at(-1)).toBe(`${frm.address.toString(16)}:1001`);
    expect(result.cleanup.restored).toBe(true);
  });
});
