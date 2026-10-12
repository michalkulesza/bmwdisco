import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WireLink, SocketLike } from '../src/wire-link';
import { fromHex, hex } from '../src/protocol/bytes';
import { encodeHsfzControl, encodeHsfzDiagnostic } from '../src/protocol/hsfz';
import { encodeThorDiagnostic } from '../src/protocol/thor';

class FakeSocket extends EventEmitter implements SocketLike {
  writes: Uint8Array[] = []; closed = false;
  connect(_options: unknown, callback: () => void) { queueMicrotask(callback); }
  write(bytes: Uint8Array) { this.writes.push(bytes); }
  destroy() { this.closed = true; this.emit('close'); }
}
function fixture(mode: 'enet' | 'thor' = 'enet', responseMs = 100, totalMs = 200) {
  const socket = new FakeSocket(); const errors: Error[] = [];
  const link = new WireLink(mode, '127.0.0.1', 6801, () => {}, error => errors.push(error), () => socket, responseMs, totalMs);
  return { socket, link, errors };
}
const request = fromHex('22F150');
const identity = fromHex('62F1500F16B0');
const enetResponse = (payload: Uint8Array, source = 0x40) => encodeHsfzDiagnostic(payload, source, 0xf4);

test('HSFZ ACK, wrong source and wrong DID do not resolve a request; fragmented reply does', async () => {
  const { socket, link } = fixture(); await link.open();
  let settled = false; const reply = link.request(request, 0x40).then(bytes => { settled = true; return bytes; });
  socket.emit('data', encodeHsfzControl(2, fromHex('F440')));
  socket.emit('data', enetResponse(identity, 0x41));
  socket.emit('data', enetResponse(fromHex('62F151010203')));
  await Promise.resolve(); assert.equal(settled, false);
  const frame = enetResponse(identity);
  socket.emit('data', frame.slice(0, 5)); socket.emit('data', frame.slice(5));
  assert.deepEqual(await reply, identity); link.close();
});

test('alive request gets a type13 response, not a diagnostic completion', async () => {
  const { socket, link } = fixture(); await link.open();
  socket.emit('data', encodeHsfzControl(0x12));
  assert.equal(hex(socket.writes[0]), '00 00 00 02 00 13 00 F4'); link.close();
});

test('THOR request echo is ignored; response address direction accepted', async () => {
  const { socket, link } = fixture('thor'); await link.open();
  let settled = false; const reply = link.request(request, 0x40).then(bytes => { settled = true; return bytes; });
  socket.emit('data', socket.writes[0]); await Promise.resolve(); assert.equal(settled, false);
  socket.emit('data', encodeThorDiagnostic(identity, 0x40, 0xf1));
  assert.deepEqual(await reply, identity); link.close();
});

test('pending extends initial timeout; negative reply is surfaced without closing healthy socket', async () => {
  const { socket, link } = fixture('enet', 20, 150); await link.open();
  const reply = link.request(request, 0x40);
  socket.emit('data', enetResponse(fromHex('7F2278')));
  await new Promise(resolve => setTimeout(resolve, 35));
  socket.emit('data', enetResponse(identity)); assert.deepEqual(await reply, identity);
  const rejected = assert.rejects(link.request(request, 0x40), /NRC 0x31/);
  socket.emit('data', enetResponse(fromHex('7F2231'))); await rejected;
  assert.equal(socket.closed, false); link.close();
});

test('timeout invalidates connection and rejects reuse; late reply cannot resolve next request', async () => {
  const { socket, link, errors } = fixture('enet', 15, 30); await link.open();
  await assert.rejects(link.request(request, 0x40), /timed out/);
  assert.equal(socket.closed, true); assert.equal(errors.length, 1);
  socket.emit('data', enetResponse(identity));
  await assert.rejects(link.request(request, 0x40), /disconnected/);
});

test('repeated pending cannot extend total deadline; parallel diagnostic calls are rejected', async () => {
  const { socket, link } = fixture('enet', 20, 40); await link.open();
  const rejected = assert.rejects(link.request(request, 0x40), /timed out|deadline/);
  await assert.rejects(link.request(request, 0x40), /already in progress/);
  socket.emit('data', enetResponse(fromHex('7F2278')));
  const timer = setInterval(() => socket.emit('data', enetResponse(fromHex('7F2278'))), 5);
  try { await rejected; assert.equal(socket.closed, true); } finally { clearInterval(timer); link.close(); }
});

test('corrupt THOR checksum rejects pending operation and closes stream', async () => {
  const { socket, link } = fixture('thor'); await link.open();
  const rejected = assert.rejects(link.request(request, 0x40), /checksum/);
  const bytes = encodeThorDiagnostic(identity, 0x40, 0xf1); bytes[bytes.length - 1] ^= 1;
  socket.emit('data', bytes); await rejected; assert.equal(socket.closed, true);
});

test('reply source must match the addressed ECU for HSFZ and THOR', async () => {
  for (const mode of ['enet', 'thor'] as const) {
    const { socket, link } = fixture(mode); await link.open();
    let settled = false; const reply = link.request(request, 0x72).then(bytes => { settled = true; return bytes; });
    const frame = mode === 'enet' ? encodeHsfzDiagnostic(request, 0xf4, 0x72) : encodeThorDiagnostic(request, 0xf1, 0x72);
    assert.deepEqual(socket.writes[0], frame);
    socket.emit('data', mode === 'enet' ? enetResponse(identity, 0x40) : encodeThorDiagnostic(identity, 0x40, 0xf1));
    await Promise.resolve(); assert.equal(settled, false);
    socket.emit('data', mode === 'enet' ? enetResponse(identity, 0x72) : encodeThorDiagnostic(identity, 0x72, 0xf1));
    assert.deepEqual(await reply, identity); link.close();
  }
});

test('negative reply from one ECU leaves the link usable for the next address', async () => {
  const { socket, link } = fixture(); await link.open();
  const rejected = assert.rejects(link.request(request, 0x40), /NRC 0x31/);
  socket.emit('data', enetResponse(fromHex('7F2231'))); await rejected;
  const reply = link.request(request, 0x72);
  socket.emit('data', enetResponse(identity, 0x72));
  assert.deepEqual(await reply, identity); assert.equal(socket.closed, false); link.close();
});
