import fs from 'node:fs';
import path from 'node:path';

import { IDENTIFICATION, MODULE_SGBDS, SERIES_HINTS, loadModule, loadVehicles } from '../generated';

describe('identification', () => {
  it('has an entry for every module', () => {
    for (const sgbd of MODULE_SGBDS) {
      expect(IDENTIFICATION.some((entry) => entry.sgbd === sgbd)).toBe(true);
    }
  });

  it('agrees with the module identity matchers and addresses', () => {
    for (const sgbd of MODULE_SGBDS) {
      const module = loadModule(sgbd);
      const entries = IDENTIFICATION.filter((entry) => entry.sgbd === sgbd);

      expect(entries.map((entry) => entry.sgbdHex).sort()).toEqual(
        module.identity.map((identity) => identity.sgbdHex).sort(),
      );
      expect(new Set(entries.map((entry) => entry.adrIndex))).toEqual(new Set([module.address]));
    }
  });

  it('is keyed uniquely by address and identity code', () => {
    const keys = IDENTIFICATION.map((entry) => `${entry.adrIndex}:${entry.sgbdHex}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only hints F chassis codes at known modules', () => {
    for (const [code, sgbds] of Object.entries(SERIES_HINTS)) {
      expect(code).toMatch(/^F\d{2}$/);
      for (const sgbd of sgbds) expect(MODULE_SGBDS).toContain(sgbd);
    }
  });
});

describe('vehicles', () => {
  const vehicles = loadVehicles();

  it('lists only F-series, deduplicated', () => {
    expect(vehicles.length).toBeGreaterThan(50);

    for (const series of vehicles) {
      expect(series.code).toMatch(/^F\d{2}$/);
      const keys = series.models.map((model) => `${model.name}|${model.engine}|${model.body}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('includes the F32 and F10 test cars', () => {
    const codes = vehicles.map((series) => series.code);

    expect(codes).toContain('F32');
    expect(codes).toContain('F10');
  });
});

describe('bundle hygiene', () => {
  const collect = (dir: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? collect(path.join(dir, entry.name))
          : /\.(tsx?|jsx?)$/.test(entry.name)
            ? [path.join(dir, entry.name)]
            : [],
      );

  it('never imports the raw ECU data from app code', () => {
    const root = path.resolve(__dirname, '..', '..', '..');
    const files = [...collect(path.join(root, 'src')), ...collect(path.join(root, 'app'))].filter(
      (file) => !file.includes(`${path.sep}__tests__${path.sep}`),
    );

    for (const file of files) {
      expect({
        file,
        imports: /data\/ecu|BimmerDisco/i.test(fs.readFileSync(file, 'utf8')),
      }).toEqual({
        file,
        imports: false,
      });
    }
  });
});
