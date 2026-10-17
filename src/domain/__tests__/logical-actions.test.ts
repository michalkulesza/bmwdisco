import { loadModule, loadEffects } from '@/data/generated';

import { assessSteps, assessRunnable, selectActionOptions } from '../actions/availability';
import {
  EFFECT_ACTION_OVERRIDES,
  effectActionManifestIssues,
  effectHasSemanticActions,
  effectIsFullySemantic,
  adaptEffectSteps,
} from '../actions/effect-actions';
import { resolveAction, resolveLegacyElement } from '../actions/resolver';
import { moduleIdentityOf, validationApplies } from '../vehicle/facts';

import type { ResolutionContext } from '../actions/types';
import type { DetectedCar, DetectedModule } from '../registry/types';
import '../actions';
import '../vehicle';

const makeCar = (...sgbds: Parameters<typeof loadModule>[0][]): DetectedCar => {
  const modules = sgbds.map((sgbd, i) => ({
    sgbd,
    identity: loadModule(sgbd).identity[0]?.sgbdHex,
    address: 0x10 + i,
    module: loadModule(sgbd),
    chassis: 'F32',
  })) as DetectedModule[];
  const elementTargets = new Map();
  for (const module of modules)
    for (const element of Object.keys(module.module.elements)) {
      elementTargets.set(element, [...(elementTargets.get(element) ?? []), { module, element }]);
    }
  return {
    chassis: 'F32',
    chassisCandidates: ['F32'],
    modules,
    elementTargets,
    elementSources: new Map(),
    selectableElements: [],
    effects: [],
  };
};
const ctx = (car: DetectedCar, extra: Partial<ResolutionContext> = {}): ResolutionContext => ({
  car,
  ...extra,
});

describe('logical action resolution', () => {
  test('FRM3 indicator candidates require explicit validation and both outputs', () => {
    const car = makeCar('FRM3');
    expect(resolveAction(ctx(car), 'indicatorsLeft')).toMatchObject({
      status: 'unknown',
      reason: 'confirmationRequired',
    });
    const validation = {
      mappingId: 'frm3-indicators-left-candidate-v1',
      mappingVersion: 1,
      moduleIdentity: 'FRM3:16:0F10D0',
      equipmentRevision: 0,
      observedOutputs: ['frontLeftIndicator', 'rearLeftIndicator'],
      releaseVerified: true,
      source: 'physicalConfirmation' as const,
    };
    expect(
      resolveAction(
        ctx(car, {
          facts: { headlightType: 'unknown', vehicleBinding: 'VIN' },
          validations: [{ ...validation, vehicleBinding: 'VIN' }],
        }),
        'indicatorsLeft',
      ),
    ).toMatchObject({
      status: 'supported',
      targets: [{ element: 'frontLeftIndicator' }, { element: 'rearLeftIndicator' }],
    });
  });

  test('FRM3 does not infer high beams from equipment or a xenon shutter', () => {
    const car = makeCar('FRM3');
    expect(resolveAction(ctx(car), 'bothHighBeams')).toMatchObject({
      status: 'unknown',
      reason: 'equipmentUnknown',
    });
    expect(
      resolveAction(ctx(car, { facts: { headlightType: 'xenon' } }), 'highBeamLeft'),
    ).toMatchObject({ status: 'unsupported', reason: 'noSemanticMapping' });
    expect(resolveAction(ctx(car), 'biXenonShutterBoth')).toMatchObject({
      status: 'unsupported',
      reason: 'noSemanticMapping',
    });
  });

  test('FEM+REM brake semantic maps through the existing REM substitution', () => {
    const result = resolveAction(ctx(makeCar('FEM_20', 'REM_20')), 'brakesAll');
    expect(result).toMatchObject({
      status: 'supported',
      mappingId: 'fem-rem-brakes-v1',
      targets: [{ element: 'brakeLeft' }, { element: 'brakeRight' }, { element: 'brakeCenter' }],
    });
  });

  test('legacy precise per-side FRM3 high-beam names remain confirmation gated', () => {
    expect(resolveLegacyElement(ctx(makeCar('FRM3')), 'highBeamLeft')).toMatchObject({
      status: 'unknown',
      reason: 'equipmentUnknown',
    });
  });

  test.each([
    ['wrong mapping version', { mappingVersion: 2 }],
    ['wrong output evidence', { observedOutputs: ['frontLeftIndicator', 'rearRightIndicator'] }],
    ['wrong binding', { vehicleBinding: 'another-car' }],
    ['wrong ECU identity', { moduleIdentity: 'FRM3:17:0F10D0' }],
    ['wrong equipment revision', { equipmentRevision: 1 }],
  ])('FRM3 mapping confirmation rejects %s', (_label, change) => {
    const car = makeCar('FRM3');
    const validation = {
      mappingId: 'frm3-indicators-left-candidate-v1',
      mappingVersion: 1,
      vehicleBinding: 'VIN',
      moduleIdentity: 'FRM3:16:0F10D0',
      equipmentRevision: 0,
      observedOutputs: ['frontLeftIndicator', 'rearLeftIndicator'],
      releaseVerified: true,
      source: 'physicalConfirmation' as const,
      ...change,
    };
    expect(
      resolveAction(
        ctx(car, {
          facts: { headlightType: 'unknown', vehicleBinding: 'VIN', revision: 0 },
          validations: [validation],
        }),
        'indicatorsLeft',
      ),
    ).toMatchObject({ status: 'unknown', reason: 'confirmationRequired' });
  });

  test('FRM3 demo validation must be explicitly marked as simulation', () => {
    const car = makeCar('FRM3');
    const validation = {
      mappingId: 'frm3-indicators-left-candidate-v1',
      mappingVersion: 1,
      vehicleBinding: 'demo-1',
      moduleIdentity: 'FRM3:16:0F10D0',
      equipmentRevision: 0,
      observedOutputs: ['frontLeftIndicator', 'rearLeftIndicator'],
      releaseVerified: true,
      source: 'physicalConfirmation' as const,
    };
    expect(
      resolveAction(
        ctx(car, {
          demo: true,
          facts: { headlightType: 'unknown', vehicleBinding: 'demo-1' },
          validations: [validation],
        }),
        'indicatorsLeft',
      ),
    ).toMatchObject({ status: 'unknown' });
    const demoModule = { ...car.modules[0]!, identity: undefined };
    const demoCar = {
      ...car,
      modules: [demoModule],
      elementTargets: new Map(
        [...car.elementTargets].map(([id, targets]) => [
          id,
          targets.map((target) => ({ ...target, module: demoModule })),
        ]),
      ),
    };
    const simulatedValidation = {
      ...validation,
      moduleIdentity: 'FRM3:16:unknown',
      source: 'simulation' as const,
    };
    expect(
      resolveAction(
        ctx(demoCar, {
          demo: true,
          facts: { headlightType: 'unknown', vehicleBinding: 'demo-1' },
          validations: [simulatedValidation],
        }),
        'indicatorsLeft',
      ),
    ).toMatchObject({ status: 'supported', evidence: 'simulation' });
    expect(
      resolveAction(
        ctx(car, {
          facts: { headlightType: 'unknown', vehicleBinding: 'demo-1' },
          validations: [{ ...validation, source: 'simulation' }],
        }),
        'indicatorsLeft',
      ),
    ).toMatchObject({ status: 'unknown' });
  });

  test('FRM3 headlight candidates need equipment and a complete mapping confirmation', () => {
    const car = makeCar('FRM3');
    expect(
      resolveAction(ctx(car, { facts: { headlightType: 'halogen' } }), 'highBeamLeft'),
    ).toMatchObject({ status: 'unknown', reason: 'confirmationRequired' });
    const validation = {
      mappingId: 'frm3-halogen-highBeamLeft-candidate-v1',
      mappingVersion: 1,
      vehicleBinding: 'VIN',
      moduleIdentity: 'FRM3:16:0F10D0',
      equipmentRevision: 0,
      observedOutputs: ['highBeamLeft'],
      releaseVerified: true,
      source: 'physicalConfirmation' as const,
    };
    const result = resolveAction(
      ctx(car, {
        facts: { headlightType: 'halogen', vehicleBinding: 'VIN' },
        validations: [validation],
      }),
      'highBeamLeft',
    );
    expect(result).toMatchObject({
      status: 'supported',
      targets: [{ element: 'highBeamLeft' }],
      evidence: 'hardwareVerified',
    });
  });

  test('FRM3 halogen pair requires both validated FL outputs; xenon cornering stays distinct', () => {
    const car = makeCar('FRM3');
    const halogenFacts = { headlightType: 'halogen' as const, vehicleBinding: 'VIN' };
    const pairValidation = {
      mappingId: 'frm3-halogen-bothHighBeams-candidate-v1',
      mappingVersion: 1,
      vehicleBinding: 'VIN',
      moduleIdentity: 'FRM3:16:0F10D0',
      equipmentRevision: 0,
      observedOutputs: ['highBeamLeft', 'highBeamRight'],
      releaseVerified: true,
      source: 'physicalConfirmation' as const,
    };
    expect(
      resolveAction(
        ctx(car, { facts: halogenFacts, validations: [pairValidation] }),
        'bothHighBeams',
      ),
    ).toMatchObject({
      status: 'supported',
      targets: [{ element: 'highBeamLeft' }, { element: 'highBeamRight' }],
    });
    const xenonFacts = { headlightType: 'xenon' as const, vehicleBinding: 'VIN' };
    const cornerValidation = {
      ...pairValidation,
      mappingId: 'frm3-xenon-corneringLeft-candidate-v1',
      observedOutputs: ['highBeamLeft'],
    };
    expect(
      resolveAction(
        ctx(car, { facts: xenonFacts, validations: [cornerValidation] }),
        'corneringLeft',
      ),
    ).toMatchObject({ status: 'supported', targets: [{ element: 'highBeamLeft' }] });
    expect(
      resolveAction(
        ctx(car, {
          facts: { headlightType: 'led', vehicleBinding: 'VIN' },
          validations: [pairValidation],
        }),
        'highBeamLeft',
      ),
    ).toMatchObject({ status: 'unsupported', reason: 'noSemanticMapping' });
  });

  test('legacy FRM3 halogen high-beam calls use only the matching validated route', () => {
    const car = makeCar('FRM3');
    const facts = { headlightType: 'halogen' as const, vehicleBinding: 'VIN' };
    const validation = {
      mappingId: 'frm3-halogen-highBeamLeft-candidate-v1',
      mappingVersion: 1,
      vehicleBinding: 'VIN',
      moduleIdentity: 'FRM3:16:0F10D0',
      equipmentRevision: 0,
      observedOutputs: ['highBeamLeft'],
      releaseVerified: true,
      source: 'physicalConfirmation' as const,
    };
    expect(
      resolveLegacyElement(ctx(car, { facts, validations: [validation] }), 'highBeamLeft'),
    ).toMatchObject({ status: 'supported', mappingId: 'legacy:highBeamLeft' });
    expect(
      resolveLegacyElement(
        ctx(car, {
          facts: { headlightType: 'xenon', vehicleBinding: 'VIN' },
          validations: [validation],
        }),
        'highBeamLeft',
      ),
    ).toMatchObject({ status: 'unsupported', reason: 'noSemanticMapping' });
  });

  test('equipment conflicts block equipment-dependent routes without blocking module-only compatibility', () => {
    const car = makeCar('FRM3');
    const context = ctx(car, { facts: { headlightType: 'halogen', conflict: true } });
    expect(resolveAction(context, 'bothHighBeams')).toMatchObject({
      status: 'unknown',
      reason: 'equipmentConflict',
    });
    expect(resolveAction(context, 'indicatorsLeft')).toMatchObject({
      status: 'unknown',
      reason: 'confirmationRequired',
    });
    const fem = ctx(makeCar('FEM_20'), { facts: { headlightType: 'halogen', conflict: true } });
    expect(resolveAction(fem, 'bothHighBeams')).toMatchObject({ status: 'supported' });
    expect(resolveAction(fem, 'indicatorsLeft')).toMatchObject({ status: 'supported' });
  });

  test('does not apply one ECU confirmation to a composition split across two FRM3 addresses', () => {
    const car = makeCar('FRM3', 'FRM3');
    const first = car.modules[0]!;
    const second = car.modules[1]!;
    const targets = new Map(car.elementTargets);
    targets.set('frontLeftIndicator', [{ module: first, element: 'frontLeftIndicator' }]);
    targets.set('rearLeftIndicator', [{ module: second, element: 'rearLeftIndicator' }]);
    const result = resolveAction(
      ctx(
        { ...car, elementTargets: targets },
        {
          facts: { headlightType: 'unknown', vehicleBinding: 'VIN', revision: 0 },
          validations: [
            {
              mappingId: 'frm3-indicators-left-candidate-v1',
              mappingVersion: 1,
              vehicleBinding: 'VIN',
              moduleIdentity: moduleIdentityOf(first),
              equipmentRevision: 0,
              observedOutputs: ['frontLeftIndicator', 'rearLeftIndicator'],
              releaseVerified: true,
              source: 'physicalConfirmation',
            },
          ],
        },
      ),
      'indicatorsLeft',
    );
    expect(result).toMatchObject({ status: 'unknown', reason: 'confirmationRequired' });
  });

  test('semantic FEM headlight routes avoid the known FLE dead output while legacy keeps a warning', () => {
    const context = ctx(makeCar('FEM_20', 'FLE02_L'));
    expect(resolveAction(context, 'highBeamLeft')).toMatchObject({
      status: 'unsupported',
      reason: 'noSemanticMapping',
    });
    expect(resolveAction(context, 'bothHighBeams')).toMatchObject({
      status: 'supported',
      mappingId: 'fem-high-beams-v1',
    });
    expect(resolveLegacyElement(context, 'highBeamLeft')).toMatchObject({
      status: 'supported',
      warnings: ['legacyLedMayNotLight'],
    });
  });

  test('BDC uses its explicit aggregate rule and simultaneous FEM/BDC remains ambiguous', () => {
    expect(resolveAction(ctx(makeCar('BDC')), 'indicatorsLeft')).toMatchObject({
      status: 'supported',
      mappingId: 'bdc-indicators-left-v1',
    });
    expect(resolveAction(ctx(makeCar('FEM_20', 'BDC')), 'indicatorsLeft')).toMatchObject({
      status: 'unknown',
      reason: 'confirmationRequired',
    });
  });

  test('single-provider FEM and BDC side outputs use only their declared target', () => {
    expect(resolveAction(ctx(makeCar('FEM_20')), 'highBeamLeft')).toMatchObject({
      status: 'supported',
      mappingId: 'fem-highBeamLeft-v1',
      targets: [{ element: 'highBeamLeft' }],
    });
    expect(resolveAction(ctx(makeCar('BDC')), 'lowBeamRight')).toMatchObject({
      status: 'supported',
      mappingId: 'bdc-lowBeamRight-v1',
      targets: [{ element: 'lowBeamRight' }],
    });
    expect(resolveAction(ctx(makeCar('FEM_20')), 'corneringLeft')).toMatchObject({
      status: 'supported',
      mappingId: 'fem-corneringLeft-v1',
    });
  });

  test('missing composition output and multiply provided legacy elements fail closed', () => {
    const missing = makeCar('FRM3');
    const targets = new Map(missing.elementTargets);
    targets.delete('rearLeftIndicator');
    expect(
      resolveAction(ctx({ ...missing, elementTargets: targets }), 'indicatorsLeft'),
    ).toMatchObject({ status: 'unsupported', reason: 'missingOutput' });
    expect(resolveLegacyElement(ctx(makeCar('FEM_20', 'BDC')), 'lowBeamAll')).toMatchObject({
      status: 'unknown',
      reason: 'confirmationRequired',
    });
  });

  test('effect adapter manifest is explicit and its references are current', () => {
    expect(EFFECT_ACTION_OVERRIDES['flash.lowBeam']).toEqual({ lowBeamAll: 'bothLowBeams' });
    expect(effectActionManifestIssues(loadEffects())).toEqual([]);
    expect(
      effectIsFullySemantic(loadEffects().find((effect) => effect.id === 'flash.lowBeam')!),
    ).toBe(true);
    expect(
      effectIsFullySemantic(loadEffects().find((effect) => effect.id === 'ghost.daytimeOFF')!),
    ).toBe(false);
    const lowBeamEffect = loadEffects().find((effect) => effect.id === 'flash.lowBeam')!;
    expect(effectHasSemanticActions(lowBeamEffect)).toBe(true);
    expect(adaptEffectSteps(lowBeamEffect)).toEqual([
      { type: 'action', actions: ['bothLowBeams'], state: 'on', durationMs: 100 },
      { type: 'action', actions: ['bothLowBeams'], state: 'off' },
    ]);
    expect(
      effectActionManifestIssues([]).every((issue) => issue.startsWith('unknown effect:')),
    ).toBe(true);
    expect(
      effectActionManifestIssues([
        { ...lowBeamEffect, steps: [{ element: 'reverseLeft', on: false }] },
      ]),
    ).toContain('stale source: flash.lowBeam/lowBeamAll');
    expect(adaptEffectSteps({ ...lowBeamEffect, id: 'unlisted.effect' })).toEqual([
      { type: 'set', elements: ['lowBeamAll'], state: 'on', durationMs: 100 },
      { type: 'set', elements: ['lowBeamAll'], state: 'off' },
    ]);
  });

  test('assessRunnable enforces legacy module gates and semantic step resolution', () => {
    const legacyEffect = loadEffects().find((effect) => effect.id === 'flash.fogFrontLeft')!;
    expect(
      assessRunnable(ctx(makeCar('REM_20')), { kind: 'effect', effect: legacyEffect }).status,
    ).toBe('unsupported');
    const semanticEffect = loadEffects().find((effect) => effect.id === 'flash.highBeam')!;
    expect(
      assessRunnable(ctx(makeCar('FEM_20')), { kind: 'effect', effect: semanticEffect }).status,
    ).toBe('runnable');
    expect(
      assessRunnable(ctx(makeCar('FEM_20', 'BDC')), { kind: 'effect', effect: semanticEffect })
        .status,
    ).toBe('needsConfirmation');
    const toggle = loadEffects().find((effect) => effect.id === 'toggle.hazard')!;
    expect(
      assessRunnable(ctx(makeCar('FEM_20')), { kind: 'effect', effect: toggle, on: false }).status,
    ).toBe('runnable');
  });

  test('assessment supports only explicit partial effects and wait-only items are not runnable', () => {
    expect(assessSteps(ctx(makeCar('FEM_20')), [{ type: 'wait', ms: 100 }]).status).toBe(
      'unsupported',
    );
    const presetSteps = [
      { type: 'action' as const, actions: ['biXenonShutterBoth' as const], state: 'on' as const },
    ];
    expect(assessSteps(ctx(makeCar('FEM_20')), presetSteps).status).toBe('unsupported');
    const ghost = loadEffects().find((effect) => effect.id === 'ghost.fullOFF')!;
    expect(assessRunnable(ctx(makeCar('FEM_20')), { kind: 'effect', effect: ghost }).status).toBe(
      'partial',
    );
  });

  test('vehicle confirmation matching binds the stable ECU identity and revisions', () => {
    const module = makeCar('FRM3').modules[0]!;
    expect(moduleIdentityOf(module)).toBe('FRM3:16:0F10D0');
    const validation = {
      mappingId: 'x',
      mappingVersion: 1,
      vehicleBinding: 'VIN',
      moduleIdentity: moduleIdentityOf(module),
      equipmentRevision: 2,
      observedOutputs: [],
      releaseVerified: true,
    };
    expect(validationApplies(validation, 'VIN', moduleIdentityOf(module), 2)).toBe(true);
    expect(
      validationApplies(
        { ...validation, releaseVerified: false },
        'VIN',
        moduleIdentityOf(module),
        2,
      ),
    ).toBe(false);
    expect(validationApplies(validation, 'VIN', 'FRM3:16:other', 2)).toBe(false);
    expect(validationApplies(validation, 'VIN', moduleIdentityOf(module), 3)).toBe(false);
  });

  test('selectActionOptions returns one assessment for every catalog choice', () => {
    expect(selectActionOptions(ctx(makeCar('FRM3')))).toHaveLength(12);
  });

  test('assessment blocks mixed unsupported steps without dropping their intent', () => {
    const result = assessSteps(ctx(makeCar('FRM3')), [
      { type: 'set', elements: ['frontLeftIndicator', 'highBeamAll'], state: 'on' },
    ]);
    expect(result.status).toBe('needsConfirmation');
    expect(result.steps).toHaveLength(0);
    expect(result.missing).toHaveLength(1);
  });

  test('distinguishes absent modules from missing provider outputs', () => {
    const empty = makeCar();
    expect(resolveAction(ctx(empty), 'indicatorsLeft')).toMatchObject({
      status: 'unsupported',
      reason: 'missingModule',
    });
    const fem = makeCar('FEM_20');
    const withoutRight = new Map(fem.elementTargets);
    withoutRight.delete('highBeamAll');
    expect(
      resolveAction(ctx({ ...fem, elementTargets: withoutRight }), 'bothHighBeams'),
    ).toMatchObject({ status: 'unsupported', reason: 'missingOutput' });
    expect(resolveLegacyElement(ctx(empty), 'reverseLeft')).toMatchObject({
      status: 'unsupported',
      reason: 'missingModule',
    });
  });

  test('FRM3 headlight action table fails closed for all equipment-specific unsupported routes', () => {
    const car = makeCar('FRM3');
    const cases = [
      ['led', 'highBeamRight'],
      ['led', 'corneringLeft'],
      ['xenon', 'bothHighBeams'],
      ['xenon', 'lowBeamLeft'],
      ['halogen', 'bothLowBeams'],
      ['halogen', 'corneringRight'],
    ] as const;
    for (const [headlightType, action] of cases) {
      expect(
        resolveAction(ctx(car, { facts: { headlightType, vehicleBinding: 'VIN' } }), action),
      ).toMatchObject({ status: 'unsupported', reason: 'noSemanticMapping' });
    }
    expect(
      resolveAction(
        ctx(car, { facts: { headlightType: 'unknown', conflict: true } }),
        'bothHighBeams',
      ),
    ).toMatchObject({ status: 'unknown', reason: 'equipmentConflict' });
  });

  test('FRM3 validation requires vehicle binding and cannot undercount duplicate evidence', () => {
    const car = makeCar('FRM3');
    const base = {
      mappingId: 'frm3-indicators-left-candidate-v1',
      mappingVersion: 1,
      moduleIdentity: 'FRM3:16:0F10D0',
      equipmentRevision: 0,
      observedOutputs: ['frontLeftIndicator', 'rearLeftIndicator'],
      releaseVerified: true,
      source: 'physicalConfirmation' as const,
    };
    expect(
      resolveAction(ctx(car, { validations: [{ ...base, vehicleBinding: '' }] }), 'indicatorsLeft'),
    ).toMatchObject({ status: 'unknown', reason: 'confirmationRequired' });
    expect(
      resolveAction(
        ctx(car, {
          facts: { headlightType: 'unknown', vehicleBinding: 'VIN' },
          validations: [
            {
              ...base,
              vehicleBinding: 'VIN',
              observedOutputs: ['frontLeftIndicator', 'frontLeftIndicator', 'frontLeftIndicator'],
            },
          ],
        }),
        'indicatorsLeft',
      ),
    ).toMatchObject({ status: 'unknown', reason: 'confirmationRequired' });
  });

  test('semantic legacy bridges retain aggregate FEM compatibility and REM brake fallback rules', () => {
    expect(resolveLegacyElement(ctx(makeCar('FEM_20')), 'highBeamAll')).toMatchObject({
      status: 'supported',
      mappingId: 'fem-high-beams-v1',
    });
    expect(resolveAction(ctx(makeCar('FEM_20')), 'brakesAll')).toMatchObject({
      status: 'supported',
      mappingId: 'fem-brakes-aggregate-v1',
    });
    const rem = makeCar('FEM_20', 'REM_20');
    const partialRem = new Map(rem.elementTargets);
    partialRem.delete('brakeCenter');
    expect(resolveAction(ctx({ ...rem, elementTargets: partialRem }), 'brakesAll')).toMatchObject({
      status: 'unsupported',
      reason: 'missingOutput',
    });
  });

  test('legacy raw outputs reject multiple providers but preserve unambiguous unflagged support', () => {
    const fem = makeCar('FEM_20');
    expect(resolveLegacyElement(ctx(fem), 'positionLeft')).toMatchObject({
      status: 'supported',
      warnings: [],
    });
    expect(resolveLegacyElement(ctx(makeCar('FEM_20', 'BDC')), 'positionLeft')).toMatchObject({
      status: 'unknown',
      reason: 'confirmationRequired',
    });
  });
});
