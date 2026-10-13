import { categoryOf, isElementId } from '../../src/data/elements';

import { buildEffects, camelCase, type BuiltEffects } from './effects';
import { buildIdentification } from './identification';
import { buildModule, type ModuleReport } from './modules';
import { MODULE_SGBDS } from './paths';
import { fileWith, literal } from './render';
import { buildVehicles } from './vehicles';

import type { RawData } from './raw';
import type { Effect, Module } from '../../src/data/types';

export interface BuildResult {
  files: Record<string, string>;
  modules: Module[];
  moduleReports: ModuleReport[];
  effects: BuiltEffects;
  i18nKeys: Record<string, string[]>;
}

const renderModule = (module: Module) =>
  fileWith(
    "import type { Module } from '../../types';",
    '',
    `const data: Module = ${literal(module)};`,
    '',
    'export default Object.freeze(data);',
  );

const renderIndex = () =>
  fileWith(
    "import type { Effect, Module, VehicleSeries } from '../types';",
    '',
    "export { IDENTIFICATION, SERIES_HINTS } from './identification';",
    '',
    `export const MODULE_SGBDS = ${literal([...MODULE_SGBDS])} as const;`,
    '',
    'export type ModuleSgbd = (typeof MODULE_SGBDS)[number];',
    '',
    'const moduleLoaders: Record<ModuleSgbd, () => Module> = {',
    ...MODULE_SGBDS.map((sgbd) => `  ${sgbd}: () => require('./modules/${sgbd}').default,`),
    '};',
    '',
    'export const loadModule = (sgbd: ModuleSgbd): Module => moduleLoaders[sgbd]();',
    '',
    "export const loadEffects = (): readonly Effect[] => require('./effects').EFFECTS;",
    '',
    "export const loadVehicles = (): readonly VehicleSeries[] => require('./vehicles').VEHICLES;",
  );

const buildI18nKeys = (modules: readonly Module[], effects: readonly Effect[]) => {
  const elementIds = new Set(modules.flatMap((module) => Object.keys(module.elements)));
  const usedElements = [...elementIds].filter(isElementId).sort();
  const categories = new Set(usedElements.map(categoryOf));

  const sections = new Set(
    effects.flatMap((effect) => (effect.sectionKey ? [effect.sectionKey] : [])),
  );
  const packs = new Set(effects.map((effect) => `packs.${camelCase(effect.pack)}`));

  return {
    elements: usedElements.map((id) => `elements.${id}`),
    categories: [...categories].sort().map((category) => `categories.${category}`),
    packs: [...packs].sort(),
    sections: [...sections].sort(),
    effects: effects.map((effect) => effect.nameKey).sort(),
  };
};

export const buildAll = (raw: RawData): BuildResult => {
  const built = MODULE_SGBDS.map((sgbd) => {
    const mapping = raw.mappings[sgbd];
    const uds = raw.uds[sgbd];
    if (!mapping || !uds) throw new Error(`Missing raw data for ${sgbd}`);
    return buildModule(sgbd, mapping, uds, raw.ecuModules);
  });

  const modules = built.map((item) => item.module);
  const effects = buildEffects(raw.packs, modules);
  const identification = buildIdentification(raw.ecuModules, MODULE_SGBDS);
  const vehicles = buildVehicles(raw.chassis);

  const files: Record<string, string> = {
    'index.ts': renderIndex(),
    'effects.ts': fileWith(
      "import type { Effect } from '../types';",
      '',
      `export const EFFECTS: readonly Effect[] = Object.freeze(${literal(effects.effects)});`,
    ),
    'identification.ts': fileWith(
      "import type { IdentificationEntry } from '../types';",
      '',
      `export const IDENTIFICATION: readonly IdentificationEntry[] = Object.freeze(${literal(identification.entries)});`,
      '',
      `export const SERIES_HINTS: Readonly<Record<string, readonly string[]>> = Object.freeze(${literal(identification.seriesHints)});`,
    ),
    'vehicles.ts': fileWith(
      "import type { VehicleSeries } from '../types';",
      '',
      `export const VEHICLES: readonly VehicleSeries[] = Object.freeze(${literal(vehicles)});`,
    ),
  };

  for (const module of modules) files[`modules/${module.sgbd}.ts`] = renderModule(module);

  const i18nKeys = buildI18nKeys(modules, effects.effects);
  files['i18n-keys.json'] = `${JSON.stringify(i18nKeys, null, 2)}\n`;

  return {
    files,
    modules,
    moduleReports: built.map((item) => item.report),
    effects,
    i18nKeys,
  };
};
