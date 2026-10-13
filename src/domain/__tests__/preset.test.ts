import { loadEffects } from '@/data/generated';
import { InvalidPresetError, PresetImportError } from '@/domain/errors';
import { effectToPreset, effectToSteps } from '@/domain/preset/effect-preset';
import { exportPresets, importPresets } from '@/domain/preset/import-export';
import { EFFECT_TICK_MS, PRESET_LIMITS, TOGGLE_PRESET_HOLD_MS } from '@/domain/preset/limits';
import { isValidPreset, parsePreset, totalDurationMs } from '@/domain/preset/schema';
import type { Preset } from '@/domain/preset/types';

const preset = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Wave',
  color: 'orange',
  icon: 'Lightning',
  steps: [
    { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 100 },
    { type: 'wait', ms: 200 },
    { type: 'set', elements: ['lowBeamLeft', 'lowBeamRight'], state: 'off' },
  ],
  ...overrides,
});

const fileOf = (presets: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 'bimmerdisco.presets', version: 1, presets, ...extra });

const importFailure = (text: string): PresetImportError => {
  try {
    importPresets(text);
  } catch (error) {
    return error as PresetImportError;
  }
  throw new Error('import unexpectedly succeeded');
};

describe('preset validation', () => {
  it('accepts a well-formed preset and sums its duration', () => {
    const parsed = parsePreset(preset());

    expect(parsed.steps).toHaveLength(3);
    expect(totalDurationMs(parsed.steps)).toBe(300);
    expect(isValidPreset(preset())).toBe(true);
  });

  it('round-trips loop blocks and hold playback through export/import', () => {
    const looping = parsePreset(preset({ steps: [...preset().steps, { type: 'loop' }] }));
    const held = parsePreset(preset({ id: 'held', playback: 'hold' }));
    expect(importPresets(exportPresets([looping, held]))).toEqual([looping, held]);
  });

  it.each([
    ['loop alone', preset({ steps: [{ type: 'loop' }] })],
    ['blocks after loop', preset({ steps: [{ type: 'loop' }, { type: 'wait', ms: 100 }] })],
    [
      'multiple loops',
      preset({ steps: [{ type: 'wait', ms: 100 }, { type: 'loop' }, { type: 'loop' }] }),
    ],
    ['unknown top-level key', preset({ extra: 1 })],
    ['unknown step key', preset({ steps: [{ type: 'wait', ms: 100, note: 'x' }] })],
    ['unknown element', preset({ steps: [{ type: 'set', elements: ['nope'], state: 'on' }] })],
    ['empty element list', preset({ steps: [{ type: 'set', elements: [], state: 'on' }] })],
    ['bad state', preset({ steps: [{ type: 'set', elements: ['lowBeamLeft'], state: 'blink' }] })],
    ['wait below 50 ms', preset({ steps: [{ type: 'wait', ms: 49 }] })],
    ['fractional wait', preset({ steps: [{ type: 'wait', ms: 60.5 }] })],
    [
      'step duration below 50 ms',
      preset({ steps: [{ type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 10 }] }),
    ],
    ['no steps', preset({ steps: [] })],
    ['too many steps', preset({ steps: Array(201).fill({ type: 'wait', ms: 50 }) })],
    [
      'total above 90 s',
      preset({
        steps: [
          { type: 'wait', ms: 60_000 },
          { type: 'wait', ms: 30_001 },
        ],
      }),
    ],
    ['empty name', preset({ name: '   ' })],
    ['long name', preset({ name: 'x'.repeat(41) })],
    ['bad id', preset({ id: 'has space' })],
    ['bad color', preset({ color: '#ff0000' })],
    ['bad icon', preset({ icon: 'lightning bolt' })],
    ['missing field', { id: 'p', name: 'n' }],
    ['not an object', 'preset'],
  ])('rejects %s', (_, candidate) => {
    expect(isValidPreset(candidate)).toBe(false);
    expect(() => parsePreset(candidate)).toThrow(InvalidPresetError);
  });

  it('accepts exactly the limits', () => {
    const atLimit = preset({ steps: Array(PRESET_LIMITS.maxSteps).fill({ type: 'wait', ms: 50 }) });
    const ninetySeconds = preset({
      steps: [
        { type: 'wait', ms: 60_000 },
        { type: 'wait', ms: 30_000 },
      ],
    });

    expect(isValidPreset(atLimit)).toBe(true);
    expect(isValidPreset(ninetySeconds)).toBe(true);
  });

  it('lists the offending paths in the error', () => {
    try {
      parsePreset(preset({ name: '' }));
    } catch (error) {
      expect((error as InvalidPresetError).issues[0]).toContain('name');
    }
    expect.assertions(1);
  });
});

describe('effect to preset', () => {
  const effects = loadEffects();
  const appearance = { id: 'dup1', name: 'Copy', color: 'blue', icon: 'Car' };

  it('converts every one-shot effect into a valid preset using the tick interval', () => {
    for (const effect of effects.filter((candidate) => candidate.kind === 'oneShot')) {
      const converted = effectToPreset(effect, appearance);

      expect(converted.steps).toHaveLength(effect.steps.length);
      expect(totalDurationMs(converted.steps)).toBe((effect.steps.length - 1) * EFFECT_TICK_MS);
    }
  });

  it('honours a custom tick and leaves the final step without a duration', () => {
    const effect = effects.find(
      (candidate) => candidate.kind === 'oneShot' && candidate.steps.length === 2,
    )!;

    const steps = effectToSteps(effect, 250);

    expect(steps[0]).toMatchObject({ type: 'set', durationMs: 250 });
    expect(steps[1]).not.toHaveProperty('durationMs');
  });

  it('turns a toggle into on, hold, off', () => {
    const toggle = effects.find((candidate) => candidate.kind === 'toggle')!;

    const converted = effectToPreset(toggle, appearance);

    expect(converted.steps.map((step) => step.type)).toEqual(['set', 'wait', 'set']);
    expect(converted.steps[1]).toEqual({ type: 'wait', ms: TOGGLE_PRESET_HOLD_MS });
  });

  it('keeps a toggle without off steps as its on steps', () => {
    const toggle = effects.find((candidate) => candidate.kind === 'toggle')!;

    const steps = effectToSteps({ ...toggle, offSteps: undefined });

    expect(steps.map((step) => step.type)).toEqual(['set']);
  });
});

describe('import and export', () => {
  const presets = [parsePreset(preset()), parsePreset(preset({ id: 'p2', name: 'Other' }))];

  it('round-trips presets', () => {
    expect(importPresets(exportPresets(presets))).toEqual(presets);
  });

  it('rejects files over 1 MB, counted in UTF-8 bytes', () => {
    expect(importFailure('x'.repeat(PRESET_LIMITS.maxFileBytes + 1)).code).toBe('tooLarge');
    expect(importFailure('\u{1F697}'.repeat(PRESET_LIMITS.maxFileBytes / 4 + 1)).code).toBe(
      'tooLarge',
    );
    expect(importFailure('€'.repeat(PRESET_LIMITS.maxFileBytes / 3 + 1)).code).toBe('tooLarge');
    expect(importFailure('é'.repeat(PRESET_LIMITS.maxFileBytes / 2 + 1)).code).toBe('tooLarge');
  });

  it('rejects invalid JSON', () => {
    expect(importFailure('{nope').code).toBe('invalidJson');
  });

  it.each([
    ['wrong format', fileOf([], { format: 'other' })],
    ['wrong version', fileOf([], { version: 2 })],
    ['unknown file key', fileOf([], { extra: true })],
    ['not an object', '[]'],
  ])('rejects %s', (_, text) => {
    expect(importFailure(text).code).toBe('invalidFormat');
  });

  it('rejects more than 100 presets', () => {
    const many = Array.from({ length: 101 }, (_, index) => preset({ id: `p${index}` }));

    expect(importFailure(fileOf(many)).code).toBe('tooManyPresets');
  });

  it('reports which preset is invalid', () => {
    const failure = importFailure(fileOf([preset(), preset({ id: 'p2', name: '' })]));

    expect(failure.code).toBe('invalidPreset');
    expect(failure.issues[0]).toContain('#2');
  });

  it('rejects unknown keys and unknown elements inside presets', () => {
    expect(importFailure(fileOf([preset({ evil: true })])).code).toBe('invalidPreset');
    expect(
      importFailure(fileOf([preset({ steps: [{ type: 'set', elements: ['nope'], state: 'on' }] })]))
        .code,
    ).toBe('invalidPreset');
  });

  it('rejects duplicate ids', () => {
    expect(importFailure(fileOf([preset(), preset()])).issues).toEqual(['duplicate id']);
  });

  it('accepts exactly 100 presets', () => {
    const many: Preset[] = Array.from({ length: 100 }, (_, index) =>
      parsePreset(preset({ id: `p${index}` })),
    );

    expect(importPresets(exportPresets(many))).toHaveLength(100);
  });
});
