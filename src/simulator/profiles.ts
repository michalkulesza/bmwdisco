import { loadVehicles } from '@/data/generated';
import type { ModuleSgbd } from '@/data/generated';

export interface VehicleProfile {
  chassis: string;
  modules: readonly ModuleSgbd[];
}

const FEM_SET: readonly ModuleSgbd[] = ['FEM_20', 'REM_20', 'FLE02_L', 'FLE02_R', 'KOMB25'];
const FRM_SET: readonly ModuleSgbd[] = ['FRM3', 'KOMB01', 'LHM2_L', 'LHM2_R'];
const BDC_KOMB01_SET: readonly ModuleSgbd[] = ['BDC', 'KOMB01'];
const BDC_KOMB25_SET: readonly ModuleSgbd[] = ['BDC', 'KOMB25'];

const FRM_CHASSIS = ['F01', 'F02', 'F03', 'F04', 'F06', 'F07', 'F10', 'F11', 'F12', 'F13', 'F18'];
const BDC_KOMB01_CHASSIS = ['F15', 'F16', 'F85', 'F86'];
const BDC_KOMB25_CHASSIS = [
  'F25',
  'F26',
  'F39',
  'F40',
  'F44',
  'F45',
  'F46',
  'F48',
  'F49',
  'F52',
  'F90',
  'F91',
  'F92',
  'F93',
  'F95',
  'F96',
  'F97',
  'F98',
];

export const defaultModulesFor = (chassis: string): readonly ModuleSgbd[] => {
  if (FRM_CHASSIS.includes(chassis)) return FRM_SET;
  if (BDC_KOMB01_CHASSIS.includes(chassis)) return BDC_KOMB01_SET;
  if (BDC_KOMB25_CHASSIS.includes(chassis)) return BDC_KOMB25_SET;

  return FEM_SET;
};

export const knownChassis = (): string[] => [
  ...new Set(loadVehicles().map((series) => series.code)),
];

export const createProfile = (
  chassis: string,
  modules: readonly ModuleSgbd[] = defaultModulesFor(chassis),
): VehicleProfile => {
  if (!knownChassis().includes(chassis)) throw new RangeError(`Unknown chassis ${chassis}`);

  return { chassis, modules };
};

export const withoutLedHeadlights = (chassis: string): VehicleProfile =>
  createProfile(
    chassis,
    defaultModulesFor(chassis).filter((sgbd) => sgbd !== 'FLE02_L' && sgbd !== 'FLE02_R'),
  );
