import test from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionCancelledError } from '../src/link';
import { BleTransport, ElmBleDeps, ElmBleLink } from '../src/elm-ble-link';
import { BLE_ADAPTER_PROFILES, BleAdvert, BleSelection, BleServiceInfo, RememberedDevice } from '../src/protocol/elm';
import { fromHex } from '../src/protocol/bytes';

const INIT = [...BLE_ADAPTER_PROFILES[0].initCommands];
const VGATE_SERVICES: BleServiceInfo[] = [{ uuid: '18f0', characteristics: [
  { uuid: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', writable: true, notifiable: true }, { uuid: '2af0', writable: false, notifiable: true }] }];
const ICAR: BleAdvert = { id: 'AA-BB', name: 'Vgate iCar', rssi: -60, serviceUUIDs: null };
const can = (ecu: number, data: string) => `6${ecu.toString(16).padStart(2, '0').toUpperCase()}F1${data}`.padEnd(19, 'A');

type Script = (command: string) => string[] | undefined;

class FakeTransport implements BleTransport {
  writeSize = 20;
  adverts: BleAdvert[] = [ICAR];
  services = VGATE_SERVICES;
  selection?: BleSelection;
  commands: string[] = [];
  connects: { id: string; timeoutMs?: number }[] = [];
  failConnect = new Set<string>();
  writeSizes: number[] = [];
  scanStopped = false;
  closed = false;
  private onData?: (bytes: Uint8Array) => void;
  private onClosed?: (error: Error) => void;
  private pendingText = '';
  private monitoring = false;
  constructor(public script: Script) {}

  scan(onDevice: (advert: BleAdvert) => void) {
    queueMicrotask(() => this.adverts.forEach(onDevice));
    return () => { this.scanStopped = true; };
  }
  async connect(id: string, onClosed: (error: Error) => void, timeoutMs?: number) {
    this.connects.push({ id, timeoutMs });
    if (this.failConnect.has(id)) throw new Error('connect failed');
    this.onClosed = onClosed;
    return this.services;
  }
  async attach(selection: BleSelection, onData: (bytes: Uint8Array) => void) { this.selection = selection; this.onData = onData; }
  async write(bytes: Uint8Array) {
    this.writeSizes.push(bytes.length);
    this.pendingText += String.fromCharCode(...bytes);
    let end: number;
    while ((end = this.pendingText.indexOf('\r')) >= 0) {
      const command = this.pendingText.slice(0, end);
      this.pendingText = this.pendingText.slice(end + 1);
      this.handle(command);
    }
  }
  close() { this.closed = true; }
  drop() { this.onClosed?.(new Error('link dropped')); }

  private emit(text: string) {
    const bytes = Uint8Array.from(text, char => char.charCodeAt(0));
    const mid = Math.floor(bytes.length / 2);
    queueMicrotask(() => { this.onData?.(bytes.slice(0, mid)); this.onData?.(bytes.slice(mid)); });
  }
  private handle(command: string) {
    if (command === '' && this.monitoring) { this.monitoring = false; this.emit('\r>'); return; }
    this.commands.push(command);
    const lines = this.script(command);
    if (!lines) return;
    if (command === 'ATMA') { this.monitoring = true; this.emit(lines.map(line => `${line}\r`).join('')); return; }
    this.emit(`${lines.map(line => `${line}\r`).join('')}\r>`);
  }
}

const timings = { responseMs: 200, totalMs: 600, settleMs: 0, scanMs: 30, rememberedMs: 5000, monitorMs: 20 };
function fixture(script: Script, overrides: Partial<ElmBleDeps> = {}) {
  const transport = new FakeTransport(script); const errors: Error[] = []; const logs: string[] = [];
  const offered: BleAdvert[][] = []; const saved: RememberedDevice[] = [];
  const deps: ElmBleDeps = {
    chooseDevice: async candidates => { offered.push(candidates); return candidates[0]?.id ?? null; },
    getRemembered: async () => null,
    remember: async device => { saved.push(device); },
    ...overrides,
  };
  const link = new ElmBleLink(message => logs.push(message), error => errors.push(error), transport, deps, timings);
  return { transport, link, errors, logs, offered, saved };
}
const ok: Script = command => command === 'ATZ' ? ['ELM327 v2.1'] : command.startsWith('AT') ? ['OK'] : undefined;
const identity = fromHex('62F1500F16B0');
const request = fromHex('22F150');
const identityScript: Script = command => command === '400322F150AAAAAA' ? [can(0x40, '0662F1500F16B0')] : ok(command);

test('open scans, offers the iCar, selects the vgate profile and runs the init list in order', async () => {
  const { transport, link, logs } = fixture(ok);
  await link.open();
  assert.deepEqual(transport.commands, INIT);
  assert.equal(transport.scanStopped, true);
  assert.equal(transport.selection?.profile.id, 'vgate-icar');
  assert.ok(logs.some(line => line.includes('BLE profile vgate-icar')));
  link.close(); assert.equal(transport.closed, true);
});

test('picker lists matching peripherals strongest first, merging repeated sightings', async () => {
  const { transport, link, offered } = fixture(ok);
  transport.adverts = [{ id: 'a', name: 'Vgate iCar', rssi: -80, serviceUUIDs: null }, { id: 'b', name: 'Veepeak', rssi: -50, serviceUUIDs: null },
    { id: 'x', name: 'Headphones', rssi: -30, serviceUUIDs: ['180F'] }, { id: 'a', name: null, rssi: -70, serviceUUIDs: ['18F0'] }];
  await link.open();
  assert.deepEqual(offered[0].map(item => [item.id, item.name, item.rssi]), [['b', 'Veepeak', -50], ['a', 'Vgate iCar', -70]]);
  assert.equal(transport.connects[0].id, 'b');
  link.close();
});

test('cancelling the picker aborts with ConnectionCancelledError and never connects or persists', async () => {
  const { transport, link, saved } = fixture(ok, { chooseDevice: async () => null });
  await assert.rejects(link.open(), (error: Error) => error instanceof ConnectionCancelledError && /Connection cancelled/.test(error.message));
  assert.equal(transport.connects.length, 0); assert.equal(saved.length, 0); assert.equal(transport.closed, true);
});

test('remembered device connects directly with a short timeout and skips scan and picker', async () => {
  const { transport, link, offered } = fixture(ok, { getRemembered: async () => ({ id: 'mem', name: 'Car' }) });
  await link.open();
  assert.deepEqual(transport.connects, [{ id: 'mem', timeoutMs: 5000 }]);
  assert.equal(offered.length, 0);
  link.close();
});

test('unreachable remembered device falls back to scan and picker', async () => {
  const { transport, link, offered, saved } = fixture(ok, { getRemembered: async () => ({ id: 'mem', name: 'Car' }) });
  transport.failConnect.add('mem');
  await link.open();
  assert.equal(offered.length, 1);
  assert.deepEqual(transport.connects.map(item => item.id), ['mem', 'AA-BB']);
  assert.deepEqual(saved, [{ id: 'AA-BB', name: 'Vgate iCar' }]);
  link.close();
});

test('device is persisted only after the ELM handshake succeeds', async () => {
  const good = fixture(ok);
  await good.link.open();
  assert.deepEqual(good.saved, [{ id: 'AA-BB', name: 'Vgate iCar' }]);
  good.link.close();

  const unsupported = fixture(command => command === 'ATPBE101' ? ['?'] : ok(command));
  await assert.rejects(unsupported.link.open());
  assert.equal(unsupported.saved.length, 0);
});

test('a persistence failure does not fail the connection', async () => {
  const { link, logs } = fixture(ok, { remember: async () => { throw new Error('disk'); } });
  await link.open();
  assert.ok(logs.some(line => line.includes('Could not remember device: disk')));
  link.close();
});

test('non-ELM device is rejected after ATZ before any other command and is not persisted', async () => {
  const { transport, link, saved } = fixture(command => command === 'ATZ' ? ['HELLO'] : ok(command));
  await assert.rejects(link.open(), /not an ELM327 adapter/);
  assert.deepEqual(transport.commands, ['ATZ']);
  assert.equal(saved.length, 0); assert.equal(transport.closed, true);
});

test('a device that stays silent after ATZ is rejected as not an ELM327', async () => {
  const { link, saved } = fixture(command => command === 'ATZ' ? undefined : ok(command));
  await assert.rejects(link.open(), /not an ELM327 adapter/);
  assert.equal(saved.length, 0);
});

test('ELM banner check is case-insensitive', async () => {
  const { link } = fixture(command => command === 'ATZ' ? ['elm327 v1.5'] : ok(command));
  await link.open(); link.close();
});

test('scan skips unrelated peripherals', async () => {
  const { transport, link } = fixture(ok);
  transport.adverts = [{ id: 'x', name: 'Headphones', rssi: -40, serviceUUIDs: ['180F'] }, { id: 'y', name: null, rssi: -60, serviceUUIDs: ['FFE0'] }];
  transport.services = [{ uuid: 'ffe0', characteristics: [{ uuid: 'ffe1', writable: true, notifiable: true }] }];
  await link.open();
  assert.equal(transport.selection?.profile.id, 'elm-ffe0');
  link.close();
});

test('open fails when no adapter is advertised', async () => {
  const { transport, link } = fixture(ok);
  transport.adverts = [{ id: 'x', name: 'Headphones', rssi: null, serviceUUIDs: null }];
  await assert.rejects(link.open(), /No Bluetooth ELM327 adapter found/);
  assert.equal(transport.scanStopped, true);
});

test('open fails when the peripheral exposes no known serial profile', async () => {
  const { transport, link } = fixture(ok);
  transport.services = [{ uuid: '180f', characteristics: [] }];
  await assert.rejects(link.open(), /no known ELM327 serial characteristic/);
  assert.equal(transport.closed, true);
});

test('an init command answered with ? fails open and names the command', async () => {
  const { link } = fixture(command => command === 'ATPBE101' ? ['?'] : ok(command));
  await assert.rejects(link.open(), /rejected ATPBE101.*may not be supported/);
});

test('single-frame request addresses the ECU once, then switches only on change', async () => {
  const { transport, link } = fixture(command => command === '400322F150AAAAAA' ? [can(0x40, '0662F1500F16B0')]
    : command === '720322F150AAAAAA' ? [can(0x72, '0662F1500F10D0')] : ok(command));
  await link.open();
  transport.commands.length = 0;

  assert.deepEqual(await link.request(request, 0x40), identity);
  assert.deepEqual(await link.request(request, 0x40), identity);
  assert.deepEqual(transport.commands, ['ATFCSD4030FF08', 'ATFCSM1', 'ATCRA640', 'ATCEA40', '400322F150AAAAAA', '400322F150AAAAAA']);

  transport.commands.length = 0;
  assert.deepEqual(await link.request(request, 0x72), fromHex('62F1500F10D0'));
  assert.deepEqual(transport.commands, ['ATFCSD7230FF08', 'ATFCSM1', 'ATCRA672', 'ATCEA72', '720322F150AAAAAA']);
  link.close();
});

test('all writes respect the BLE chunk size', async () => {
  const { transport, link } = fixture(identityScript);
  await link.open(); await link.request(request, 0x40);
  assert.ok(transport.writeSizes.every(size => size <= 20));
  assert.ok(transport.writeSizes.some(size => size > 0));
  link.close();
});

test('7-byte write sends FF, waits for flow control, then the consecutive frame', async () => {
  const { transport, link } = fixture(command => {
    if (command === '4010072ED5420102') return [can(0x40, '300000')];
    if (command === '4021FF03AAAAAAAA') return [can(0x40, '036ED542')];
    return ok(command);
  });
  await link.open();
  transport.commands.length = 0;
  assert.deepEqual(await link.request(fromHex('2ED5420102FF03'), 0x40), fromHex('6ED542'));
  assert.deepEqual(transport.commands.slice(-2), ['4010072ED5420102', '4021FF03AAAAAAAA']);
  link.close();
});

test('missing flow control fails the link', async () => {
  const { link, errors } = fixture(command => command === '4010072ED5420102' ? ['NO DATA'] : ok(command));
  await link.open();
  await assert.rejects(link.request(fromHex('2ED5420102FF03'), 0x40), /no ISO-TP flow control/);
  assert.equal(errors.length, 1);
});

test('multi-frame response is reassembled from ELM output lines', async () => {
  const { link } = fixture(command => command === '400322F150AAAAAA'
    ? [can(0x40, '100862F1500F16'), can(0x40, '21B0010203')] : ok(command));
  await link.open();
  assert.deepEqual(await link.request(request, 0x40), fromHex('62F1500F16B00102'));
  link.close();
});

test('NO DATA and unrelated frames are ignored while the real reply arrives', async () => {
  const { link } = fixture(command => command === '400322F150AAAAAA'
    ? ['NO DATA', can(0x40, '0362F151'), can(0x40, '0662F1500F16B0')] : ok(command));
  await link.open();
  assert.deepEqual(await link.request(request, 0x40), identity);
  link.close();
});

test('response-pending 0x78 keeps listening with ATMA until the final reply', async () => {
  let monitored = 0;
  const { transport, link } = fixture(command => {
    if (command === '400322F150AAAAAA') return [can(0x40, '037F2278')];
    if (command === 'ATMA') return monitored++ === 0 ? ['NO DATA'] : [can(0x40, '0662F1500F16B0')];
    return ok(command);
  });
  await link.open();
  assert.deepEqual(await link.request(request, 0x40), identity);
  assert.ok(transport.commands.includes('ATMA'));
  link.close();
});

test('pending deadline fails the link', async () => {
  const { link, errors } = fixture(command => command === '400322F150AAAAAA' ? [can(0x40, '037F2278')]
    : command === 'ATMA' ? ['NO DATA'] : ok(command));
  await link.open();
  await assert.rejects(link.request(request, 0x40), /deadline exceeded/);
  assert.equal(errors.length, 1);
});

test('negative reply is surfaced without closing the link', async () => {
  const { transport, link, errors } = fixture(command => command === '400322F150AAAAAA' ? [can(0x40, '037F2231')] : ok(command));
  await link.open();
  await assert.rejects(link.request(request, 0x40), /NRC 0x31/);
  assert.equal(errors.length, 0); assert.equal(transport.closed, false);
  link.close();
});

test('silence from the ECU times out and invalidates the link', async () => {
  const { transport, link, errors } = fixture(command => command === '400322F150AAAAAA' ? ['NO DATA'] : ok(command));
  await link.open();
  await assert.rejects(link.request(request, 0x40), /timed out/);
  assert.equal(errors.length, 1); assert.equal(transport.closed, true);
  await assert.rejects(link.request(request, 0x40), /disconnected/);
});

test('adapter silence times out', async () => {
  const { link, errors } = fixture(command => command === '400322F150AAAAAA' ? undefined : ok(command));
  await link.open();
  await assert.rejects(link.request(request, 0x40), /did not answer/);
  assert.equal(errors.length, 1);
});

test('CAN ERROR fails the link', async () => {
  const { link, errors } = fixture(command => command === '400322F150AAAAAA' ? ['CAN ERROR'] : ok(command));
  await link.open();
  await assert.rejects(link.request(request, 0x40), /CAN ERROR/);
  assert.equal(errors.length, 1);
});

test('only one request may be in flight', async () => {
  const { link } = fixture(identityScript);
  await link.open();
  const first = link.request(request, 0x40);
  await assert.rejects(link.request(request, 0x40), /already in progress/);
  await first; link.close();
});

test('Bluetooth drop invalidates the link and reports loss', async () => {
  const { transport, link, errors } = fixture(ok);
  await link.open();
  transport.drop();
  assert.equal(errors.length, 1);
  await assert.rejects(link.request(request, 0x40), /disconnected/);
});

test('a link cannot be reopened', async () => {
  const { link } = fixture(ok);
  await link.open(); link.close();
  await assert.rejects(link.open(), /new connection/);
});
