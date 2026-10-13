import { loadEffects, loadModule } from '@/data/generated';
import type { ElementId } from '@/data/types';
import { hasElementWarning } from '@/domain/registry/rules';
import { buildElementTargets, sourcesOf } from '@/domain/registry/targets';
import type { DetectedModule } from '@/domain/registry/types';
import { ControlLedger } from '@/domain/runner/ledger';
import { PresetRunner } from '@/domain/runner/runner';
import type { RunnableItem } from '@/domain/runner/types';
import { hex } from '@/protocol/bytes';
import { detectOnSim, litIds, makeVehicle, settle, wireLog } from '@/test-utils/domain-sim';

const rem = loadModule('REM_20');
const fem = loadModule('FEM_20');
const PER_SIDE_HEADLIGHTS: ElementId[] = [
  'lowBeamLeft',
  'lowBeamRight',
  'highBeamLeft',
  'highBeamRight',
  'daytimeLeft',
  'daytimeRight',
];
const PAIR_HEADLIGHTS: ElementId[] = ['lowBeamAll', 'highBeamAll', 'daytimeAll'];
const REM_BRAKES: ElementId[] = ['brakeLeft', 'brakeRight', 'brakeCenter'];

const bytes = (payload: readonly number[]) =>
  hex(Uint8Array.from(payload)).replaceAll(' ', '').toLowerCase();

const detected = (sgbd: string): DetectedModule => {
  const module = loadModule(sgbd as never);

  return { sgbd: sgbd as never, address: module.address, module, chassis: 'F32' };
};

const detect = (chassis: string, led: boolean) =>
  detectOnSim(makeVehicle(chassis, undefined, 1, led));

describe('brake substitution', () => {
  it('resolves brakeAll to the three REM_20 outputs when REM_20 is present', () => {
    const targets = buildElementTargets([detected('FEM_20'), detected('REM_20')]);

    expect(targets.get('brakeAll')!.map((target) => [target.module.sgbd, target.element])).toEqual(
      REM_BRAKES.map((element) => ['REM_20', element]),
    );
    expect(
      sourcesOf(targets)
        .get('brakeAll')!
        .map((module) => module.sgbd),
    ).toEqual(['REM_20']);
  });

  it('keeps the FEM function when REM_20 is absent', () => {
    const targets = buildElementTargets([detected('FEM_20'), detected('KOMB25')]);

    expect(targets.get('brakeAll')).toEqual([{ module: expect.anything(), element: 'brakeAll' }]);
    expect(targets.get('brakeAll')![0]!.module.sgbd).toBe('FEM_20');
  });

  it('keeps BDC brakeAll on cars without REM_20', () => {
    const targets = buildElementTargets([detected('BDC'), detected('KOMB01')]);

    expect(targets.get('brakeAll')![0]).toMatchObject({ element: 'brakeAll' });
  });

  it('leaves brakeAll alone when REM_20 cannot serve all three outputs', () => {
    const partial = detected('REM_20');
    const elements = { ...partial.module.elements, brakeCenter: undefined };
    const targets = buildElementTargets([
      detected('FEM_20'),
      { ...partial, module: { ...partial.module, elements } },
    ]);

    expect(targets.get('brakeAll')![0]!.module.sgbd).toBe('FEM_20');
  });

  describe('on the wire', () => {
    const start = async () => {
      jest.useRealTimers();
      const vehicle = makeVehicle('F32');
      const { link, car } = await detectOnSim(vehicle);
      const ledger = new ControlLedger();
      const runner = new PresetRunner({ link, car, ledger });
      vehicle.clearLog();
      jest.useFakeTimers();

      return { vehicle, car, runner, ledger };
    };

    afterEach(() => {
      jest.useRealTimers();
    });

    const brakePreset: RunnableItem = {
      kind: 'preset',
      preset: {
        id: 'brake',
        name: 'Brake',
        color: 'blue',
        icon: 'Car',
        steps: [
          { type: 'set', elements: ['brakeAll'], state: 'on', durationMs: 100 },
          { type: 'set', elements: ['brakeAll'], state: 'off' },
        ],
      } as never,
    };

    it('sends the REM outputs for brakeAll and undoes exactly them', async () => {
      const { vehicle, runner, ledger } = await start();

      const result = await settle(runner.run(brakePreset));

      const remAddress = rem.address.toString(16);
      const sent = (element: ElementId, state: 'on' | 'off') =>
        `${remAddress}:${bytes(rem.elements[element]![state])}`;
      const log = wireLog(vehicle);
      expect(log.slice(0, 1)).toEqual([`${remAddress}:1003`]);
      expect(log.slice(1, 4)).toEqual(REM_BRAKES.map((element) => sent(element, 'on')));
      expect(log.slice(4, 7)).toEqual(REM_BRAKES.map((element) => sent(element, 'off')));
      expect(log.slice(7, 10)).toEqual(REM_BRAKES.map((element) => sent(element, 'off')));
      expect(log.slice(10)).toEqual([
        ...rem.returnControl.map((payload) => `${remAddress}:${bytes(payload)}`),
        `${remAddress}:1001`,
      ]);
      expect(log.some((entry) => entry.startsWith(`${fem.address.toString(16)}:`))).toBe(false);
      expect(result.cleanup).toEqual({ restored: true, failures: [] });
      expect(ledger.hasPending).toBe(false);
      expect(litIds(vehicle)).toEqual([]);
    });

    it('lights the three brake lamps while on and records them in the ledger', async () => {
      const { vehicle, runner, ledger } = await start();

      const running = runner.run(brakePreset);
      await jest.advanceTimersByTimeAsync(50);

      expect(litIds(vehicle).sort()).toEqual(REM_BRAKES.map((e) => `REM_20:${e}`).sort());
      expect([...ledger.touched[0]!.elements].sort()).toEqual([...REM_BRAKES].sort());

      await settle(running);
    });

    it('runs flash.brake through the substituted outputs and restores', async () => {
      const { vehicle, car, runner } = await start();
      const effect = car.effects.find((candidate) => candidate.id === 'flash.brake')!;

      const result = await settle(runner.run({ kind: 'effect', effect }));

      const log = wireLog(vehicle);
      expect(log).toContain(`${rem.address.toString(16)}:${bytes(rem.elements.brakeCenter!.on)}`);
      expect(log.some((entry) => entry.includes(bytes(fem.elements.brakeAll!.on)))).toBe(false);
      expect(result.cleanup.restored).toBe(true);
      expect(litIds(vehicle)).toEqual([]);
    });

    it('does not send the same output twice when a step names brakeAll and brakeLeft', async () => {
      const { vehicle, runner } = await start();
      const item: RunnableItem = {
        kind: 'preset',
        preset: {
          ...(brakePreset as { preset: object }).preset,
          steps: [
            { type: 'set', elements: ['brakeAll', 'brakeLeft'], state: 'on', durationMs: 50 },
          ],
        } as never,
      };

      await settle(runner.run(item));

      const onLeft = `${rem.address.toString(16)}:${bytes(rem.elements.brakeLeft!.on)}`;
      expect(wireLog(vehicle).filter((entry) => entry === onLeft)).toHaveLength(1);
    });
  });
});

describe('LED headlight availability', () => {
  it('keeps and warns about FEM per-side headlight outputs when FLE02 is present', async () => {
    const { car } = await detect('F32', true);

    for (const element of PER_SIDE_HEADLIGHTS) {
      expect(car.elementSources.has(element)).toBe(true);
      expect(hasElementWarning(car.modules, element)).toBe(true);
      expect(car.elementTargets.has(element)).toBe(true);
      expect(car.selectableElements).toContain(element);
    }
  });

  it('keeps the pair functions and the other FEM outputs on an FLE car', async () => {
    const { car } = await detect('F32', true);

    for (const element of [...PAIR_HEADLIGHTS, 'frontFogLeft', 'corneringLeft', 'tailLeft']) {
      expect(car.elementSources.has(element as ElementId)).toBe(true);
    }
  });

  it('keeps the per-side outputs on a car without FLE02', async () => {
    const { car } = await detect('F32', false);

    for (const element of PER_SIDE_HEADLIGHTS) {
      expect(car.elementSources.get(element)!.map((module) => module.sgbd)).toEqual(['FEM_20']);
      expect(hasElementWarning(car.modules, element)).toBe(false);
    }
  });

  it('also reacts to a single FLE02 module and covers BDC', () => {
    const one = buildElementTargets([detected('FEM_20'), detected('FLE02_R')]);
    const bdc = buildElementTargets([detected('BDC'), detected('FLE02_L')]);

    expect(one.has('lowBeamLeft')).toBe(true);
    expect(hasElementWarning([detected('FEM_20'), detected('FLE02_R')], 'lowBeamLeft')).toBe(true);
    expect(bdc.has('highBeamRight')).toBe(true);
    expect(hasElementWarning([detected('BDC'), detected('FLE02_L')], 'highBeamRight')).toBe(true);
    expect(bdc.has('lowBeamAll')).toBe(true);
  });

  it('keeps FRM3 per-side outputs even if FLE02 were present', () => {
    const targets = buildElementTargets([detected('FRM3'), detected('FLE02_L')]);

    expect(targets.get('lowBeamLeft')![0]!.module.sgbd).toBe('FRM3');
  });

  it('keeps the per-side flash effects and party effects', async () => {
    const plain = (await detect('F32', false)).car;
    const led = (await detect('F32', true)).car;

    const ledIds = new Set(led.effects.map((effect) => effect.id));
    const gone = plain.effects.filter((effect) => !ledIds.has(effect.id)).map((e) => e.id);
    expect(gone).toEqual([]);
    expect(led.effects.map((effect) => effect.id)).toEqual(
      expect.arrayContaining(['flash.lowBeam', 'flash.highBeam', 'flash.daytime', 'flash.brake']),
    );
    const partyOnLedBefore = loadEffects().filter((effect) =>
      ['party_mode.bounce', 'party_mode.frontToBack'].includes(effect.id),
    );
    expect(partyOnLedBefore).toHaveLength(2);
    expect(ledIds.has('party_mode.bounce')).toBe(true);
    expect(ledIds.has('party_mode.frontToBack')).toBe(true);
  });

  it('sends warned per-side steps when included in a preset', async () => {
    jest.useRealTimers();
    const { link, car } = await detect('F32', true);
    const events: unknown[] = [];
    const observed = new PresetRunner({
      link,
      car,
      ledger: new ControlLedger(),
      onEvent: (event) => events.push(event),
    });
    jest.useFakeTimers();

    await settle(
      observed.run({
        kind: 'preset',
        preset: {
          id: 'p',
          name: 'P',
          color: 'blue',
          icon: 'Car',
          steps: [{ type: 'set', elements: ['lowBeamLeft', 'frontFogLeft'], state: 'on' }],
        } as never,
      }),
    );
    jest.useRealTimers();

    expect(events).not.toContainEqual({ type: 'elementSkipped', element: 'lowBeamLeft' });
  });
});
