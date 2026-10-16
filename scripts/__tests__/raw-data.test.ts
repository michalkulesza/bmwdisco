import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ECU_DATA_DIR, MODULE_SGBDS, PACKS } from '../gen-data/paths';
import { loadRawData } from '../gen-data/raw';
import { mappingRowSchema, udsFileSchema } from '../gen-data/schemas';
import { chassisCodeOf, isFSeriesLabel } from '../gen-data/vehicles';

describe('raw ECU data', () => {
  const raw = loadRawData(ECU_DATA_DIR);

  it('validates every module, pack, identity and chassis file', () => {
    expect(Object.keys(raw.mappings)).toEqual([...MODULE_SGBDS]);
    expect(Object.keys(raw.uds)).toEqual([...MODULE_SGBDS]);
    expect(Object.keys(raw.packs)).toEqual([...PACKS]);
    expect(raw.ecuModules.length).toBeGreaterThan(0);
    expect(raw.chassis.length).toBeGreaterThan(0);
  });

  it('keeps only F-series rows in chassis_info', () => {
    expect(raw.chassis.every((row) => isFSeriesLabel(row.series))).toBe(true);
  });

  it('ships exactly the expected files', () => {
    const expected = [
      ...MODULE_SGBDS.flatMap((sgbd) => [`${sgbd}.json`, `${sgbd}.uds.json`]),
      ...PACKS.map((pack) => `${pack}.json`),
      'chassis_info.json',
      'ecu_modules.json',
      'README.md',
    ].sort();

    expect(fs.readdirSync(ECU_DATA_DIR).sort()).toEqual(expected);
  });

  it('uses addresses that match the identification table', () => {
    for (const sgbd of MODULE_SGBDS) {
      const rows = raw.ecuModules.filter((row) => row.SGBD === sgbd);
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((row) => row.ADR_INDEX))).toEqual(new Set([raw.uds[sgbd]?.addr]));
    }
  });

  it('rejects unexpected shapes', () => {
    const row = raw.mappings.FEM_20?.[0];
    expect(mappingRowSchema.safeParse({ ...row, extra: 1 }).success).toBe(false);
    expect(mappingRowSchema.safeParse({ ...row, args: 'x' }).success).toBe(false);
    expect(udsFileSchema.safeParse({ sgbd: 'X', addr: 'zz' }).success).toBe(false);
  });

  it('fails loudly on a malformed file', () => {
    const dir = fs.mkdtempSync(path.join(tmpdir(), 'ecu-'));
    fs.cpSync(ECU_DATA_DIR, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'FEM_20.json'), JSON.stringify([{ sgbd: 'FEM_20' }]));

    expect(() => loadRawData(dir)).toThrow(/FEM_20.json failed validation/);
  });
});

describe('F chassis detection', () => {
  it.each([
    ["4' F32", 'F32'],
    ["5' F10 LCI", 'F10'],
    ['X3 M F97', 'F97'],
    ["3' E90", null],
    ["7' G12", null],
    ['X1 U11', null],
    ['F100 Series', null],
  ])('%s -> %s', (label, code) => {
    expect(chassisCodeOf(label)).toBe(code);
  });
});
