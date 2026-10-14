import { type ElementId } from '@/data/elements';
import { PRESET_LIMITS } from '@/domain';

import { newStepKey, type EditorStep } from '../helpers';

export const DURATION_STEP_MS = 100;
export const DURATION_CHIPS: readonly number[] = [50, 100, 250, 500];
export const DEFAULT_DURATION_MS = 100;

export type StepType = 'set' | 'wait';

export interface StepFormValues {
  type: StepType;
  element: ElementId | undefined;
  state: 'on' | 'off';
  durationMs: number | undefined;
}

export const clampDuration = (value: number): number =>
  Math.min(Math.max(value, PRESET_LIMITS.minStepMs), PRESET_LIMITS.maxTotalMs);

export const stepDuration = (
  current: number | undefined,
  delta: number,
  allowEmpty = false,
): number | undefined => {
  const base = current ?? 0;
  const size = Math.abs(delta);
  const next =
    delta > 0 ? Math.floor(base / size) * size + size : Math.ceil(base / size) * size - size;
  if (allowEmpty && next < PRESET_LIMITS.minStepMs) return undefined;

  return clampDuration(next);
};

export const isDurationTooShort = (durationMs: number | undefined): boolean =>
  durationMs !== undefined && durationMs < PRESET_LIMITS.minStepMs;

export const isFormValid = (form: StepFormValues): boolean => {
  const durationOk = form.durationMs !== undefined && form.durationMs >= PRESET_LIMITS.minStepMs;

  if (form.type === 'wait') return durationOk;

  return form.element !== undefined && (form.durationMs === undefined || durationOk);
};

export const initialForm = (
  type: StepType,
  steps: readonly EditorStep[],
  selectable: readonly ElementId[],
): StepFormValues => {
  const previous = type === 'set' ? steps.findLast((step) => step.type === 'set') : undefined;
  const previousElement = previous?.type === 'set' ? previous.elements[0] : undefined;
  const element =
    previousElement && selectable.includes(previousElement) ? previousElement : selectable[0];

  if (previous?.type !== 'set') {
    return { type, element, state: 'on', durationMs: DEFAULT_DURATION_MS };
  }

  return { type, element, state: previous.state, durationMs: previous.durationMs };
};

export const buildStepFromForm = (form: StepFormValues): EditorStep | undefined => {
  if (form.type === 'wait') return { key: newStepKey(), type: 'wait', ms: form.durationMs ?? 0 };
  if (!form.element) return undefined;

  return {
    key: newStepKey(),
    type: 'set',
    elements: [form.element],
    state: form.state,
    ...(form.durationMs === undefined ? {} : { durationMs: form.durationMs }),
  };
};
