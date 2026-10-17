import type { ElementId } from '@/data/elements';

import { TOGGLE_PRESET_HOLD_MS, EFFECT_TICK_MS } from '../preset/limits';

import { LOGICAL_ACTION_IDS } from './catalog';
import { adaptEffectSteps, effectIsFullySemantic } from './effect-actions';
import { resolveAction, resolveLegacyElement } from './resolver';

import type {
  ActionResolution,
  LogicalActionId,
  ResolutionContext,
  RunnableAssessment,
  ResolvedExecutionStep,
} from './types';
import type { RunnableItem } from '../runner/types';

type Steps = readonly (
  | {
      type: 'action';
      actions: readonly LogicalActionId[];
      state: 'on' | 'off';
      durationMs?: number;
    }
  | { type: 'set'; elements: readonly ElementId[]; state: 'on' | 'off'; durationMs?: number }
  | { type: 'wait'; ms: number }
)[];

const flatten = (
  ctx: ResolutionContext,
  steps: Steps,
  allowPartial = false,
): RunnableAssessment => {
  const resolved: ResolvedExecutionStep[] = [];
  const resolutions: ActionResolution[] = [];
  const missing: (ActionResolution & { intent: LogicalActionId | ElementId })[] = [];
  const warnings = new Set<'legacyLedMayNotLight' | 'compatibilityBehavior' | 'simulationOnly'>();
  let atMs = 0;
  for (const step of steps) {
    if (step.type === 'wait') {
      atMs += step.ms;
      continue;
    }
    const intents: (LogicalActionId | ElementId)[] =
      step.type === 'action' ? [...step.actions] : [...step.elements];
    const stepTargets = [] as ResolvedExecutionStep['targets'][number][];
    let failed = false;
    for (const intent of intents) {
      const result =
        step.type === 'action'
          ? resolveAction(ctx, intent as LogicalActionId)
          : resolveLegacyElement(ctx, intent as ElementId);
      resolutions.push(result);
      if (result.status === 'supported') {
        stepTargets.push(...result.targets);
        result.warnings.forEach((w) => warnings.add(w));
      } else {
        missing.push({ ...result, intent });
        failed = true;
      }
    }
    if (!failed || allowPartial) {
      const unique = new Map<string, (typeof stepTargets)[number]>();
      stepTargets.forEach((target) =>
        unique.set(`${target.module.address}:${target.module.sgbd}:${target.element}`, target),
      );
      if (unique.size) resolved.push({ atMs, state: step.state, targets: [...unique.values()] });
    }
    atMs += step.durationMs ?? 0;
  }
  const status =
    missing.length === 0
      ? resolved.length
        ? 'runnable'
        : 'unsupported'
      : allowPartial && resolved.length
        ? 'partial'
        : missing.some((m) => m.status === 'unknown')
          ? 'needsConfirmation'
          : 'unsupported';
  return {
    status,
    revision: ctx.revision ?? ctx.facts?.revision ?? 0,
    steps: resolved,
    endMs: atMs,
    resolutions,
    missing,
    warnings: [...warnings],
  };
};

export const assessSteps = (
  ctx: ResolutionContext,
  steps: Steps,
  options: { allowPartial?: boolean } = {},
): RunnableAssessment => flatten(ctx, steps, options.allowPartial);

export const assessRunnable = (ctx: ResolutionContext, item: RunnableItem): RunnableAssessment => {
  if (item.kind === 'effect') {
    const effect = item.effect;
    const fullySemantic = effectIsFullySemantic(effect);
    const onSteps = adaptEffectSteps(effect, effect.steps, EFFECT_TICK_MS);
    const offSteps = effect.offSteps
      ? adaptEffectSteps(effect, effect.offSteps, EFFECT_TICK_MS)
      : [];
    const adapted =
      effect.kind === 'toggle'
        ? item.on === false
          ? offSteps
          : effect.offSteps
            ? [...onSteps, { type: 'wait' as const, ms: TOGGLE_PRESET_HOLD_MS }, ...offSteps]
            : onSteps
        : onSteps;
    const assessment = flatten(ctx, adapted, effect.id === 'ghost.fullOFF');
    if (
      !fullySemantic &&
      effect.requiredModules?.length &&
      !effect.requiredModules.some((sgbd) => ctx.car.modules.some((m) => m.sgbd === sgbd))
    ) {
      return {
        ...assessment,
        status: 'unsupported',
        missing: [
          ...assessment.missing,
          { status: 'unsupported', reason: 'missingModule', intent: 'allOutputs' },
        ],
      };
    }
    return assessment;
  }
  return flatten(ctx, item.preset.steps);
};

export const contextOf = (car: ResolutionContext['car']): ResolutionContext => {
  return { car, ...car.actionContext };
};

export const selectActionOptions = (
  ctx: ResolutionContext,
): { id: LogicalActionId; resolution: ActionResolution }[] =>
  LOGICAL_ACTION_IDS.map((id) => ({
    id,
    resolution: resolveAction(ctx, id),
  }));
