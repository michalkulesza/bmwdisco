import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { MODULE_SGBDS, PACKS } from './paths';
import {
  chassisInfoFileSchema,
  ecuModulesFileSchema,
  mappingFileSchema,
  packFileSchema,
  udsFileSchema,
  type ChassisRow,
  type EcuModuleRow,
  type MappingRow,
  type PackFile,
  type UdsFile,
} from './schemas';

export interface RawData {
  mappings: Record<string, MappingRow[]>;
  uds: Record<string, UdsFile>;
  packs: Record<string, PackFile>;
  ecuModules: EcuModuleRow[];
  chassis: ChassisRow[];
}

const readJson = <T extends z.ZodType>(dir: string, name: string, schema: T): z.infer<T> => {
  const text = fs.readFileSync(path.join(dir, name), 'utf8');
  const result = schema.safeParse(JSON.parse(text));
  if (!result.success)
    throw new Error(`${name} failed validation:\n${z.prettifyError(result.error)}`);

  return result.data;
};

export const loadRawData = (dir: string): RawData => {
  const mappings: RawData['mappings'] = {};
  const uds: RawData['uds'] = {};
  const packs: RawData['packs'] = {};

  for (const sgbd of MODULE_SGBDS) {
    mappings[sgbd] = readJson(dir, `${sgbd}.json`, mappingFileSchema);
    uds[sgbd] = readJson(dir, `${sgbd}.uds.json`, udsFileSchema);
  }
  for (const pack of PACKS) packs[pack] = readJson(dir, `${pack}.json`, packFileSchema);

  return {
    mappings,
    uds,
    packs,
    ecuModules: readJson(dir, 'ecu_modules.json', ecuModulesFileSchema),
    chassis: readJson(dir, 'chassis_info.json', chassisInfoFileSchema),
  };
};
