import { PRESET_LIMITS } from '@/domain';

import {
  buildStepFromForm,
  initialForm,
  isDurationTooShort,
  isFormValid,
  stepDuration,
  type StepFormValues,
} from './helpers';

const lightForm = (durationMs: number | undefined): StepFormValues => ({
  type: 'set',
  element: 'hazard',
  state: 'on',
  durationMs,
});

describe('add step helpers', () => {
  it('steps from empty up to the step size and back to empty when empty is allowed', () => {
    expect(stepDuration(undefined, 100, true)).toBe(100);
    expect(stepDuration(100, -100, true)).toBeUndefined();
    expect(stepDuration(50, -100, true)).toBeUndefined();
    expect(stepDuration(200, -100, true)).toBe(100);
  });

  it('snaps off-grid values to the next multiple of the step', () => {
    expect(stepDuration(150, 100)).toBe(200);
    expect(stepDuration(150, -100)).toBe(100);
    expect(stepDuration(250, 100)).toBe(300);
  });

  it('clamps to the limits when empty is not allowed', () => {
    expect(stepDuration(undefined, 100)).toBe(100);
    expect(stepDuration(100, -100)).toBe(PRESET_LIMITS.minStepMs);
    expect(stepDuration(PRESET_LIMITS.maxTotalMs, 100, true)).toBe(PRESET_LIMITS.maxTotalMs);
  });

  it('accepts an empty light duration but not an empty or short wait', () => {
    expect(isFormValid(lightForm(undefined))).toBe(true);
    expect(isFormValid(lightForm(10))).toBe(false);
    expect(isFormValid({ ...lightForm(undefined), type: 'wait' })).toBe(false);
    expect(isFormValid({ ...lightForm(100), type: 'wait' })).toBe(true);
    expect(isFormValid({ ...lightForm(undefined), element: undefined })).toBe(false);
    expect(isDurationTooShort(undefined)).toBe(false);
    expect(isDurationTooShort(10)).toBe(true);
  });

  it('builds an unkeyed-input step from the form and omits an empty duration', () => {
    expect(buildStepFromForm(lightForm(undefined))).toMatchObject({
      type: 'set',
      elements: ['hazard'],
      state: 'on',
    });
    expect(buildStepFromForm(lightForm(undefined))).not.toHaveProperty('durationMs');
    expect(buildStepFromForm(lightForm(200))).toMatchObject({ durationMs: 200 });
    expect(buildStepFromForm({ ...lightForm(300), type: 'wait' })).toMatchObject({
      type: 'wait',
      ms: 300,
    });
  });

  it('starts a new light step from the previous light step', () => {
    const steps = [
      { key: 'a', type: 'set' as const, elements: ['hazard' as const], state: 'off' as const },
      { key: 'b', type: 'wait' as const, ms: 100 },
    ];

    expect(initialForm('set', steps, ['hazard', 'tailLeft'])).toEqual({
      type: 'set',
      element: 'hazard',
      state: 'off',
      durationMs: undefined,
    });
    expect(initialForm('set', steps, ['tailLeft'])).toMatchObject({ element: 'tailLeft' });
    expect(initialForm('wait', steps, ['hazard'])).toMatchObject({ type: 'wait', durationMs: 100 });
    expect(initialForm('set', [], ['hazard'])).toEqual({
      type: 'set',
      element: 'hazard',
      state: 'on',
      durationMs: 100,
    });
  });

  it('defaults to the first semantic action and inherits the latest non-wait step across kinds', () => {
    expect(initialForm(undefined, [], ['hazard'])).toMatchObject({
      type: 'action',
      action: 'indicatorsLeft',
      state: 'on',
      durationMs: 100,
    });

    const mixed = [
      {
        key: 'legacy',
        type: 'set' as const,
        elements: ['hazard' as const],
        state: 'off' as const,
        durationMs: 250,
      },
      { key: 'wait', type: 'wait' as const, ms: 100 },
      {
        key: 'semantic',
        type: 'action' as const,
        actions: ['brakesAll' as const],
        state: 'on' as const,
        durationMs: 500,
      },
    ];
    expect(initialForm(undefined, mixed, ['hazard'])).toMatchObject({
      type: 'action',
      action: 'brakesAll',
      state: 'on',
      durationMs: 500,
    });

    const latestLegacy = [
      ...mixed,
      {
        key: 'legacy-latest',
        type: 'set' as const,
        elements: ['hazard' as const],
        state: 'off' as const,
        durationMs: 350,
      },
    ];
    expect(initialForm(undefined, latestLegacy, ['hazard'])).toMatchObject({
      type: 'set',
      element: 'hazard',
      state: 'off',
      durationMs: 350,
    });
  });
});
