import {
  chunkBytes,
  isKnownAdapterAdvert,
  normalizeUuid,
  scanServiceUuids,
  selectProfile,
  toFullUuid,
  writeChunked,
  writeSizeForMtu,
  type BleServiceInfo,
} from '../ble-profiles';
import { Emitter } from '../emitter';

const VGATE = 'BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F';

describe('uuid helpers', () => {
  it('normalizes base-uuid forms to 16-bit and lowercases others', () => {
    expect(normalizeUuid('0000FFF0-0000-1000-8000-00805F9B34FB')).toBe('fff0');
    expect(normalizeUuid('FFE0')).toBe('ffe0');
    expect(normalizeUuid(VGATE)).toBe(VGATE.toLowerCase());
  });

  it('expands short uuids for scan filters', () => {
    expect(toFullUuid('fff0')).toBe('0000fff0-0000-1000-8000-00805f9b34fb');
    expect(toFullUuid(VGATE)).toBe(VGATE.toLowerCase());
    expect(scanServiceUuids()).toContain('0000ffe0-0000-1000-8000-00805f9b34fb');
    expect(new Set(scanServiceUuids()).size).toBe(scanServiceUuids().length);
  });
});

describe('isKnownAdapterAdvert', () => {
  it('only accepts adverts with a known service uuid, never by name', () => {
    expect(isKnownAdapterAdvert({ serviceUuids: ['0000fff0-0000-1000-8000-00805f9b34fb'] })).toBe(
      true,
    );
    expect(isKnownAdapterAdvert({ serviceUuids: [VGATE] })).toBe(true);
    expect(isKnownAdapterAdvert({ serviceUuids: ['180f'] })).toBe(false);
    expect(isKnownAdapterAdvert({ serviceUuids: [] })).toBe(false);
  });
});

describe('selectProfile', () => {
  const service = (uuid: string, ...chars: [string, boolean, boolean][]): BleServiceInfo => ({
    uuid,
    characteristics: chars.map(([charUuid, writable, notifiable]) => ({
      uuid: charUuid,
      writable,
      notifiable,
    })),
  });

  it('selects the Vgate serial characteristic', () => {
    const selection = selectProfile([service(VGATE, [VGATE, true, true])]);

    expect(selection).toMatchObject({
      profile: { id: 'vgate-icar' },
      writeUuid: VGATE.toLowerCase(),
    });
  });

  it('selects FFF0 style adapters', () => {
    const selection = selectProfile([
      service('0000fff0-0000-1000-8000-00805f9b34fb', ['fff1', false, true], ['fff2', true, false]),
    ]);

    expect(selection).toMatchObject({
      profile: { id: 'elm-fff0' },
      serviceUuid: 'fff0',
      writeUuid: 'fff2',
      notifyUuid: 'fff1',
    });
  });

  it('requires both write and notify capability', () => {
    expect(selectProfile([service('ffe0', ['ffe1', true, false])])).toBeUndefined();
    expect(selectProfile([service('1234', ['5678', true, true])])).toBeUndefined();
  });
});

describe('writes', () => {
  it('derives the write size from the MTU with a floor', () => {
    expect(writeSizeForMtu(185)).toBe(182);
    expect(writeSizeForMtu(23)).toBe(20);
    expect(writeSizeForMtu(0)).toBe(20);
  });

  it('chunks data without losing bytes', () => {
    const data = Uint8Array.from({ length: 45 }, (_, index) => index);

    const chunks = chunkBytes(data, 20);

    expect(chunks.map((chunk) => chunk.length)).toEqual([20, 20, 5]);
    expect(chunkBytes(new Uint8Array(), 20)).toEqual([]);
  });

  it('writes chunks sequentially', async () => {
    const calls: number[] = [];

    await writeChunked(new Uint8Array(50), 20, async (chunk) => {
      await Promise.resolve();
      calls.push(chunk.length);
    });

    expect(calls).toEqual([20, 20, 10]);
  });
});

describe('Emitter', () => {
  it('delivers to subscribers and supports unsubscribe and clear', () => {
    const emitter = new Emitter<[number]>();
    const a = jest.fn();
    const b = jest.fn();
    const stopA = emitter.subscribe(a);
    emitter.subscribe(b);

    emitter.emit(1);
    stopA();
    emitter.emit(2);
    emitter.clear();
    emitter.emit(3);

    expect(a.mock.calls).toEqual([[1]]);
    expect(b.mock.calls).toEqual([[1], [2]]);
  });
});
