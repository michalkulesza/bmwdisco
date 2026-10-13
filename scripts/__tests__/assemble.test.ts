import { OFF_PARAMS, ON_PARAMS, assembleRow, type Assembly } from '../gen-data/assemble';
import { formatBytes } from '../gen-data/bytes';

import type { MappingRow, UdsFile } from '../gen-data/schemas';

const row = (fn: string, args: string[]): MappingRow => ({
  sgbd: 'T',
  group: 'G',
  description: 'd',
  command: 'C',
  function: fn,
  args,
});

const uds = (overrides: Partial<UdsFile>): UdsFile => ({
  sgbd: 'T',
  addr: '40',
  jobs: {},
  fns: [],
  enums: {},
  ...overrides,
});

const hex = (result: Assembly) => (result.ok ? formatBytes(result.bytes) : `FAIL ${result.reason}`);

describe('assembleRow', () => {
  it('strips job padding and appends resolved arguments', () => {
    const data = uds({ jobs: { DIG: '2f4501030000' } });

    expect(hex(assembleRow(row('DIG', ['0x01', '{param_aktion}']), data, ON_PARAMS))).toBe(
      '2F 45 01 03 01 01',
    );
    expect(hex(assembleRow(row('DIG', ['0x0D', '{param_aktion}']), data, OFF_PARAMS))).toBe(
      '2F 45 01 03 0D 00',
    );
  });

  it('rejects job templates whose tail is not zero padding', () => {
    const data = uds({ jobs: { DIG: '2f4501030101' } });

    expect(hex(assembleRow(row('DIG', ['0x01', '1']), data, ON_PARAMS))).toMatch(/^FAIL/);
  });

  it('assembles 0x2E dispatch with big-endian fields', () => {
    const data = uds({
      fns: [
        {
          n: 'FN',
          s: 0x2e,
          id: 'D542',
          a: [
            ['ELEMENT', 2],
            ['ZEIT', 2],
          ],
        },
      ],
    });
    const aggregate = row('STEUERN', ['ARG', 'FN', '0x05', '{param_zeit}']);

    expect(hex(assembleRow(aggregate, data, ON_PARAMS))).toBe('2E D5 42 00 05 00 64');
    expect(hex(assembleRow(aggregate, data, OFF_PARAMS))).toBe('2E D5 42 00 05 00 00');
  });

  it('assembles routine dispatch with start and stop sub-functions', () => {
    const data = uds({ fns: [{ n: 'LED', s: 0x31, id: 'A543', a: [['ELEMENT', 1]] }] });
    const led = row('STEUERN_ROUTINE', ['ARG', 'LED', '{param_steuern_routine}', '0x01']);

    expect(hex(assembleRow(led, data, ON_PARAMS))).toBe('31 01 A5 43 01');
    expect(hex(assembleRow(led, data, OFF_PARAMS))).toBe('31 02 A5 43 01');
    expect(hex(assembleRow(row('STEUERN_ROUTINE', ['ARG', 'LED', 'STPR']), data, ON_PARAMS))).toBe(
      '31 02 A5 43',
    );
  });

  it('refuses partial field lists and named fields', () => {
    const data = uds({
      fns: [
        {
          n: 'WIDE',
          s: 0x2e,
          id: '6060',
          a: [
            ['A', 1],
            ['B', 1],
          ],
        },
      ],
    });

    expect(
      hex(assembleRow(row('STEUERN', ['ARG', 'WIDE', 'A', '{param_zeit}']), data, ON_PARAMS)),
    ).toMatch(/^FAIL/);
  });

  it('refuses light channels with empty or missing bit lists', () => {
    const data = uds({
      lights: {
        function: 'L',
        template: '2F 01 00 03 00',
        channels: { EMPTY: [], OK: [[2, '0x04']] },
        state: { on: [[4, '0x64']], off: [] },
      },
    });

    expect(hex(assembleRow(row('L', ['EMPTY', '1']), data, ON_PARAMS))).toMatch(/empty bit list/);
    expect(hex(assembleRow(row('L', ['NOPE', '1']), data, ON_PARAMS))).toMatch(/missing/);
    expect(hex(assembleRow(row('L', ['OK', '1']), data, ON_PARAMS))).toBe('2F 01 04 03 64');
    expect(hex(assembleRow(row('L', ['OK', '0']), data, OFF_PARAMS))).toBe('2F 01 04 03 00');
  });

  it('assembles session, communication and return-control frames', () => {
    const data = uds({});

    expect(hex(assembleRow(row('DIAGNOSE_MODE', ['ECUEXTDIAG']), data, ON_PARAMS))).toBe('10 03');
    expect(hex(assembleRow(row('COMMUNICATION_CONTROL', ['02', '01']), data, ON_PARAMS))).toBe(
      '28 02 01',
    );
    expect(
      hex(assembleRow(row('IO_RETURN_CONTROL', ['45', '01', '00', 'FE']), data, ON_PARAMS)),
    ).toBe('2F 45 01 00 FE');
    expect(
      hex(assembleRow(row('RAW_UDS', ['31', '01', 'F0', '12', '01', 'FC', '21']), data, ON_PARAMS)),
    ).toBe('31 01 F0 12 01 FC 21');
  });
});
