import type { Effect, EffectStep } from '@/data/types';

import { EFFECT_TICK_MS } from '../preset/limits';

import type { LogicalActionId } from './types';

// Only individually audited effect/source pairs receive semantic routing.
export const EFFECT_ACTION_OVERRIDES: Readonly<
  Record<string, Readonly<Partial<Record<EffectStep['element'], LogicalActionId>>>>
> = {
  'flash.lowBeam': { lowBeamAll: 'bothLowBeams' },
  'flash.highBeam': { highBeamAll: 'bothHighBeams' },
  'flash.indicatorLeft': { indicatorLeftAll: 'indicatorsLeft' },
  'flash.indicatorRight': { indicatorRightAll: 'indicatorsRight' },
  'flash.brake': { brakeAll: 'brakesAll' },
};

export const adaptEffectSteps = (
  effect: Effect,
  source: readonly EffectStep[] = effect.steps,
  tickMs = EFFECT_TICK_MS,
): (
  | { type: 'action'; actions: LogicalActionId[]; state: 'on' | 'off'; durationMs?: number }
  | { type: 'set'; elements: EffectStep['element'][]; state: 'on' | 'off'; durationMs?: number }
)[] =>
  source.map((step, index) => {
    const durationMs = index < source.length - 1 ? tickMs : undefined;
    const action = EFFECT_ACTION_OVERRIDES[effect.id]?.[step.element];
    return action
      ? {
          type: 'action',
          actions: [action],
          state: step.on ? 'on' : 'off',
          ...(durationMs === undefined ? {} : { durationMs }),
        }
      : {
          type: 'set',
          elements: [step.element],
          state: step.on ? 'on' : 'off',
          ...(durationMs === undefined ? {} : { durationMs }),
        };
  });

export const effectHasSemanticActions = (effect: Effect): boolean =>
  [...effect.steps, ...(effect.offSteps ?? [])].some((step) =>
    Boolean(EFFECT_ACTION_OVERRIDES[effect.id]?.[step.element]),
  );

export const effectIsFullySemantic = (effect: Effect): boolean => {
  const steps = [...effect.steps, ...(effect.offSteps ?? [])];
  return (
    steps.length > 0 &&
    steps.every((step) => Boolean(EFFECT_ACTION_OVERRIDES[effect.id]?.[step.element]))
  );
};

export const effectActionManifestIssues = (effects: readonly Effect[]): string[] => {
  const issues: string[] = [];
  for (const [effectId, mapping] of Object.entries(EFFECT_ACTION_OVERRIDES)) {
    const effect = effects.find(({ id }) => id === effectId);
    if (!effect) {
      issues.push(`unknown effect: ${effectId}`);
      continue;
    }
    const sourceElements = new Set(
      [...effect.steps, ...(effect.offSteps ?? [])].map(({ element }) => element),
    );
    for (const element of Object.keys(mapping)) {
      if (!sourceElements.has(element as EffectStep['element']))
        issues.push(`stale source: ${effectId}/${element}`);
    }
  }
  return issues;
};
