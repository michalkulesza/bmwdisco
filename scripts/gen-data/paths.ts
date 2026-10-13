import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..', '..');
export const SOURCE_DIR = path.join(ROOT, 'PROTO', 'analysis', 'source');
export const ECU_DATA_DIR = path.join(ROOT, 'data', 'ecu');
export const GENERATED_DIR = path.join(ROOT, 'src', 'data', 'generated');

export const MODULE_SGBDS = [
  'FEM_20',
  'REM_20',
  'FRM3',
  'BDC',
  'FLE02_L',
  'FLE02_R',
  'LHM2_L',
  'LHM2_R',
  'KOMB01',
  'KOMB25',
] as const;

export const PACKS = [
  'flash',
  'headlight_flash',
  'headlight_show',
  'one_side',
  'taillight_flash',
  'taillight_show',
  'party_mode',
  'ghost',
  'toggle',
] as const;

export type ModuleSgbd = (typeof MODULE_SGBDS)[number];
export type PackName = (typeof PACKS)[number];
