import { loadEffects, loadModule } from '@/data/generated';
import type { DetectedCar, Preset } from '@/domain';
import { assessRunnable, contextOf, resolveAction } from '@/domain/actions';
import { ActionUnavailableError } from '@/domain/errors';
import { deriveCapabilities } from '@/domain/registry/capabilities';
import { buildElementTargets, sourcesOf } from '@/domain/registry/targets';
import { buildPlan, planInputOf } from '@/domain/runner/plan';
import i18n from '@/i18n';
import { SEED_PRESETS } from '@/stores/presets';

import { effectItem, presetItem, presetName } from './items';

const carWith = (...names: Parameters<typeof loadModule>[0][]): DetectedCar => {
  const modules = names.map((sgbd) => ({
    sgbd,
    module: loadModule(sgbd),
    address: loadModule(sgbd).address,
    identity: loadModule(sgbd).identity[0]!.sgbdHex,
    chassis: 'F11',
  }));
  const elementTargets = buildElementTargets(modules);
  return deriveCapabilities({
    modules,
    chassisCandidates: [],
    elementTargets,
    elementSources: sourcesOf(elementTargets),
    selectableElements: [],
    effects: [],
  });
};
const t = i18n.getFixedT('en');

it('reports the same F11 headlight equipment gate for seeded, custom, effect, picker and execution paths', () => {
  const car = carWith('FRM3', 'KOMB01');
  const seed = SEED_PRESETS[0]!;
  const effect = loadEffects().find((candidate) => candidate.id === 'flash.highBeam')!;
  const custom: Preset = {
    ...seed,
    id: 'custom-headlights',
    steps: [{ type: 'set', elements: ['highBeamAll'], state: 'on' }],
  };
  for (const preset of [seed, custom]) {
    expect(presetItem(preset, t, car)).toMatchObject({
      availability: 'unsupported',
      unavailableReason: 'equipmentUnknown',
    });
    const runnable = { kind: 'preset' as const, preset };
    expect(assessRunnable(contextOf(car), runnable).status).toBe('needsConfirmation');
    expect(() => buildPlan(planInputOf(runnable), car)).toThrow(ActionUnavailableError);
  }
  expect(effectItem(effect, t, car)).toMatchObject({
    availability: 'unsupported',
    unavailableReason: 'equipmentUnknown',
  });
  expect(resolveAction(contextOf(car), 'bothHighBeams')).toMatchObject({
    status: 'unknown',
    reason: 'equipmentUnknown',
  });
  expect(car.effects.some((candidate) => candidate.id === effect.id)).toBe(false);
});

it('reassesses after equipment changes without pretending the selection verified a lamp', () => {
  const original = carWith('FRM3');
  const car = deriveCapabilities({
    ...original,
    actionContext: {
      facts: { headlightType: 'halogen', vehicleBinding: 'session:example', revision: 1 },
      revision: 1,
      validations: [],
    },
  });
  expect(presetItem(SEED_PRESETS[0]!, t, car)).toMatchObject({
    unavailableReason: 'confirmationRequired',
  });
  expect(presetItem(SEED_PRESETS[0]!, t, original)).toMatchObject({
    unavailableReason: 'equipmentUnknown',
  });
});

it('uses the REM physical brake composition consistently while disabling an otherwise supported mixed preset', () => {
  const car = carWith('FEM_20', 'REM_20');
  const preset: Preset = {
    ...SEED_PRESETS[0]!,
    steps: [{ type: 'action', actions: ['brakesAll'], state: 'on' }],
  };
  expect(presetItem(preset, t, car).availability).toBe('available');
  const input = { kind: 'preset' as const, preset };
  expect(
    buildPlan(planInputOf(input), car).steps[0]!.sends.map(({ module, element }) => [
      module.sgbd,
      element,
    ]),
  ).toEqual([
    ['REM_20', 'brakeLeft'],
    ['REM_20', 'brakeRight'],
    ['REM_20', 'brakeCenter'],
  ]);
  const mixed: Preset = {
    ...preset,
    steps: [...preset.steps, { type: 'action', actions: ['biXenonShutterBoth'], state: 'on' }],
  };
  expect(presetItem(mixed, t, car).availability).toBe('unsupported');
  expect(() => buildPlan(planInputOf({ kind: 'preset', preset: mixed }), car)).toThrow();
});

it('translates original seed display names without changing stored names or user edits', () => {
  const seed = SEED_PRESETS[0]!;
  expect(presetName(seed, i18n.getFixedT('pl'))).toBe('Podwójny błysk');
  expect(seed.name).toBe('Double flash');
  expect(presetName({ ...seed, name: 'My custom name' }, i18n.getFixedT('pl'))).toBe(
    'My custom name',
  );
});
