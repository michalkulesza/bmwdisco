import test from 'node:test';
import assert from 'node:assert/strict';
import { F32_PROFILE } from '../src/protocol/profiles';
import { LightingPreset } from '../src/presets';
import { CAS_IDENTITY, FRM_IDENTITY, fixture } from './vehicle-fixture';

const LEFT_ON = '2F 45 01 03 0D 01';
const LEFT_OFF = '2F 45 01 03 0D 00';
const RIGHT_ON = '2F 45 01 03 0E 01';
const RIGHT_OFF = '2F 45 01 03 0E 00';
const RETURN_CONTROL = '2F 45 01 00 FE';

const sequence: LightingPreset = {
  id: 'seq',
  name: 'Sequence',
  steps: [
    { type: 'set', elements: ['frontLeftIndicator', 'frontRightIndicator'], state: 'on' },
    { type: 'wait', durationMs: 50 },
    { type: 'set', elements: ['frontLeftIndicator'], state: 'off' },
  ],
};

const longWait: LightingPreset = {
  id: 'long',
  name: 'Long',
  steps: [
    { type: 'set', elements: ['frontLeftIndicator'], state: 'on' },
    { type: 'wait', durationMs: 2000 },
    { type: 'set', elements: ['frontRightIndicator'], state: 'on' },
  ],
};

test('playPreset runs steps in order and cleans up touched lights', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0);
  await session.playPreset(sequence);
  assert.deepEqual(sent, ['22 F1 50', '10 03', LEFT_ON, RIGHT_ON, LEFT_OFF, LEFT_OFF, RIGHT_OFF, RETURN_CONTROL, '10 01']);
  assert.equal(session.state.busy, false);
  assert.equal(session.state.error, null);
  assert.equal(session.state.presetProgress, null);
});

test('playPreset refuses when the controller is not verified', async () => {
  const { session, sent } = fixture({ identities: { 0x40: [0, 1, 2], 0x72: [0, 1, 2] } });
  await session.connect('demo', '', 0);
  await session.playPreset(sequence);
  assert.deepEqual(sent, ['22 F1 50', '22 F1 50']);
  assert.match(session.state.error!, /Identify a supported vehicle/);
});

test('playPreset rejects an invalid preset without sending commands', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0);
  await session.playPreset({ id: 'bad', name: 'Bad', steps: [] });
  assert.deepEqual(sent, ['22 F1 50']);
  assert.match(session.state.error!, /blocks/);
});

test('stop during a wait cancels, turns touched lights off, and restores control', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0);
  const play = session.playPreset(longWait);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(sent.at(-1), LEFT_ON);
  const started = Date.now(); await session.stop(); await play;
  assert.ok(Date.now() - started < 500);
  assert.deepEqual(sent.slice(-3), [LEFT_OFF, RETURN_CONTROL, '10 01']);
  assert.equal(sent.includes(RIGHT_ON), false);
  assert.equal(sent.includes(RIGHT_OFF), false);
  assert.equal(session.state.busy, false);
});

test('a rejected command still turns the light off and restores control', async () => {
  const { session, sent } = fixture({ reject: LEFT_ON });
  await session.connect('demo', '', 0);
  await session.playPreset(sequence);
  assert.deepEqual(sent.slice(-3), [LEFT_OFF, RETURN_CONTROL, '10 01']);
  assert.equal(sent.includes(RIGHT_ON), false);
  assert.match(session.state.error!, /rejected/);
  assert.equal(session.state.busy, false);
});

test('a second playPreset while one runs is ignored', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0);
  const first = session.playPreset(sequence);
  await session.playPreset(longWait);
  await first;
  assert.equal(sent.filter(s => s === '10 03').length, 1);
  assert.equal(sent.filter(s => s === RETURN_CONTROL).length, 1);
  assert.equal(session.state.error, null);
});

test('the same preset translates to FRM3 bytes on an F10', async () => {
  const { session, addressed } = fixture({ identities: { 0x40: CAS_IDENTITY, 0x72: FRM_IDENTITY } });
  await session.connect('demo', '', 0);
  addressed.length = 0;
  await session.playPreset(sequence);
  assert.deepEqual(addressed.map(entry => entry.replace(/^72:/, '')), ['10 03', '2F 01 1C 03 64', '2F 01 1D 03 64',
    '2F 01 1C 03 00', '2F 01 1C 03 00', '2F 01 1D 03 00', '10 01']);
  assert.ok(addressed.every(entry => entry.startsWith('72:')));
  assert.equal(session.state.error, null);
});

test('elements unsupported by the profile are skipped, logged, and never cleaned up', async () => {
  const { frontRightIndicator: _, ...elements } = F32_PROFILE.elements;
  const partial = { ...F32_PROFILE, elements };
  const { session, sent } = fixture({ profiles: [partial] });
  await session.connect('demo', '', 0);
  await session.playPreset(sequence);
  assert.deepEqual(sent, ['22 F1 50', '10 03', LEFT_ON, LEFT_OFF, LEFT_OFF, RETURN_CONTROL, '10 01']);
  assert.match(session.state.logs.join('\n'), /Front indicator right: skipped, unsupported on BMW F32/);
  assert.equal(session.state.error, null);
});

const mixed: LightingPreset = {
  id: 'mixed',
  name: 'Mixed',
  steps: [
    { type: 'set', elements: ['brakeAll', 'licensePlate', 'frontLeftIndicator'], state: 'on' },
    { type: 'set', elements: ['brakeAll'], state: 'off' },
  ],
};

test('F32-only and F10-only elements translate on F32 and skip the F10-only one', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0);
  await session.playPreset(mixed);
  assert.deepEqual(sent, ['22 F1 50', '10 03', '2E D5 42 00 0C 00 64', LEFT_ON, '2E D5 42 00 0C 00 00',
    '2E D5 42 00 0C 00 00', LEFT_OFF, RETURN_CONTROL, '10 01']);
  assert.match(session.state.logs.join('\n'), /Licence plate light: skipped, unsupported on BMW F32/);
  assert.equal(session.state.error, null);
});

test('F32-only elements are skipped on an F10 while F10-only ones run', async () => {
  const { session, addressed } = fixture({ identities: { 0x40: CAS_IDENTITY, 0x72: FRM_IDENTITY } });
  await session.connect('demo', '', 0);
  addressed.length = 0;
  await session.playPreset(mixed);
  assert.deepEqual(addressed.map(entry => entry.replace(/^72:/, '')), ['10 03', '2F 01 0E 03 64', '2F 01 1C 03 64',
    '2F 01 0E 03 00', '2F 01 1C 03 00', '10 01']);
  assert.match(session.state.logs.join('\n'), /Brake lights \(all, aggregate\): skipped, unsupported on BMW F10\/F11/);
  assert.equal(session.state.error, null);
});
