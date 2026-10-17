import type { Effect, EffectStep } from '@/data/types';

import { adaptEffectSteps } from '../actions/effect-actions';

import { EFFECT_TICK_MS, TOGGLE_PRESET_HOLD_MS } from './limits';
import { parsePreset } from './schema';

import type { Preset, PresetStep } from './types';

export interface PresetAppearance {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export const stepsOf = (steps: readonly EffectStep[], tickMs: number): PresetStep[] =>
  steps.map((step, index) => ({
    type: 'set',
    elements: [step.element],
    state: step.on ? 'on' : 'off',
    ...(index < steps.length - 1 ? { durationMs: tickMs } : {}),
  }));

export const effectToSteps = (effect: Effect, tickMs: number = EFFECT_TICK_MS): PresetStep[] => {
  const onSteps = adaptEffectSteps(effect, effect.steps, tickMs);
  if (effect.kind !== 'toggle' || !effect.offSteps) return onSteps;

  return [
    ...onSteps,
    { type: 'wait', ms: TOGGLE_PRESET_HOLD_MS },
    ...adaptEffectSteps(effect, effect.offSteps, tickMs),
  ];
};

export const effectToPreset = (
  effect: Effect,
  appearance: PresetAppearance,
  tickMs: number = EFFECT_TICK_MS,
): Preset => parsePreset({ ...appearance, steps: effectToSteps(effect, tickMs) });
