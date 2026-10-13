import { categoryOf, type ElementId } from '@/data/elements';

import { NothingToRunError } from '../errors';
import { effectToSteps, stepsOf } from '../preset/effect-preset';
import { EFFECT_TICK_MS } from '../preset/limits';
import { stepDurationMs } from '../preset/schema';

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
      steps: stepsOf(source, EFFECT_TICK_MS),
      clusterFeedback: turningOn && effect.clusterFeedback,
      silenceCommunication: turningOn && effect.silenceCommunication,
    };
  }

  return {
    steps: effectToSteps(effect),
    clusterFeedback: effect.clusterFeedback,
    silenceCommunication: effect.silenceCommunication,
  };
};

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const sendsFor = (step: PresetStep, car: DetectedCar, skipped: Set<ElementId>): PlannedSend[] => {
  if (step.type === 'wait') return [];

  const sends = step.elements.flatMap((element) => {
    const targets = car.elementTargets.get(element);
    if (!targets) {
      skipped.add(element);

      return [];
    }

    return targets.map((target) => {
      const commands = target.module.module.elements[target.element]!;

      return {
        module: target.module,
        element: target.element,
        payload: Uint8Array.from(step.state === 'on' ? commands.on : commands.off),
      };
    });
  });

  return sends.filter(
    (send, index) =>
      sends.findIndex((other) => other.module === send.module && other.element === send.element) ===
      index,
  );
};

export const buildPlan = (input: PlanInput, car: DetectedCar): RunPlan => {
  const skipped = new Set<ElementId>();
  const steps: PlannedStep[] = [];
  let cursor = 0;

  for (const step of input.steps) {
    const sends = sendsFor(step, car, skipped);
    if (sends.length > 0) steps.push({ atMs: cursor, sends });
    cursor += stepDurationMs(step);
  }
  if (steps.length === 0) throw new NothingToRunError();

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

  return { steps, endMs: cursor, modules, silence, cluster, skipped: [...skipped] };
};
