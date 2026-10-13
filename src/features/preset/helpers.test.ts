import { PRESET_LIMITS } from '@/domain';

import { buildPresetPayload, moveItem, parseMs, validateDraft, type EditorStep } from './helpers';

const light = (key: string, durationMs?: number): EditorStep => ({
  key,
  type: 'set',
  elements: ['hazard'],
  state: 'on',
  durationMs,
});

const draft = (steps: EditorStep[], name = 'Mine') => ({ name, color: 'blue', icon: 'Car', steps });

describe('preset editor helpers', () => {
  it('accepts a valid draft', () => {
    expect(validateDraft(draft([light('a', 100)]))).toEqual([]);
  });

  it('reports a missing name and missing steps', () => {
    expect(validateDraft(draft([], '  ')).map((issue) => issue.code)).toEqual([
      'nameRequired',
      'noSteps',
    ]);
  });

  it('flags steps shorter than the minimum', () => {
    const issues = validateDraft(
      draft([light('a', PRESET_LIMITS.minStepMs - 1), { key: 'w', type: 'wait', ms: 0 }]),
    );

    expect(issues).toEqual([
      { scope: 'step', code: 'stepTooShort', stepKey: 'a' },
      { scope: 'step', code: 'stepTooShort', stepKey: 'w' },
    ]);
  });

  it('flags a total over the limit', () => {
    const issues = validateDraft(draft([light('a', 60_000), light('b', 60_000)]));

    expect(issues.map((issue) => issue.code)).toEqual(['tooLong']);
  });

  it('flags too many steps', () => {
    const many = Array.from({ length: PRESET_LIMITS.maxSteps + 1 }, (_, index) =>
      light(`s${index}`),
    );

    expect(validateDraft(draft(many)).map((issue) => issue.code)).toContain('tooManySteps');
  });

  it('builds a payload without editor keys and with a trimmed name', () => {
    const payload = buildPresetPayload(draft([light('a', 100)], ' Mine '), 'id1');

    expect(payload).toEqual({
      id: 'id1',
      name: 'Mine',
      color: 'blue',
      icon: 'Car',
      steps: [{ type: 'set', elements: ['hazard'], state: 'on', durationMs: 100 }],
    });
  });

  it('parses millisecond input', () => {
    expect(parseMs('')).toBeUndefined();
    expect(parseMs('12a3')).toBe(123);
    expect(parseMs('99999999')).toBe(PRESET_LIMITS.maxTotalMs);
  });

  it('moves items', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a'], 5, 0)).toEqual(['a']);
  });
});
