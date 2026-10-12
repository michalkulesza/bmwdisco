import test from 'node:test';
import assert from 'node:assert/strict';
import { LIGHT_ELEMENTS, LightingPreset, PRESET_LIMITS, mergePresets, parsePresets, serializePresets, validatePreset } from '../src/presets';

const blink: LightingPreset = {
  id: 'blink',
  name: 'Blink',
  steps: [
    { type: 'set', elements: ['frontLeftIndicator', 'frontRightIndicator'], state: 'on' },
    { type: 'wait', durationMs: 500 },
    { type: 'set', elements: ['frontLeftIndicator'], state: 'off' },
  ],
};

const file = (presets: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schemaVersion: 1, presets, ...extra });

const withSteps = (steps: unknown[]) => ({ id: 'p', name: 'P', steps });
const setLeft = { type: 'set', elements: ['frontLeftIndicator'], state: 'on' };

test('serialize and parse round-trip', () => {
  const json = serializePresets([blink]);
  assert.equal(JSON.parse(json).schemaVersion, 1);
  assert.deepEqual(parsePresets(json), [blink]);
});

test('single-preset export is a one-item array', () => {
  assert.equal(JSON.parse(serializePresets([blink])).presets.length, 1);
});

test('singular element is normalized to elements', () => {
  const preset = validatePreset(withSteps([{ type: 'set', element: 'frontRightIndicator', state: 'on' }]));
  assert.deepEqual(preset.steps[0], { type: 'set', elements: ['frontRightIndicator'], state: 'on' });
});

test('every generic element is accepted in one block and round-trips', () => {
  const elements = LIGHT_ELEMENTS.map(light => light.id);
  const preset = validatePreset(withSteps([{ type: 'set', elements, state: 'on' }]));
  assert.deepEqual(parsePresets(serializePresets([preset]))[0].steps[0], { type: 'set', elements, state: 'on' });
});

test('older files that only use the two indicator ids still parse', () => {
  const parsed = parsePresets(file([withSteps([{ type: 'set', elements: ['frontLeftIndicator', 'frontRightIndicator'], state: 'on' }])]));
  assert.deepEqual(parsed[0].steps[0], { type: 'set', elements: ['frontLeftIndicator', 'frontRightIndicator'], state: 'on' });
});

test('name is trimmed', () => {
  assert.equal(validatePreset({ ...withSteps([setLeft]), name: '  Hi  ' }).name, 'Hi');
});

const rejections: [string, () => unknown, RegExp][] = [
  ['invalid JSON', () => parsePresets('{nope'), /Invalid JSON/],
  ['wrong schemaVersion', () => parsePresets(JSON.stringify({ schemaVersion: 2, presets: [] })), /schemaVersion/],
  ['unknown file field', () => parsePresets(file([], { extra: 1 })), /unknown field "extra"/],
  ['unknown preset field', () => parsePresets(file([{ ...withSteps([setLeft]), color: 'red' }])), /unknown field "color"/],
  ['unknown step field', () => validatePreset(withSteps([{ ...setLeft, speed: 1 }])), /unknown field "speed"/],
  ['non-array presets', () => parsePresets(JSON.stringify({ schemaVersion: 1, presets: {} })), /presets array/],
  ['unsupported element', () => validatePreset(withSteps([{ ...setLeft, elements: ['horn'] }])), /supported, unique light elements/],
  ['duplicate elements', () => validatePreset(withSteps([{ ...setLeft, elements: ['frontLeftIndicator', 'frontLeftIndicator'] }])), /unique/],
  ['empty elements', () => validatePreset(withSteps([{ ...setLeft, elements: [] }])), /light elements/],
  ['element and elements', () => validatePreset(withSteps([{ ...setLeft, element: 'frontLeftIndicator' }])), /not both/],
  ['bad state', () => validatePreset(withSteps([{ ...setLeft, state: 'blink' }])), /state must be on or off/],
  ['unsupported block type', () => validatePreset(withSteps([{ type: 'flash' }])), /unsupported block type/],
  ['wait below 50', () => validatePreset(withSteps([setLeft, { type: 'wait', durationMs: 49 }])), /delay must be 50–2000 ms/],
  ['wait above 2000', () => validatePreset(withSteps([setLeft, { type: 'wait', durationMs: 2001 }])), /delay must be 50–2000 ms/],
  ['non-integer wait', () => validatePreset(withSteps([setLeft, { type: 'wait', durationMs: 100.5 }])), /delay must be/],
  ['string wait', () => validatePreset(withSteps([setLeft, { type: 'wait', durationMs: '100' }])), /delay must be/],
  ['total wait above 60000', () => validatePreset(withSteps([setLeft, ...Array.from({ length: 31 }, () => ({ type: 'wait', durationMs: 2000 }))])), /60 seconds/],
  ['empty steps', () => validatePreset(withSteps([])), /1–200 blocks/],
  ['no set block', () => validatePreset(withSteps([{ type: 'wait', durationMs: 100 }])), /at least one light block/],
  ['too many steps', () => validatePreset(withSteps(Array.from({ length: PRESET_LIMITS.steps + 1 }, () => setLeft))), /1–200 blocks/],
  ['invalid id', () => validatePreset({ ...withSteps([setLeft]), id: 'bad id!' }), /invalid id/],
  ['empty name', () => validatePreset({ ...withSteps([setLeft]), name: '   ' }), /name must be/],
  ['overlong name', () => validatePreset({ ...withSteps([setLeft]), name: 'x'.repeat(81) }), /name must be/],
  ['duplicate preset ids', () => parsePresets(file([withSteps([setLeft]), withSteps([setLeft])])), /duplicate preset IDs/],
  ['too many presets', () => parsePresets(file(Array.from({ length: PRESET_LIMITS.presets + 1 }, (_, i) => ({ ...withSteps([setLeft]), id: `p${i}` })))), /at most 100 presets/],
  ['oversized file', () => parsePresets(' '.repeat(PRESET_LIMITS.fileBytes + 1)), /too large/],
];

for (const [name, run, message] of rejections) {
  test(`rejects ${name}`, () => assert.throws(run, message));
}

test('accepts boundary waits and step counts', () => {
  const steps = [setLeft, { type: 'wait', durationMs: 50 }, { type: 'wait', durationMs: 2000 }];
  assert.equal(validatePreset(withSteps(steps)).steps.length, 3);
  const waits = Array.from({ length: 30 }, () => ({ type: 'wait', durationMs: 2000 }));
  assert.equal(validatePreset(withSteps([setLeft, ...waits])).steps.length, 31);
  assert.equal(validatePreset(withSteps(Array.from({ length: PRESET_LIMITS.steps }, () => setLeft))).steps.length, 200);
});

test('mergePresets keeps non-colliding presets unchanged', () => {
  const other = { ...blink, id: 'other', name: 'Other' };
  assert.deepEqual(mergePresets([blink], [other]), [blink, other]);
});

test('mergePresets renames colliding ids and suffixes the name', () => {
  const merged = mergePresets([blink], [blink]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], blink);
  assert.notEqual(merged[1].id, 'blink');
  assert.equal(merged[1].name, 'Blink (imported)');
  assert.deepEqual(merged[1].steps, blink.steps);
});

test('mergePresets keeps long colliding names within the limit', () => {
  const long = { ...blink, name: 'x'.repeat(80) };
  const merged = mergePresets([long], [long]);
  assert.ok(merged[1].name.endsWith(' (imported)'));
  assert.ok(merged[1].name.length <= 80);
});
