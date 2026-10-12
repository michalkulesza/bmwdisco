import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleSession } from '../src/session';
import { CAS_IDENTITY, FEM_IDENTITY, FRM_IDENTITY, fixture } from './vehicle-fixture';

test('identity mismatch blocks actuation and restore', async () => {
  const { session, sent, addressed } = fixture({ identities: { 0x40: [0, 1, 2], 0x72: [3, 4, 5] } });
  await session.connect('demo', '', 0);
  assert.equal(session.state.verified, false);
  assert.equal(session.state.vehicle, null);
  await session.pulse('left'); await session.restore();
  assert.deepEqual(addressed, ['40:22 F1 50', '72:22 F1 50']);
  assert.deepEqual(sent, ['22 F1 50', '22 F1 50']);
});

test('one-second test restores ECU control in order', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0); await session.pulse('right');
  assert.deepEqual(sent, ['22 F1 50', '10 03', '2F 45 01 03 0E 01', '2F 45 01 03 0E 00', '2F 45 01 00 FE', '10 01']);
  assert.equal(session.state.busy, false);
  assert.equal(session.state.error, null);
});

test('rejected actuation still attempts both cleanup requests', async () => {
  const { session, sent } = fixture({ reject: '2F 45 01 03 0D 01' });
  await session.connect('demo', '', 0); await session.pulse('left');
  assert.deepEqual(sent.slice(-2), ['2F 45 01 00 FE', '10 01']);
  assert.match(session.state.error!, /rejected/);
});

test('cleanup failure disables subsequent tests but still attempts default session', async () => {
  const { session, sent } = fixture({ reject: '2F 45 01 00 FE' });
  await session.connect('demo', '', 0); await session.restore();
  assert.equal(session.state.verified, false);
  assert.deepEqual(sent.slice(-2), ['2F 45 01 00 FE', '10 01']);
  const count = sent.length; await session.pulse('left'); assert.equal(sent.length, count);
});

test('stop during session entry prevents indicator-on and waits for restoration', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0);
  const pulse = session.pulse('left'); await session.stop(); await pulse;
  assert.deepEqual(sent, ['22 F1 50', '10 03', '2F 45 01 00 FE', '10 01']);
  assert.equal(session.state.busy, false);
});

test('disconnect during a pulse restores before closing and ignores duplicate tests', async () => {
  const { session, sent, isClosed } = fixture();
  await session.connect('demo', '', 0);
  const pulse = session.pulse('left'); await session.pulse('right');
  await session.disconnect(); await pulse;
  assert.equal(isClosed(), true); assert.equal(session.state.connected, false);
  assert.equal(sent.some(s => s.includes('0E')), false);
  assert.deepEqual(sent.slice(-2), ['2F 45 01 00 FE', '10 01']);
});

test('invalid live endpoint never creates a socket', async () => {
  const session = new VehicleSession(() => {}, () => { throw new Error('Factory must not run'); });
  await session.connect('enet', '999.1.1.1', 6801);
  assert.match(session.state.error!, /valid IPv4/);
});

test('stop interrupts the pulse wait and sends off before return-control', async () => {
  const { session, sent } = fixture();
  await session.connect('demo', '', 0);
  const pulse = session.pulse('left');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(sent.at(-1), '2F 45 01 03 0D 01');
  const started = Date.now(); await session.stop(); await pulse;
  assert.ok(Date.now() - started < 500);
  assert.deepEqual(sent.slice(-3), ['2F 45 01 03 0D 00', '2F 45 01 00 FE', '10 01']);
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

test('F10 pulse uses FRM3 bytes at 0x72 and cleans up with off then default session', async () => {
  const { session, addressed } = fixture({ identities: { 0x40: CAS_IDENTITY, 0x72: FRM_IDENTITY } });
  await session.connect('demo', '', 0);
  addressed.length = 0;
  await session.pulse('right');
  assert.deepEqual(addressed, ['72:10 03', '72:2F 01 1D 03 64', '72:2F 01 1D 03 00', '72:10 01']);
  assert.equal(session.state.error, null);
});

test('F10 rejected actuation still attempts the default session', async () => {
  const { session, sent } = fixture({ identities: { 0x72: FRM_IDENTITY }, reject: '2F 01 1C 03 64' });
  await session.connect('demo', '', 0); await session.pulse('left');
  assert.deepEqual(sent.slice(-2), ['2F 01 1C 03 64', '10 01']);
  assert.match(session.state.error!, /rejected/);
});

test('F10 restore sends only the default session', async () => {
  const { session, sent } = fixture({ identities: { 0x72: FRM_IDENTITY } });
  await session.connect('demo', '', 0); await session.restore();
  assert.deepEqual(sent.slice(2), ['10 01']);
});
