import { byte } from './bytes';

const ELM_INIT_COMMANDS = ['ATZ', 'ATE0', 'ATS0', 'ATL0', 'ATH1', 'ATAL', 'ATCAF0', 'ATPBE101', 'ATSPB', 'ATBI',
  'ATAT2', 'ATFCSH6F1', 'ATSH6F1'] as const;

export interface BleAdapterProfile {
  id: string; label: string; nameHints: readonly string[]; serviceUUIDs: readonly string[];
  writeUUIDs: readonly string[]; notifyUUIDs: readonly string[]; initCommands: readonly string[];
}

const VGATE_SERIAL = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';
export const BLE_ADAPTER_PROFILES: readonly BleAdapterProfile[] = [
  { id: 'vgate-icar', label: 'Vgate iCar', nameHints: ['icar', 'vgate'],
    serviceUUIDs: ['18f0', 'ffe0', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', VGATE_SERIAL],
    writeUUIDs: [VGATE_SERIAL], notifyUUIDs: [VGATE_SERIAL, '2af0'], initCommands: ELM_INIT_COMMANDS },
  { id: 'elm-fff0', label: 'BLE ELM327 (FFF0)', nameHints: ['veepeak', 'konnwei', 'elm327'],
    serviceUUIDs: ['fff0'], writeUUIDs: ['fff2'], notifyUUIDs: ['fff1'], initCommands: ELM_INIT_COMMANDS },
  { id: 'elm-ffe0', label: 'BLE ELM327 (FFE0)', nameHints: ['obdii', 'obd2', 'elm327'],
    serviceUUIDs: ['ffe0'], writeUUIDs: ['ffe1'], notifyUUIDs: ['ffe1'], initCommands: ELM_INIT_COMMANDS },
];
export const ELM_MONITOR = 'ATMA';
export const BLE_WRITE_CHUNK = 20;
export const ISOTP_MAX_PAYLOAD = 4095;

const TESTER = 0xf1;
const PADDING = 0xaa;
const SF_MAX = 6;
const FF_DATA = 5;
const CF_DATA = 6;

export function normalizeUuid(uuid: string): string {
  const lower = uuid.toLowerCase();
  return /^0000[0-9a-f]{4}-0000-1000-8000-00805f9b34fb$/.test(lower) ? lower.slice(4, 8) : lower;
}

export interface BleAdvert { id: string; name: string | null; rssi: number | null; serviceUUIDs: string[] | null }
export interface RememberedDevice { id: string; name: string | null }
export interface BleCharacteristicInfo { uuid: string; writable: boolean; notifiable: boolean }
export interface BleServiceInfo { uuid: string; characteristics: BleCharacteristicInfo[] }
export interface BleSelection { profile: BleAdapterProfile; serviceUuid: string; writeUuid: string; notifyUuid: string }

export function isElmAdvert(advert: BleAdvert, profiles = BLE_ADAPTER_PROFILES): boolean {
  const name = (advert.name ?? '').toLowerCase();
  const services = (advert.serviceUUIDs ?? []).map(normalizeUuid);
  return profiles.some(profile => profile.nameHints.some(hint => name.includes(hint)) ||
    profile.serviceUUIDs.some(uuid => services.includes(uuid)));
}

export function selectProfile(services: BleServiceInfo[], profiles = BLE_ADAPTER_PROFILES): BleSelection | undefined {
  for (const profile of profiles) {
    for (const service of services) {
      const found = service.characteristics.map(item => ({ ...item, uuid: normalizeUuid(item.uuid) }));
      const write = profile.writeUUIDs.find(uuid => found.some(item => item.uuid === uuid && item.writable));
      const notify = profile.notifyUUIDs.find(uuid => found.some(item => item.uuid === uuid && item.notifiable));
      if (write && notify) return { profile, serviceUuid: service.uuid, writeUuid: write, notifyUuid: notify };
    }
  }
  return undefined;
}

export function ecuHex(ecu: number): string {
  return byte(ecu).toString(16).toUpperCase().padStart(2, '0');
}

export function ecuCommands(ecu: number): string[] {
  const id = ecuHex(ecu);
  return [`ATFCSD${id}30FF08`, 'ATFCSM1', `ATCRA6${id}`, `ATCEA${id}`];
}

export function chunkBytes(bytes: Uint8Array, size = BLE_WRITE_CHUNK): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) chunks.push(bytes.slice(offset, offset + size));
  return chunks;
}

export function encodeIsoTp(ecu: number, payload: Uint8Array): Uint8Array[] {
  byte(ecu);
  if (payload.length < 1 || payload.length > ISOTP_MAX_PAYLOAD) throw new Error('Invalid ISO-TP payload length');
  const frame = (pci: number[], data: Uint8Array) => {
    const bytes = new Uint8Array(8).fill(PADDING);
    bytes.set([ecu, ...pci]);
    bytes.set(data, 1 + pci.length);
    return bytes;
  };
  if (payload.length <= SF_MAX) return [frame([payload.length], payload)];
  const frames = [frame([0x10 | (payload.length >> 8), payload.length & 0xff], payload.subarray(0, FF_DATA))];
  for (let offset = FF_DATA, sequence = 1; offset < payload.length; offset += CF_DATA, sequence++) {
    frames.push(frame([0x20 | (sequence & 0xf)], payload.subarray(offset, offset + CF_DATA)));
  }
  return frames;
}

export function frameCommand(frame: Uint8Array): string {
  return Array.from(frame, value => ecuHex(value)).join('');
}

export function stMinMs(value: number): number {
  if (value <= 0x7f) return value;
  return value >= 0xf1 && value <= 0xf9 ? 0 : 0x7f;
}

export type ElmLine =
  | { kind: 'frame'; id: number; data: Uint8Array }
  | { kind: 'nodata' }
  | { kind: 'error'; text: string }
  | { kind: 'other' };

export function parseElmLine(raw: string): ElmLine {
  const text = raw.trim().replace(/^>/, '').trim();
  if (!text) return { kind: 'other' };
  const upper = text.toUpperCase();
  if (upper === 'NO DATA') return { kind: 'nodata' };
  if (upper.includes('?') || upper.includes('ERROR') || upper.includes('BUFFER FULL')) return { kind: 'error', text };
  const compact = upper.replace(/\s/g, '');
  if (!/^[0-9A-F]{3}(?:[0-9A-F]{2})+$/.test(compact)) return { kind: 'other' };
  return { kind: 'frame', id: parseInt(compact.slice(0, 3), 16), data: Uint8Array.from(compact.slice(3).match(/../g)!, pair => parseInt(pair, 16)) };
}

export type IsoTpEvent =
  | { type: 'message'; payload: Uint8Array }
  | { type: 'flow'; status: number; blockSize: number; stMin: number };

export class IsoTpReceiver {
  private buffer?: Uint8Array;
  private used = 0;
  private sequence = 0;

  constructor(private ecu: number) {}

  reset(): void { this.buffer = undefined; this.used = 0; this.sequence = 0; }

  push(id: number, data: Uint8Array): IsoTpEvent | undefined {
    if (id !== 0x600 + this.ecu || data.length < 2 || data[0] !== TESTER) return undefined;
    const type = data[1] >> 4;
    if (type === 0) return this.single(data);
    if (type === 1) return this.first(data);
    if (type === 2) return this.consecutive(data);
    if (type === 3) return data.length >= 4 ? { type: 'flow', status: data[1] & 0xf, blockSize: data[2], stMin: data[3] } : undefined;
    return undefined;
  }

  private single(data: Uint8Array): IsoTpEvent {
    const length = data[1] & 0xf;
    if (length < 1 || length > data.length - 2) throw new Error('Invalid ISO-TP single frame');
    this.reset();
    return { type: 'message', payload: data.slice(2, 2 + length) };
  }

  private first(data: Uint8Array): undefined {
    if (data.length < 3) throw new Error('Invalid ISO-TP first frame');
    const length = ((data[1] & 0xf) << 8) | data[2];
    if (length <= SF_MAX) throw new Error('Invalid ISO-TP first frame length');
    this.buffer = new Uint8Array(length);
    this.used = Math.min(length, data.length - 3);
    this.buffer.set(data.subarray(3, 3 + this.used));
    this.sequence = 1;
    return undefined;
  }

  private consecutive(data: Uint8Array): IsoTpEvent | undefined {
    if (!this.buffer) return undefined;
    if ((data[1] & 0xf) !== this.sequence) {
      this.reset();
      throw new Error('ISO-TP consecutive frame out of sequence');
    }
    const count = Math.min(this.buffer.length - this.used, data.length - 2);
    this.buffer.set(data.subarray(2, 2 + count), this.used);
    this.used += count;
    this.sequence = (this.sequence + 1) & 0xf;
    if (this.used < this.buffer.length) return undefined;
    const payload = this.buffer;
    this.reset();
    return { type: 'message', payload };
  }
}

export function sortByRssi(adverts: BleAdvert[]): BleAdvert[] {
  return [...adverts].sort((a, b) => (b.rssi ?? -Infinity) - (a.rssi ?? -Infinity));
}

export function candidateLabel(advert: BleAdvert): string {
  return `${advert.name || 'Unnamed'} · ${advert.rssi ?? '?'} dBm`;
}
