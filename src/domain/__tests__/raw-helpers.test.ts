import { ecuChoicesOf, ecuNameOf } from '@/domain/raw/ecus';
import { testBlockReason } from '@/domain/raw/gate';
import { clampLhm2Hold } from '@/domain/raw/groups';
import { formatEcuAddress, parseEcuAddress, parseHexBytes } from '@/domain/raw/hex';
import {
  buildLhm2Write,
  diffSnapshots,
  lhm2DataOf,
  splitLhm2Record,
  withChannelPwm,
  type Lhm2Snapshot,
} from '@/domain/raw/lhm2';
import { requiresConfirmation, silencesCommunication } from '@/domain/raw/services';
import type { DetectedCar } from '@/domain/registry/types';
import { ControlLedger } from '@/domain/runner/ledger';
import { hex } from '@/protocol/bytes';

describe('parseHexBytes', () => {
  it('accepts spaced, compact, prefixed and mixed-case hex', () => {
    expect(parseHexBytes('22 f1 50')).toEqual({ ok: true, bytes: Uint8Array.of(0x22, 0xf1, 0x50) });
    expect(parseHexBytes('22F150')).toEqual({ ok: true, bytes: Uint8Array.of(0x22, 0xf1, 0x50) });
    expect(parseHexBytes('0x22, 0xF1,0x50')).toEqual({
      ok: true,
      bytes: Uint8Array.of(0x22, 0xf1, 0x50),
    });
  });

  it('rejects empty, odd-length, non-hex and oversized input', () => {
    expect(parseHexBytes('  ')).toEqual({ ok: false, error: 'empty' });
    expect(parseHexBytes('22 F')).toEqual({ ok: false, error: 'invalid' });
    expect(parseHexBytes('22 GG')).toEqual({ ok: false, error: 'invalid' });
    expect(parseHexBytes('00'.repeat(65))).toEqual({ ok: false, error: 'tooLong' });
    expect(parseHexBytes('00'.repeat(64)).ok).toBe(true);
  });
});

describe('ECU addresses', () => {
  it('parses one or two hex digits and formats with a 0x prefix', () => {
    expect(parseEcuAddress('43')).toBe(0x43);
    expect(parseEcuAddress('0x4')).toBe(0x04);
    expect(parseEcuAddress('100')).toBeUndefined();
    expect(parseEcuAddress('zz')).toBeUndefined();
    expect(parseEcuAddress('')).toBeUndefined();
    expect(formatEcuAddress(0x4)).toBe('0x04');
    expect(formatEcuAddress(0x72)).toBe('0x72');
  });

  it('names known and detected ECUs', () => {
    const car = { modules: [{ address: 0x90, sgbd: 'BDC' }] } as unknown as DetectedCar;

    expect(ecuNameOf(0x43)).toBe('LHM2_L');
    expect(ecuNameOf(0x90, car)).toBe('BDC');
    expect(ecuNameOf(0x99)).toBeUndefined();
    expect(ecuChoicesOf(car)).toEqual([{ address: 0x90, name: 'BDC' }]);
    expect(ecuChoicesOf()).toEqual([]);
  });
});

describe('requiresConfirmation', () => {
  it.each([
    ['22 F1 50', false],
    ['3E 00', false],
    ['3E 80', false],
    ['10 01', false],
    ['10 03', true],
    ['2E D5 42 00 12 00 64', true],
    ['28 02 01', true],
    ['2F 45 01 00 FE', true],
    ['31 01 A5 34', true],
  ])('%s -> %s', (payload, expected) => {
    const bytes = parseHexBytes(payload);

    expect(bytes.ok && requiresConfirmation(bytes.bytes)).toBe(expected);
  });

  it('detects communication control that disables traffic', () => {
    expect(silencesCommunication(Uint8Array.of(0x28, 0x02, 0x01))).toBe(true);
    expect(silencesCommunication(Uint8Array.of(0x28, 0x00, 0x03))).toBe(false);
    expect(silencesCommunication(Uint8Array.of(0x10, 0x03))).toBe(false);
  });
});

describe('LHM2 records', () => {
  const data = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 10, 20, 30, 40, 50, 60, 70]);
  const response = Uint8Array.from([0x62, 0x60, 0x60, ...data]);

  it('splits a read response into PWM and current bytes', () => {
    expect(lhm2DataOf(response)).toEqual(data);
    expect(splitLhm2Record(data)).toEqual({
      pwm: [1, 2, 3, 4, 5, 6, 7],
      current: [10, 20, 30, 40, 50, 60, 70],
    });
  });

  it('rejects responses with the wrong header or length', () => {
    expect(lhm2DataOf(response.subarray(0, 10))).toBeUndefined();
    expect(lhm2DataOf(Uint8Array.from([0x62, 0x60, 0x61, ...data]))).toBeUndefined();
  });

  it('builds the write frame and sets a single PWM channel without touching the input', () => {
    const lit = withChannelPwm(data, 3, 0xfa);

    expect(hex(buildLhm2Write(data))).toBe('2E 60 60 01 02 03 04 05 06 07 0A 14 1E 28 32 3C 46');
    expect(Array.from(lit.subarray(0, 7))).toEqual([1, 2, 0xfa, 4, 5, 6, 7]);
    expect(Array.from(lit.subarray(7))).toEqual(Array.from(data.subarray(7)));
    expect(data[2]).toBe(3);
    expect(() => withChannelPwm(data, 0, 1)).toThrow(RangeError);
    expect(() => withChannelPwm(data, 8, 1)).toThrow(RangeError);
  });

  it('diffs snapshots per byte and flags rows that change', () => {
    const snapshot = (id: number, bytes: Uint8Array): Lhm2Snapshot => ({
      id,
      label: `s${id}`,
      ecu: 0x43,
      data: bytes,
    });
    const changed = data.slice();
    changed[1] = 0xfa;
    const rows = diffSnapshots([snapshot(1, data), snapshot(2, changed)]);

    expect(rows).toHaveLength(14);
    expect(rows[1]).toEqual({ kind: 'pwm', channel: 2, values: [2, 0xfa], changed: true });
    expect(rows[0]!.changed).toBe(false);
    expect(rows[7]).toMatchObject({ kind: 'current', channel: 1, changed: false });
    expect(diffSnapshots([]).every((row) => !row.changed)).toBe(true);
  });
});

describe('testBlockReason', () => {
  const base = { phase: 'ready', activeToggles: [], hasPending: false, testActive: false } as const;

  it('allows a test only on an idle, ready session', () => {
    expect(testBlockReason(base)).toBeUndefined();
    expect(testBlockReason({ ...base, phase: 'running' })).toBe('effectRunning');
    expect(testBlockReason({ ...base, phase: 'reconnecting' })).toBe('notReady');
    expect(testBlockReason({ ...base, activeToggles: ['toggle.hazard'] })).toBe('toggleActive');
    expect(testBlockReason({ ...base, hasPending: true })).toBe('controlPending');
    expect(testBlockReason({ ...base, hasPending: true, testActive: true })).toBeUndefined();
  });
});

describe('clampLhm2Hold', () => {
  it('keeps the on time between 300 and 3000 ms', () => {
    expect(clampLhm2Hold(10)).toBe(300);
    expect(clampLhm2Hold(1000.4)).toBe(1000);
    expect(clampLhm2Hold(99999)).toBe(3000);
  });
});

describe('ControlLedger raw entries', () => {
  it('counts as pending, dedupes undo steps, and clears', () => {
    const ledger = new ControlLedger();
    const undo = Uint8Array.of(0x2e, 0x01);

    ledger.armRaw(0x40, [undo]);
    ledger.armRaw(0x40, [undo.slice(), Uint8Array.of(0x2f)]);
    ledger.silenceRaw(0x40);

    expect(ledger.hasPending).toBe(true);
    expect(ledger.hasRawSession(0x40)).toBe(true);
    expect(ledger.hasRawSession(0x41)).toBe(false);
    expect(ledger.rawTouched).toHaveLength(1);
    expect(ledger.rawTouched[0]!.undo).toHaveLength(2);
    expect(ledger.rawTouched[0]!.silenced).toBe(true);

    ledger.clear();

    expect(ledger.hasPending).toBe(false);
  });
});
