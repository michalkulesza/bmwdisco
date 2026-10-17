import { type ElementId } from '@/data/elements';
import { PRESET_LIMITS } from '@/domain';
import { LOGICAL_ACTION_IDS, type LogicalActionId } from '@/domain/actions/catalog';

import { newStepKey, type EditorStep } from '../helpers';

export const DURATION_STEP_MS = 100;
export const DURATION_CHIPS: readonly number[] = [50, 100, 250, 500];
export const DEFAULT_DURATION_MS = 100;

export type StepType = 'set' | 'action' | 'wait';

export interface StepFormValues {
  type: StepType;
  element: ElementId | undefined;
  action?: LogicalActionId;
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
  if (form.type === 'action')
    return form.action !== undefined && (form.durationMs === undefined || durationOk);

  return form.element !== undefined && (form.durationMs === undefined || durationOk);
};

export const initialForm = (
  requestedType: StepType | undefined,
  steps: readonly EditorStep[],
  selectable: readonly ElementId[],
): StepFormValues => {
  const previousLight = steps.findLast((step) => step.type !== 'wait');
  const type =
    requestedType ??
    (previousLight?.type === 'set'
      ? 'set'
      : previousLight?.type === 'action'
        ? 'action'
        : 'action');
  const previous = requestedType
    ? type === 'wait'
      ? undefined
      : [...steps].reverse().find((step) => step.type !== 'wait')
    : previousLight;
  const previousElement = previous?.type === 'set' ? previous.elements[0] : undefined;
  const previousAction = previous?.type === 'action' ? previous.actions[0] : undefined;
  const element =
    previousElement && selectable.includes(previousElement) ? previousElement : selectable[0];
  const action = previousAction ?? LOGICAL_ACTION_IDS[0];

  if (previous?.type !== 'set' && previous?.type !== 'action') {
    return {
      type,
      element,
      ...(type === 'action' ? { action } : {}),
      state: 'on',
      durationMs: DEFAULT_DURATION_MS,
    };
  }

  return {
    type,
    element,
    ...(type === 'action' ? { action } : {}),
    state: previous.state,
    durationMs: previous.durationMs,
  };
};

export const buildStepFromForm = (form: StepFormValues): EditorStep | undefined => {
  if (form.type === 'wait') return { key: newStepKey(), type: 'wait', ms: form.durationMs ?? 0 };
  if (form.type === 'action') {
    if (!form.action) return undefined;
    return {
      key: newStepKey(),
      type: 'action',
      actions: [form.action],
      state: form.state,
      ...(form.durationMs === undefined ? {} : { durationMs: form.durationMs }),
    };
  }
  if (!form.element) return undefined;

  return {
    key: newStepKey(),
    type: 'set',
    elements: [form.element],
    state: form.state,
    ...(form.durationMs === undefined ? {} : { durationMs: form.durationMs }),
  };
};
