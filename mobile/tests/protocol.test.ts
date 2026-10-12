import test from 'node:test';
import assert from 'node:assert/strict';
import { additiveChecksum, equalBytes, fromHex, hex } from '../src/protocol/bytes';
import { encodeHsfzControl, encodeHsfzDiagnostic, HsfzParser, HSFZ_MAX_BODY } from '../src/protocol/hsfz';
import { encodeThorDiagnostic, ThorParser, THOR_MAX_PAYLOAD } from '../src/protocol/thor';
import { FEM_PROFILE, femDefaultSession, femExtendedSession, femIdentify, femIndicator,
  femReturnControl, isFemIdentity } from '../src/protocol/fem';
import { matchUdsResponse } from '../src/protocol/uds';

const bytes = fromHex;
const join = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap(part => Array.from(part)));
const leftOn = bytes('2F4501030D01');
const hsfzFixture = bytes('000000080001F4402F4501030D01');
const thorFixture = bytes('8640F12F4501030D013D');

test('hex helpers reject malformed text and preserve zero bytes', () => {
  assert.equal(hex(bytes('00 fF\n12')), '00 FF 12');
  for (const input of ['0', '0x01', 'GG', '01:02', '012']) assert.throws(() => bytes(input));
  assert.equal(equalBytes(bytes('00'), bytes('0000')), false);
  assert.equal(additiveChecksum(bytes('FFFF02')), 0);
});

test('recovered FEM front indicator allowlist and exact identity gate', () => {
  assert.equal(FEM_PROFILE.name, 'FEM_20');
  assert.equal(FEM_PROFILE.destination, 0x40);
  assert.equal(hex(FEM_PROFILE.identity), '0F 16 B0');
  assert.equal(hex(femIdentify()), '22 F1 50');
  assert.equal(hex(femExtendedSession()), '10 03');
  assert.equal(hex(femDefaultSession()), '10 01');
  assert.equal(hex(femReturnControl()), '2F 45 01 00 FE');
  assert.deepEqual(femIndicator('left', true), leftOn);
  assert.equal(hex(femIndicator('left', false)), '2F 45 01 03 0D 00');
  assert.equal(hex(femIndicator('right', true)), '2F 45 01 03 0E 01');
  assert.equal(hex(femIndicator('right', false)), '2F 45 01 03 0E 00');
  assert.throws(() => femIndicator('rear' as 'left', true));
  assert.throws(() => femIndicator('left', 1 as unknown as boolean));
  assert.equal(isFemIdentity(bytes('62F1500F16B0')), true);
  for (const response of ['62F1500F16B1', '62F1500F16', '62F1510F16B0', '62F1500F16B000', '7F2231']) {
    assert.equal(isFemIdentity(bytes(response)), false);
  }
  const mutated = FEM_PROFILE.identity;
  mutated[0] = 0;
  assert.equal(hex(FEM_PROFILE.identity), '0F 16 B0');
});

test('HSFZ encoder matches independent static packet fixture', () => {
  assert.deepEqual(encodeHsfzDiagnostic(leftOn), hsfzFixture);
  assert.deepEqual(encodeHsfzControl(0x13, bytes('00F4')), bytes('00000002001300F4'));
  assert.throws(() => encodeHsfzDiagnostic(new Uint8Array()));
  assert.throws(() => encodeHsfzDiagnostic(leftOn, 256));
  assert.throws(() => encodeHsfzDiagnostic(leftOn, 0xf4, -1));
  assert.throws(() => encodeHsfzControl(0x10000));
  assert.throws(() => encodeHsfzControl(0x11, new Uint8Array(HSFZ_MAX_BODY + 1)));
});

test('HSFZ survives every split point and coalesced frames', () => {
  for (let split = 1; split < hsfzFixture.length; split++) {
    const parser = new HsfzParser();
    assert.deepEqual(parser.push(hsfzFixture.subarray(0, split)), []);
    const packets = parser.push(hsfzFixture.subarray(split));
    assert.equal(packets.length, 1);
    assert.equal(packets[0].source, 0xf4);
    assert.equal(packets[0].destination, 0x40);
    assert.deepEqual(packets[0].payload, leftOn);
  }
  const stream = join(bytes('000000020002F440'), bytes('000000000012'), hsfzFixture, hsfzFixture);
  const parser = new HsfzParser();
  const packets = parser.push(stream);
  assert.deepEqual(packets.map(p => p.type), [2, 0x12, 1, 1]);
  assert.deepEqual(packets[0].body, bytes('F440'));
  assert.deepEqual(packets[0].payload, new Uint8Array());
  assert.equal(packets[1].source, undefined);
  assert.deepEqual(parser.push(new Uint8Array()), []);
});

test('HSFZ preserves control bodies and foreign addresses for client filtering', () => {
  const packets = new HsfzParser().push(bytes('000000020012001000000003000144F450000000020040F1F4'));
  assert.equal(packets[0].type, 0x12);
  assert.deepEqual(packets[0].body, bytes('0010'));
  assert.equal(packets[1].source, 0x44);
  assert.equal(packets[1].destination, 0xf4);
  assert.equal(packets[2].type, 0x40);
  assert.deepEqual(packets[2].payload, bytes('F1F4'));
});

test('HSFZ rejects hostile lengths before allocating bodies and resets after error', () => {
  for (const bad of ['FFFFFFFF0001', '000010010011', '000000020001', '000000010002', '000000010012']) {
    const parser = new HsfzParser();
    assert.throws(() => parser.push(bytes(bad)));
    assert.equal(parser.push(hsfzFixture).length, 1);
  }
  const parser = new HsfzParser();
  parser.push(hsfzFixture.subarray(0, 9));
  parser.reset();
  assert.equal(parser.push(hsfzFixture).length, 1);
});

test('THOR binary encoder matches independent additive checksum fixture', () => {
  assert.deepEqual(encodeThorDiagnostic(leftOn), thorFixture);
  assert.equal(hex(encodeThorDiagnostic(bytes('22F150'))), '83 40 F1 22 F1 50 17');
  assert.throws(() => encodeThorDiagnostic(new Uint8Array()));
  assert.throws(() => encodeThorDiagnostic(new Uint8Array(THOR_MAX_PAYLOAD + 1)));
  assert.throws(() => encodeThorDiagnostic(leftOn, NaN));
});

test('THOR survives every split, bytewise receive, coalescing and short two-byte payload', () => {
  for (let split = 1; split < thorFixture.length; split++) {
    const parser = new ThorParser();
    assert.deepEqual(parser.push(thorFixture.subarray(0, split)), []);
    const packets = parser.push(thorFixture.subarray(split));
    assert.equal(packets.length, 1);
    assert.deepEqual(packets[0], { source: 0xf1, destination: 0x40, payload: leftOn });
  }
  const parser = new ThorParser();
  const packets = Array.from(thorFixture).flatMap(value => parser.push(Uint8Array.of(value)));
  assert.equal(packets.length, 1);
  assert.deepEqual(parser.push(bytes('82F140500306'))[0], { destination: 0xf1, source: 0x40, payload: bytes('5003') });
  assert.equal(parser.push(join(thorFixture, thorFixture)).length, 2);
});

test('THOR extended one-byte and two-byte lengths use exact independent fixtures', () => {
  const extended64 = join(bytes('8040F140'), new Uint8Array(64).fill(0xaa), bytes('71'));
  const extended256 = join(bytes('8040F1000100'), new Uint8Array(256), bytes('B2'));
  assert.deepEqual(encodeThorDiagnostic(new Uint8Array(64).fill(0xaa)), extended64);
  assert.deepEqual(encodeThorDiagnostic(new Uint8Array(256)), extended256);
  for (const fixture of [extended64, extended256]) {
    for (let split = 1; split < fixture.length; split++) {
      const parser = new ThorParser();
      parser.push(fixture.subarray(0, split));
      assert.equal(parser.push(fixture.subarray(split))[0].payload.length, fixture === extended64 ? 64 : 256);
    }
  }
});

test('THOR rejects malformed format, zero/oversize lengths and checksum corruption', () => {
  for (const bad of ['0040F1', 'C340F1', '8040F1000000', '8040F1001001', '8640F12F4501030D013C']) {
    const parser = new ThorParser();
    assert.throws(() => parser.push(bytes(bad)));
    assert.equal(parser.push(thorFixture).length, 1);
  }
  const parser = new ThorParser();
  parser.push(thorFixture.subarray(0, 6));
  parser.reset();
  assert.equal(parser.push(thorFixture).length, 1);
});

test('UDS matching verifies session, DID and control parameter; status record is opaque', () => {
  const match = (req: string, res: string) => matchUdsResponse(bytes(req), bytes(res)).kind;
  assert.equal(match('22F150', '62F1500F16B0'), 'positive');
  assert.equal(match('22F150', '62F1510F16B0'), 'unrelated');
  assert.equal(match('1003', '5003003201F4'), 'positive');
  assert.equal(match('1003', '5001'), 'unrelated');
  assert.equal(match('2F4501030D01', '6F4501030D01'), 'positive');
  assert.equal(match('2F4501030D01', '6F4501030E01'), 'positive');
  assert.equal(match('2F4501030D01', '6F450103'), 'positive');
  assert.equal(match('2F4501030D01', '6F4502030D01'), 'unrelated');
  assert.equal(match('2F4501030D01', '6F4501000D01'), 'unrelated');
  assert.equal(match('2F450100FE', '6F450100'), 'positive');
  for (const [req, res] of [['', ''], ['22F150', '62'], ['22F150', '62F150'], ['1003', '50'], ['1101', '5101']]) {
    assert.equal(match(req, res), 'unrelated');
  }
});

test('UDS negative and pending responses must name active request service', () => {
  assert.deepEqual(matchUdsResponse(leftOn, bytes('7F2F78')), { kind: 'pending', code: 0x78 });
  assert.deepEqual(matchUdsResponse(leftOn, bytes('7F2F31')), { kind: 'negative', code: 0x31 });
  for (const response of ['7F2278', '7F2231', '7F2F', '7F2F7800']) {
    assert.deepEqual(matchUdsResponse(leftOn, bytes(response)), { kind: 'unrelated' });
  }
});
