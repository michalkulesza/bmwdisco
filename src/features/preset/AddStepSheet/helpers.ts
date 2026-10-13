import { categoryOf, type ElementCategory, type ElementId } from '@/data/elements';
import { PRESET_LIMITS } from '@/domain';

import { CATEGORY_ORDER } from '../category-appearance';
import { newStepKey, type EditorStep } from '../helpers';

export const DURATION_STEP_MS = 50;
export const DURATION_CHIPS: readonly number[] = [50, 100, 250, 500];
export const DEFAULT_DURATION_MS = 100;

export type StepType = 'set' | 'wait';

export type ElementListRow =
  { type: 'group'; category: ElementCategory } | { type: 'item'; id: ElementId };

export interface StepFormValues {
  type: StepType;
  element: ElementId | undefined;
  state: 'on' | 'off';
  durationMs: number | undefined;
  immediate?: boolean;
}

export const groupElements = (ids: readonly ElementId[]): ElementListRow[] =>
  CATEGORY_ORDER.flatMap((category) => {
    const items = ids.filter((id) => categoryOf(id) === category);

    return items.length === 0
      ? []
      : [
          { type: 'group' as const, category },
          ...items.map((id) => ({ type: 'item' as const, id })),
        ];
  });

export const clampDuration = (value: number): number =>
  Math.min(Math.max(value, PRESET_LIMITS.minStepMs), PRESET_LIMITS.maxTotalMs);

export const stepDuration = (current: number | undefined, delta: number): number =>
  clampDuration((current ?? 0) + delta);

export const isFormValid = (form: StepFormValues): boolean => {
  const durationOk = form.durationMs !== undefined && form.durationMs >= PRESET_LIMITS.minStepMs;

  return (
    (durationOk || (form.type === 'set' && form.immediate === true)) &&
    (form.type === 'wait' || form.element !== undefined)
  );
};

export const formFromStep = (
  step: EditorStep | undefined,
  fallbackType: StepType,
): StepFormValues => {
  if (!step || step.type === 'loop') {
    return { type: fallbackType, element: undefined, state: 'on', durationMs: DEFAULT_DURATION_MS };
  }

  if (step.type === 'wait') {
    return { type: 'wait', element: undefined, state: 'on', durationMs: step.ms };
  }

  return {
    type: 'set',
    element: step.elements[0],
    state: step.state,
    durationMs: step.durationMs,
    immediate: step.durationMs === undefined,
  };
};

export const buildStepFromForm = (
  form: StepFormValues,
  key = newStepKey(),
): EditorStep | undefined => {
  const durationMs = form.durationMs ?? 0;
  if (form.type === 'wait') return { key, type: 'wait', ms: durationMs };
  if (!form.element) return undefined;

  return {
    key,
    type: 'set',
    elements: [form.element],
    state: form.state,
    ...(form.immediate ? {} : { durationMs }),
  };
};
