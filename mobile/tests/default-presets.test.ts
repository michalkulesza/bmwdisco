import test from 'node:test';
import assert from 'node:assert/strict';
import { FOG_STROBE, withDefaultPresets } from '../src/default-presets';
import { parsePresets, serializePresets, validatePreset } from '../src/presets';

test('Fog Strobe is valid and has exactly 3 seconds of delays', () => {
  assert.deepEqual(validatePreset(FOG_STROBE), FOG_STROBE);
  const delayMs = FOG_STROBE.steps.reduce((sum, step) => sum + (step.type === 'wait' ? step.durationMs : 0), 0);
  assert.equal(delayMs, 3000);
  assert.equal(FOG_STROBE.steps.length, 120);
  assert.deepEqual(parsePresets(serializePresets([FOG_STROBE])), [FOG_STROBE]);
});

test('default presets are appended once, never duplicated, and respect the limit', () => {
  const party = { ...FOG_STROBE, id: 'party', name: 'Party' };
  assert.deepEqual(withDefaultPresets([party], 100).map(p => p.id), ['party', 'default-fog-strobe']);
  assert.deepEqual(withDefaultPresets([FOG_STROBE], 100), [FOG_STROBE]);
  assert.deepEqual(withDefaultPresets([party], 1), [party]);
});
