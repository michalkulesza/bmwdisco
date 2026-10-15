import { getFixedT } from 'i18next';

import '@/i18n';
import type { DetectedCar, GroupResult, RawExchange } from '@/domain';

import {
  decodeOutcome,
  ecuLabel,
  formatResultsText,
  noteForResult,
  readingsOf,
  snapshotLabelText,
  type LogEntry,
} from './helpers';

const t = getFixedT('en');
const car = {
  chassis: 'F32',
  modules: [{ sgbd: 'FEM_20', address: 0x40 }],
} as unknown as DetectedCar;
const cleanup = { restored: true, failures: [] };

const exchange = (overrides: Partial<RawExchange>): RawExchange => ({
  id: 1,
  at: 0,
  ecu: 0x40,
  request: Uint8Array.of(0x22, 0xf1, 0x50),
  outcome: { kind: 'positive', response: Uint8Array.of(0x62, 0xf1, 0x50, 0x01) },
  stage: 'step',
  ...overrides,
});

describe('decodeOutcome', () => {
  it('names positive, NRC, timeout and error results', () => {
    expect(decodeOutcome({ kind: 'positive', response: Uint8Array.of(0x62) }, t)).toBe('positive');
    expect(decodeOutcome({ kind: 'negative', nrc: 0x22, response: new Uint8Array() }, t)).toBe(
      'NRC 0x22 conditions not correct',
    );
    expect(decodeOutcome({ kind: 'negative', nrc: 0x99, response: new Uint8Array() }, t)).toBe(
      'NRC 0x99 unknown negative response',
    );
    expect(decodeOutcome({ kind: 'timeout' }, t)).toBe('timeout');
    expect(decodeOutcome({ kind: 'error', message: 'Link closed' }, t)).toBe('error: Link closed');
  });
});

describe('ecuLabel', () => {
  it('combines the module name and hex address', () => {
    expect(ecuLabel(0x40, car)).toBe('FEM_20 0x40');
    expect(ecuLabel(0x99)).toBe('0x99');
  });
});

describe('formatResultsText', () => {
  it('lists every line with request, response and decoded result, plus snapshots', () => {
    const entries: LogEntry[] = [
      { key: 1, kind: 'note', at: 0, text: 'Started: Identity' },
      { key: 2, kind: 'exchange', exchange: exchange({}) },
      {
        key: 3,
        kind: 'exchange',
        exchange: exchange({
          ecu: 0x72,
          stage: 'cleanup',
          outcome: { kind: 'negative', nrc: 0x31, response: Uint8Array.of(0x7f, 0x22, 0x31) },
        }),
      },
      { key: 4, kind: 'exchange', exchange: exchange({ outcome: { kind: 'timeout' } }) },
    ];
    const snapshots = [
      { id: 1, label: 'Lights off', ecu: 0x43, data: Uint8Array.from({ length: 14 }, (_, i) => i) },
    ];

    const text = formatResultsText(entries, snapshots, t, car);

    expect(text).toContain('Chassis: F32');
    expect(text).toContain('Modules: FEM_20');
    expect(text).toContain('-- Started: Identity');
    expect(text).toMatch(/FEM_20 0x40 > 22 F1 50 < 62 F1 50 01 = positive/);
    expect(text).toMatch(/0x72 \[cleanup\] > 22 F1 50 < 7F 22 31 = NRC 0x31 request out of range/);
    expect(text).toMatch(/FEM_20 0x40 > 22 F1 50 < - = timeout/);
    expect(text).toContain('LHM2 snapshots');
    expect(text).toContain('Lights off 0x43 PWM 0 1 2 3 4 5 6 | I 7 8 9 10 11 12 13');
  });

  it('omits the snapshot section and handles an unknown car', () => {
    const text = formatResultsText([], [], t);

    expect(text).toContain('Chassis: unknown');
    expect(text).toContain('Modules: none');
    expect(text).not.toContain('LHM2 snapshots');
  });
});

describe('readingsOf', () => {
  it('keeps only valid LHM2 records by ECU', () => {
    const record = Uint8Array.from([0x62, 0x60, 0x60, ...Array.from({ length: 14 }, () => 1)]);
    const result: GroupResult = {
      status: 'completed',
      cleanup,
      exchanges: [
        exchange({ ecu: 0x43, outcome: { kind: 'positive', response: record } }),
        exchange({ ecu: 0x44, outcome: { kind: 'timeout' } }),
        exchange({ ecu: 0x45, outcome: { kind: 'positive', response: Uint8Array.of(0x62) } }),
      ],
    };

    expect([...readingsOf(result).keys()]).toEqual([0x43]);
  });
});

describe('noteForResult', () => {
  it('describes completed, aborted and failed results', () => {
    const base = { exchanges: [], cleanup };

    expect(noteForResult({ ...base, status: 'completed' }, 'Hazard', t)).toBe('Finished: Hazard');
    expect(noteForResult({ ...base, status: 'aborted' }, 'Hazard', t)).toBe('Aborted: Hazard');
    expect(
      noteForResult(
        { ...base, status: 'failed', failure: { kind: 'step', exchange: exchange({}) } },
        'Hazard',
        t,
      ),
    ).toBe('Stopped at the first failing step: Hazard');
    expect(
      noteForResult(
        { ...base, status: 'failed', failure: { kind: 'error', code: 'invalidBaseline' } },
        'Write',
        t,
      ),
    ).toBe('Failed: Write (could not read a valid LHM2 record)');
    expect(
      noteForResult(
        { ...base, status: 'failed', failure: { kind: 'error', code: 'odd', message: 'boom' } },
        'Write',
        t,
      ),
    ).toBe('Failed: Write (boom)');
  });
});

describe('snapshotLabelText', () => {
  it('prefers custom text, falls back to the chosen label, and is empty without either', () => {
    expect(snapshotLabelText('lowBeam', ' my label ', t)).toBe('my label');
    expect(snapshotLabelText('lowBeam', '', t)).toBe('Low beam');
    expect(snapshotLabelText(undefined, '', t)).toBe('');
  });
});
