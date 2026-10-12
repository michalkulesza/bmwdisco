import test from 'node:test';
import assert from 'node:assert/strict';
import { VehicleSession } from '../src/session';
import { DiagnosticLink, LinkFactory, hex } from '../src/link';

function fixture(options: { identity?: number[]; reject?: string } = {}) {
  const sent: string[] = [];
  let closed = false;
  const link: DiagnosticLink = {
    async open() { closed = false; }, close() { closed = true; },
    async request(payload) {
      assert.equal(closed, false);
      const command = hex(payload); sent.push(command);
      if (command === options.reject) throw new Error('ECU rejected request');
      if (payload[0] === 0x22) return Uint8Array.from([0x62, 0xf1, 0x50, ...(options.identity ?? [0x0f, 0x16, 0xb0])]);
      return Uint8Array.from([payload[0] + 0x40, ...payload.slice(1)]);
    },
  };
  const factory: LinkFactory = () => link;
  return { session: new VehicleSession(() => {}, factory), sent, isClosed: () => closed };
}

test('identity mismatch blocks actuation and restore', async () => {
  const { session, sent } = fixture({ identity: [0, 1, 2] });
  await session.connect('demo', '', 0);
  assert.equal(session.state.verified, false);
  await session.pulse('left'); await session.restore();
  assert.deepEqual(sent, ['22 F1 50']);
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
