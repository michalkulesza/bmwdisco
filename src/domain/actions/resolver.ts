import type { ElementId } from '@/data/elements';

import { hasElementWarning } from '../registry/rules';
import { moduleIdentityOf, validationApplies } from '../vehicle/facts';

import { LEGACY_ACTION_BRIDGES } from './legacy';
import { ACTION_MAPPINGS } from './mappings';

import type { ActionResolution, LogicalActionId, ResolutionContext } from './types';
import type { ElementTarget } from '../registry/types';

const allTargets = (ctx: ResolutionContext, element: ElementId): ElementTarget[] => [
  ...(ctx.car.elementTargets.get(element) ?? []),
];
const supported = (
  mappingId: string,
  targets: readonly ElementTarget[],
  evidence: 'existingCompatibility' | 'hardwareVerified' | 'simulation' = 'existingCompatibility',
  warnings: ('legacyLedMayNotLight' | 'compatibilityBehavior' | 'simulationOnly')[] = [],
): ActionResolution => ({ status: 'supported', mappingId, targets, evidence, warnings });
const unknown = (
  reason: 'equipmentUnknown' | 'equipmentConflict' | 'confirmationRequired',
  candidateMappingIds: string[],
): ActionResolution => ({ status: 'unknown', reason, candidateMappingIds });
const unsupported = (
  reason:
    'missingModule' | 'missingOutput' | 'noSemanticMapping' | 'commandRejected' = 'missingOutput',
): ActionResolution => ({ status: 'unsupported', reason });

const frm3Validation = (
  ctx: ResolutionContext,
  mappingId: string,
  targets: readonly ElementTarget[],
): boolean => {
  const module = targets[0]?.module;
  if (!module) return false;
  const fingerprint = moduleIdentityOf(module);
  if (targets.some((target) => moduleIdentityOf(target.module) !== fingerprint)) return false;
  const identityKnown = module.identity !== undefined;
  const binding = ctx.facts?.vehicleBinding ?? ctx.car.vin;
  return (
    Boolean(binding) &&
    (ctx.validations ?? []).some(
      (v) =>
        v.mappingId === mappingId &&
        v.mappingVersion === 1 &&
        validationApplies(v, binding, fingerprint, ctx.facts?.revision ?? 0) &&
        v.observedOutputs.length >= targets.length &&
        targets.every((target) => v.observedOutputs.includes(target.element)) &&
        (identityKnown || (ctx.demo && v.source === 'simulation')) &&
        (ctx.demo ? v.source === 'simulation' : v.source === 'physicalConfirmation'),
    )
  );
};

export const resolveAction = (
  ctx: ResolutionContext,
  action: LogicalActionId,
): ActionResolution => {
  const facts = ctx.facts;
  const frm = ctx.car.modules.filter((m) => m.sgbd === 'FRM3');
  if (action === 'biXenonShutterBoth') return unsupported('noSemanticMapping');
  if (frm.length) {
    if (action === 'indicatorsLeft' || action === 'indicatorsRight') {
      const mapId = `frm3-indicators-${action === 'indicatorsLeft' ? 'left' : 'right'}-candidate-v1`;
      const ids: ElementId[] =
        action === 'indicatorsLeft'
          ? ['frontLeftIndicator', 'rearLeftIndicator']
          : ['frontRightIndicator', 'rearRightIndicator'];
      const targets = ids.flatMap((id) =>
        allTargets(ctx, id).filter((t) => t.module.sgbd === 'FRM3'),
      );
      if (targets.length !== 2) return unsupported('missingOutput');
      if (!frm3Validation(ctx, mapId, targets)) return unknown('confirmationRequired', [mapId]);
      return supported(
        mapId,
        targets,
        ctx.demo ? 'simulation' : 'hardwareVerified',
        ctx.demo ? ['simulationOnly'] : [],
      );
    }
    if (
      [
        'highBeamLeft',
        'highBeamRight',
        'bothHighBeams',
        'lowBeamLeft',
        'lowBeamRight',
        'bothLowBeams',
        'corneringLeft',
        'corneringRight',
      ].includes(action)
    ) {
      if (facts?.conflict) return unknown('equipmentConflict', []);
      if (!facts || facts.headlightType === 'unknown')
        return unknown('equipmentUnknown', ['frm3-headlight-candidate-v1']);
      if (
        facts.headlightType === 'xenon' &&
        ['highBeamLeft', 'highBeamRight', 'bothHighBeams'].includes(action)
      )
        return unsupported('noSemanticMapping');
      if (
        facts.headlightType === 'led' &&
        [
          'highBeamLeft',
          'highBeamRight',
          'bothHighBeams',
          'corneringLeft',
          'corneringRight',
        ].includes(action)
      )
        return unsupported('noSemanticMapping');
      if (
        (action === 'corneringLeft' || action === 'corneringRight') &&
        facts.headlightType !== 'xenon'
      )
        return unsupported('noSemanticMapping');
      if (facts.headlightType === 'xenon' && !['corneringLeft', 'corneringRight'].includes(action))
        return unsupported('noSemanticMapping');
      if (['lowBeamLeft', 'lowBeamRight', 'bothLowBeams'].includes(action))
        return unsupported('noSemanticMapping');
      const ids: ElementId[] =
        action === 'bothHighBeams'
          ? ['highBeamLeft', 'highBeamRight']
          : action === 'highBeamLeft' || action === 'corneringLeft'
            ? ['highBeamLeft']
            : action === 'highBeamRight' || action === 'corneringRight'
              ? ['highBeamRight']
              : [];
      const targets = ids.flatMap((id) =>
        allTargets(ctx, id).filter((t) => t.module.sgbd === 'FRM3'),
      );
      const mappingId = `frm3-${facts.headlightType}-${action}-candidate-v1`;
      if (!targets.length || targets.length !== ids.length) return unsupported('missingOutput');
      if (!frm3Validation(ctx, mappingId, targets))
        return unknown('confirmationRequired', [mappingId]);
      return supported(
        mappingId,
        targets,
        ctx.demo ? 'simulation' : 'hardwareVerified',
        ctx.demo ? ['simulationOnly'] : [],
      );
    }
  }
  if (
    ['lowBeamLeft', 'lowBeamRight', 'highBeamLeft', 'highBeamRight'].includes(action) &&
    ctx.car.modules.some((m) => ['FLE02_L', 'FLE02_R'].includes(m.sgbd)) &&
    ctx.car.modules.some((m) => ['FEM_20', 'BDC'].includes(m.sgbd))
  )
    return unsupported('noSemanticMapping');
  const matches = ACTION_MAPPINGS.filter(
    (m) =>
      m.action === action &&
      m.evidence === 'existingCompatibility' &&
      ctx.car.modules.some((mod) => mod.sgbd === m.provider) &&
      (!(
        m.action === 'highBeamLeft' ||
        m.action === 'highBeamRight' ||
        m.action === 'lowBeamLeft' ||
        m.action === 'lowBeamRight'
      ) ||
        !ctx.car.modules.some((mod) => ['FLE02_L', 'FLE02_R'].includes(mod.sgbd))) &&
      !(
        action === 'brakesAll' &&
        ctx.car.modules.some((mod) => mod.sgbd === 'REM_20') &&
        m.id !== 'fem-rem-brakes-v1'
      ) &&
      m.candidates.every((id) =>
        allTargets(ctx, id as ElementId).some((target) => target.module.sgbd === m.provider),
      ),
  );
  if (!matches.length)
    return unsupported(ctx.car.modules.length ? 'missingOutput' : 'missingModule');
  if (matches.length > 1)
    return unknown(
      'confirmationRequired',
      matches.map((m) => m.id),
    );
  const mapping = matches[0]!;
  let targets = mapping.candidates.flatMap((id) =>
    allTargets(ctx, id as ElementId).filter((target) => target.module.sgbd === mapping.provider),
  );
  if (action === 'brakesAll' && ctx.car.modules.some((m) => m.sgbd === 'REM_20')) {
    targets = (['brakeLeft', 'brakeRight', 'brakeCenter'] as ElementId[]).flatMap((id) =>
      allTargets(ctx, id).filter((t) => t.module.sgbd === 'REM_20'),
    );
    if (targets.length !== 3) return unsupported('missingOutput');
  }
  return supported(mapping.id, targets, 'existingCompatibility', ['compatibilityBehavior']);
};

export const resolveLegacyElement = (
  ctx: ResolutionContext,
  element: ElementId,
): ActionResolution => {
  const action = LEGACY_ACTION_BRIDGES[element];
  if (element === 'highBeamLeft' || element === 'highBeamRight') {
    if (ctx.car.modules.some((m) => m.sgbd === 'FRM3')) {
      if (!ctx.facts || ctx.facts.headlightType === 'unknown')
        return unknown('equipmentUnknown', [`frm3-legacy-${element}`]);
      const resolution = resolveAction(ctx, element);
      if (resolution.status !== 'supported') return resolution;
      return { ...resolution, mappingId: `legacy:${element}` };
    }
  }
  if (action) {
    return resolveAction(ctx, action);
  }
  const targets = allTargets(ctx, element);
  if (!targets.length)
    return unsupported(ctx.car.modules.length ? 'missingOutput' : 'missingModule');
  const providers = new Set(
    targets.map((target) => `${target.module.sgbd}:${target.module.address}`),
  );
  if (providers.size > 1)
    return unknown(
      'confirmationRequired',
      targets.map((target) => `legacy:${target.module.sgbd}:${element}`),
    );
  const warned = hasElementWarning(ctx.car.modules, element);
  return supported(
    `legacy:${element}`,
    targets,
    'existingCompatibility',
    warned ? ['legacyLedMayNotLight'] : [],
  );
};
