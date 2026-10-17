import { categoryOf, isElementId, type ElementId } from '@/data/elements';

import { assessSteps, contextOf } from '../actions/availability';
import { adaptEffectSteps } from '../actions/effect-actions';
import { ActionUnavailableError, NothingToRunError } from '../errors';
import { effectToSteps } from '../preset/effect-preset';
import { EFFECT_TICK_MS } from '../preset/limits';

import type { RunnableItem } from './types';
import type { PresetStep } from '../preset/types';
import type { DetectedCar, DetectedModule } from '../registry/types';

export interface PlannedSend {
  module: DetectedModule;
  element: ElementId;
  payload: Uint8Array;
}

export interface PlannedStep {
  atMs: number;
  sends: PlannedSend[];
}

export interface RunPlan {
  steps: PlannedStep[];
  endMs: number;
  modules: DetectedModule[];
  silence: DetectedModule[];
  cluster: DetectedModule[];
  skipped: ElementId[];
}

export interface PlanInput {
  steps: PresetStep[];
  clusterFeedback: boolean;
  silenceCommunication: boolean;
  allowPartial?: boolean;
}

export const planInputOf = (item: RunnableItem): PlanInput => {
  if (item.kind === 'preset') {
    return { steps: item.preset.steps, clusterFeedback: false, silenceCommunication: false };
  }

  const { effect } = item;
  if (effect.kind === 'toggle') {
    const turningOn = item.on ?? true;
    const source = turningOn ? effect.steps : (effect.offSteps ?? []);

    return {
      steps: adaptEffectSteps(effect, source, EFFECT_TICK_MS),
      clusterFeedback: turningOn && effect.clusterFeedback,
      silenceCommunication: turningOn && effect.silenceCommunication,
      allowPartial: effect.id === 'ghost.fullOFF',
    };
  }

  return {
    steps: effectToSteps(effect),
    clusterFeedback: effect.clusterFeedback,
    silenceCommunication: effect.silenceCommunication,
    allowPartial: effect.id === 'ghost.fullOFF',
  };
};

export const isReleaseOnly = (item: RunnableItem): boolean =>
  item.kind === 'effect' &&
  item.effect.kind === 'toggle' &&
  item.on === false &&
  (item.effect.offSteps ?? []).length === 0;

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export const buildPlan = (input: PlanInput, car: DetectedCar): RunPlan => {
  const assessment = assessSteps(contextOf(car), input.steps, { allowPartial: input.allowPartial });
  if (assessment.status !== 'runnable' && assessment.status !== 'partial') {
    const failure = assessment.missing.find((result) => result.status === 'unknown');
    if (failure?.status === 'unknown') throw new ActionUnavailableError(failure.reason);
    if (assessment.steps.length === 0) throw new NothingToRunError();
    throw new ActionUnavailableError('missingOutput');
  }
  const steps: PlannedStep[] = assessment.steps.map((step) => ({
    atMs: step.atMs,
    sends: step.targets.map((target) => ({
      module: target.module,
      element: target.element,
      payload: Uint8Array.from(
        target.module.module.elements[target.element]![step.state === 'on' ? 'on' : 'off'],
      ),
    })),
  }));
  const skipped = assessment.missing.flatMap((missing) =>
    isElementId(missing.intent) ? [missing.intent] : [],
  );

  const sends = steps.flatMap((step) => step.sends);
  const modules = unique(sends.map((send) => send.module));
  const silence = input.silenceCommunication
    ? unique(
        sends
          .filter(
            (send) =>
              categoryOf(send.element) === 'headlightLeds' &&
              send.module.module.commands.COMMUNICATION_OFF,
          )
          .map((send) => send.module),
      )
    : [];
  const cluster = input.clusterFeedback
    ? car.modules.filter((module) => module.module.elements.clusterFeedback)
    : [];

  return { steps, endMs: assessment.endMs, modules, silence, cluster, skipped };
};
