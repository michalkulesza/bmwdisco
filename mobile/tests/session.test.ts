import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleSession } from '../src/session';
import { LightingPreset } from '../src/presets';
import { CAS_IDENTITY, FRM_IDENTITY, fixture } from './vehicle-fixture';

const indicatorPreset = (id: 'frontLeftIndicator' | 'frontRightIndicator'): LightingPreset => ({
  id: 'indicator',
  name: 'Indicator',
  steps: [
    { type: 'set', elements: [id], state: 'on' },
    { type: 'wait', durationMs: 50 },
    { type: 'set', elements: [id], state: 'off' },
  ],
});

const left = indicatorPreset('frontLeftIndicator');
const right = indicatorPreset('frontRightIndicator');

test('identity mismatch blocks actuation and restore', async () => {
  const { session, sent, addressed } = fixture({ identities: { 0x40: [0, 1, 2], 0x72: [3, 4, 5] } });
  await session.connect('demo', '', 0);
  assert.equal(session.state.verified, false);
  assert.equal(session.state.vehicle, null);
  await session.playPreset(left); await session.restore();
  assert.deepEqual(addressed, ['40:22 F1 50', '72:22 F1 50']);
  assert.deepEqual(sent, ['22 F1 50', '22 F1 50']);
});

test('cleanup failure disables subsequent runs but still attempts default session', async () => {
  const { session, sent } = fixture({ reject: '2F 45 01 00 FE' });
  await session.connect('demo', '', 0); await session.restore();
  assert.equal(session.state.verified, false);
  assert.deepEqual(sent.slice(-2), ['2F 45 01 00 FE', '10 01']);
  const count = sent.length; await session.playPreset(left); assert.equal(sent.length, count);
});

test('stop during session entry prevents indicator-on and waits for restoration', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0);
  const play = session.playPreset(left); await session.stop(); await play;
  assert.deepEqual(sent, ['22 F1 50', '10 03', '2F 45 01 00 FE', '10 01']);
  assert.equal(session.state.busy, false);
});

test('disconnect during a run restores before closing and ignores duplicate runs', async () => {
  const { session, sent, isClosed } = fixture();
  await session.connect('demo', '', 0);
  const play = session.playPreset(left); await session.playPreset(right);
  await session.disconnect(); await play;
  assert.equal(isClosed(), true); assert.equal(session.state.connected, false);
  assert.equal(sent.some(s => s.includes('0E')), false);
  assert.deepEqual(sent.slice(-2), ['2F 45 01 00 FE', '10 01']);
});

test('invalid live endpoint never creates a socket', async () => {
  const session = new VehicleSession(() => {}, () => { throw new Error('Factory must not run'); });
  await session.connect('enet', '999.1.1.1', 6801);
  assert.match(session.state.error!, /valid IPv4/);
});

test('icar mode skips IPv4 validation and reaches the factory', async () => {
  let requested = '';
  const session = new VehicleSession(() => {}, mode => { requested = mode; throw new Error('stop'); });
  await session.connect('icar', '', 0);
  assert.equal(requested, 'icar');
  assert.doesNotMatch(session.state.error!, /IPv4/);
});

test('F32 is selected at 0x40 without probing 0x72', async () => {
  const { session, addressed } = fixture();
  await session.connect('demo', '', 0);
  assert.equal(session.state.vehicle?.id, 'f32');
  assert.deepEqual(addressed, ['40:22 F1 50']);
  assert.match(session.state.logs.join('\n'), /Identity read 0x40: 0F16B0/);
});

test('F10 is detected after CAS mismatch at 0x40 and the connection survives', async () => {
  const { session, addressed, isClosed } = fixture({ identities: { 0x40: CAS_IDENTITY, 0x72: FRM_IDENTITY } });
  await session.connect('demo', '', 0);
  assert.equal(session.state.vehicle?.id, 'f10');
  assert.equal(session.state.verified, true);
  assert.equal(session.state.identity, '0F10D0');
  assert.deepEqual(addressed, ['40:22 F1 50', '72:22 F1 50']);
  assert.equal(isClosed(), false);
  const log = session.state.logs.join('\n');
  assert.match(log, /Identity read 0x40: 0F0B01/);
  assert.match(log, /Identity read 0x72: 0F10D0/);
});

test('negative reply at 0x40 does not stop probing 0x72', async () => {
  const { session, isClosed } = fixture({ identities: { 0x72: FRM_IDENTITY } });
  await session.connect('demo', '', 0);
  assert.equal(session.state.vehicle?.id, 'f10');
  assert.equal(session.state.connected, true);
  assert.equal(isClosed(), false);
});

test('F10 run uses FRM3 bytes at 0x72 and cleans up with off then default session', async () => {
  const { session, addressed } = fixture({ identities: { 0x40: CAS_IDENTITY, 0x72: FRM_IDENTITY } });
  await session.connect('demo', '', 0);
  addressed.length = 0;
  await session.playPreset(right);
  assert.deepEqual(addressed, ['72:10 03', '72:2F 01 1D 03 64', '72:2F 01 1D 03 00', '72:2F 01 1D 03 00', '72:10 01']);
  assert.equal(session.state.error, null);
});

test('F10 rejected actuation still attempts the default session', async () => {
  const { session, sent } = fixture({ identities: { 0x72: FRM_IDENTITY }, reject: '2F 01 1C 03 64' });
  await session.connect('demo', '', 0); await session.playPreset(left);
  assert.deepEqual(sent.slice(-3), ['2F 01 1C 03 64', '2F 01 1C 03 00', '10 01']);
  assert.match(session.state.error!, /rejected/);
});

test('F10 restore sends only the default session', async () => {
  const { session, sent } = fixture({ identities: { 0x72: FRM_IDENTITY } });
  await session.connect('demo', '', 0); await session.restore();
  assert.deepEqual(sent.slice(2), ['10 01']);
});
