import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLE_ADAPTER_PROFILES, BleServiceInfo, IsoTpReceiver, chunkBytes, ecuCommands, encodeIsoTp, frameCommand,
  candidateLabel, isElmAdvert, normalizeUuid, sortByRssi, parseElmLine, selectProfile, stMinMs,
} from '../src/protocol/elm';
import { fromHex } from '../src/protocol/bytes';

const commands = (ecu: number, payload: string) => encodeIsoTp(ecu, fromHex(payload)).map(frameCommand);
const rx = (line: string, receiver: IsoTpReceiver) => {
  const parsed = parseElmLine(line);
  assert.equal(parsed.kind, 'frame');
  return parsed.kind === 'frame' ? receiver.push(parsed.id, parsed.data) : undefined;
};
const serial = (...uuids: string[]) => uuids.map(uuid => ({ uuid, writable: true, notifiable: true }));

test('profile table starts with the spec init list', () => {
  assert.deepEqual(BLE_ADAPTER_PROFILES[0].initCommands, ['ATZ', 'ATE0', 'ATS0', 'ATL0', 'ATH1', 'ATAL', 'ATCAF0',
    'ATPBE101', 'ATSPB', 'ATBI', 'ATAT2', 'ATFCSH6F1', 'ATSH6F1']);
  for (const profile of BLE_ADAPTER_PROFILES) assert.deepEqual(profile.initCommands, BLE_ADAPTER_PROFILES[0].initCommands);
});

test('per-ECU commands', () => {
  assert.deepEqual(ecuCommands(0x40), ['ATFCSD4030FF08', 'ATFCSM1', 'ATCRA640', 'ATCEA40']);
  assert.deepEqual(ecuCommands(0x72), ['ATFCSD7230FF08', 'ATFCSM1', 'ATCRA672', 'ATCEA72']);
  assert.throws(() => ecuCommands(256));
});

test('single frames are padded with 0xAA', () => {
  assert.deepEqual(commands(0x40, '22F150'), ['400322F150AAAAAA']);
  assert.deepEqual(commands(0x72, '1001'), ['72021001AAAAAAAA']);
  assert.deepEqual(commands(0x40, '000102030405'), ['4006000102030405']);
});

test('7-byte D542 write is first frame + one consecutive frame', () => {
  assert.deepEqual(commands(0x40, '2ED5420102FF03'), ['401007' + '2ED5420102', '4021FF03AAAAAAAA']);
});

test('consecutive frame sequence wraps after 0xF', () => {
  const frames = encodeIsoTp(0x40, new Uint8Array(5 + 6 * 16).fill(1));
  assert.equal(frames.length, 17);
  assert.equal(frames[15][1], 0x2f);
  assert.equal(frames[16][1], 0x20);
});

test('invalid lengths rejected', () => {
  assert.throws(() => encodeIsoTp(0x40, new Uint8Array()));
  assert.throws(() => encodeIsoTp(0x40, new Uint8Array(4096)));
});

test('line parser: frames, no data, errors, noise', () => {
  assert.deepEqual(parseElmLine('640F1037F2278AAAA'), { kind: 'frame', id: 0x640, data: fromHex('F1037F2278AAAA') });
  assert.deepEqual(parseElmLine(' 640F1 03 7F 22 78 AA AA\r'), { kind: 'frame', id: 0x640, data: fromHex('F1037F2278AAAA') });
  assert.equal(parseElmLine('NO DATA').kind, 'nodata');
  assert.equal(parseElmLine('no data').kind, 'nodata');
  for (const text of ['?', 'CAN ERROR', 'BUFFER FULL', 'BUS ERROR']) assert.equal(parseElmLine(text).kind, 'error');
  for (const text of ['', 'OK', 'ELM327 v1.5', 'STOPPED', '>']) assert.equal(parseElmLine(text).kind, 'other');
});

test('receiver: single frame', () => {
  const receiver = new IsoTpReceiver(0x40);
  assert.deepEqual(rx('640F1 03 62 F1 50 AA AA AA', receiver), { type: 'message', payload: fromHex('62F150') });
  assert.throws(() => rx('640F10962F150AAAAAA', receiver));
});

test('receiver: first + consecutive frames reassemble and truncate padding', () => {
  const receiver = new IsoTpReceiver(0x40);
  assert.equal(rx('640F1100862F150010203', receiver), undefined);
  assert.deepEqual(rx('640F121040506070809AA', receiver), { type: 'message', payload: fromHex('62F1500102030405') });
});

test('receiver: ignores other ECUs, wrong tester address, stray consecutive frames', () => {
  const receiver = new IsoTpReceiver(0x40);
  assert.equal(rx('672F10362F150AAAAAA', receiver), undefined);
  assert.equal(rx('640F20362F150AAAAAA', receiver)?.type, undefined);
  assert.equal(rx('640F12101020304050607', receiver), undefined);
  assert.equal(receiver.push(0x640, fromHex('3003')), undefined);
});

test('receiver: out-of-sequence consecutive frame throws and resets', () => {
  const receiver = new IsoTpReceiver(0x40);
  rx('640F1101462F150010203', receiver);
  assert.throws(() => rx('640F123040506070809', receiver), /sequence/);
  assert.equal(rx('640F121040506070809', receiver), undefined);
});

test('receiver: flow control frame', () => {
  const receiver = new IsoTpReceiver(0x40);
  assert.deepEqual(rx('640' + 'F130' + '0000' + 'AAAAAAAA', receiver), { type: 'flow', status: 0, blockSize: 0, stMin: 0 });
  assert.deepEqual(rx('640' + 'F130' + '0805' + 'AAAAAAAA', receiver), { type: 'flow', status: 0, blockSize: 8, stMin: 5 });
});

test('STmin conversion and chunking', () => {
  assert.deepEqual([0, 10, 0x7f, 0xf1, 0xf9, 0x80].map(stMinMs), [0, 10, 127, 0, 0, 127]);
  assert.deepEqual(chunkBytes(new Uint8Array(45)).map(chunk => chunk.length), [20, 20, 5]);
  assert.deepEqual(chunkBytes(new Uint8Array(45), 100).map(chunk => chunk.length), [45]);
});

test('uuid normalization of 16-bit base UUIDs', () => {
  assert.equal(normalizeUuid('000018F0-0000-1000-8000-00805F9B34FB'), '18f0');
  assert.equal(normalizeUuid('FFE0'), 'ffe0');
  assert.equal(normalizeUuid('BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F'), 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f');
});

test('advert matching by name hint or advertised service', () => {
  assert.equal(isElmAdvert({ id: '1', name: 'Vgate iCar Pro', rssi: null, serviceUUIDs: null }), true);
  assert.equal(isElmAdvert({ id: '1', name: 'IOS-Vlink', rssi: null, serviceUUIDs: null }), false);
  assert.equal(isElmAdvert({ id: '1', name: 'Veepeak', rssi: null, serviceUUIDs: null }), true);
  assert.equal(isElmAdvert({ id: '1', name: null, rssi: null, serviceUUIDs: ['0000FFF0-0000-1000-8000-00805F9B34FB'] }), true);
  assert.equal(isElmAdvert({ id: '1', name: null, rssi: null, serviceUUIDs: ['E7810A71-73AE-499D-8C15-FAA9AEF0C3F2'] }), true);
  assert.equal(isElmAdvert({ id: '1', name: 'Headphones', rssi: null, serviceUUIDs: ['180F'] }), false);
});

test('profile selection by exposed characteristics', () => {
  const vgate: BleServiceInfo[] = [{ uuid: '180a', characteristics: [] },
    { uuid: '18f0', characteristics: serial('BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F', '2AF0') }];
  assert.deepEqual(selectProfile(vgate), { profile: BLE_ADAPTER_PROFILES[0], serviceUuid: '18f0',
    writeUuid: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', notifyUuid: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' });

  const vgateFallback: BleServiceInfo[] = [{ uuid: '18f0', characteristics: [
    { uuid: 'BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F', writable: true, notifiable: false }, { uuid: '2AF0', writable: false, notifiable: true }] }];
  assert.equal(selectProfile(vgateFallback)?.notifyUuid, '2af0');

  const fff0 = selectProfile([{ uuid: 'fff0', characteristics: [
    { uuid: 'FFF1', writable: false, notifiable: true }, { uuid: 'FFF2', writable: true, notifiable: false }] }]);
  assert.equal(fff0?.profile.id, 'elm-fff0');
  assert.equal(fff0?.writeUuid, 'fff2');
  assert.equal(fff0?.notifyUuid, 'fff1');

  const ffe0 = selectProfile([{ uuid: 'ffe0', characteristics: serial('0000FFE1-0000-1000-8000-00805F9B34FB') }]);
  assert.equal(ffe0?.profile.id, 'elm-ffe0');
  assert.equal(ffe0?.writeUuid, 'ffe1');
});

test('profile selection rejects unusable peripherals', () => {
  assert.equal(selectProfile([]), undefined);
  assert.equal(selectProfile([{ uuid: 'fff0', characteristics: [{ uuid: 'fff1', writable: false, notifiable: true }] }]), undefined);
  assert.equal(selectProfile([{ uuid: 'ffe0', characteristics: [{ uuid: 'ffe1', writable: true, notifiable: false }] }]), undefined);
  assert.equal(selectProfile([{ uuid: '180f', characteristics: serial('2a19') }]), undefined);
});

test('picker labels and ordering', () => {
  const adverts = [{ id: 'a', name: null, rssi: null, serviceUUIDs: null }, { id: 'b', name: 'iCar', rssi: -70, serviceUUIDs: null },
    { id: 'c', name: '', rssi: -40, serviceUUIDs: null }];
  assert.deepEqual(sortByRssi(adverts).map(item => item.id), ['c', 'b', 'a']);
  assert.deepEqual(adverts.map(candidateLabel), ['Unnamed · ? dBm', 'iCar · -70 dBm', 'Unnamed · -40 dBm']);
});
