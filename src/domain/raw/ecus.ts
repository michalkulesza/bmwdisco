import type { DetectedCar } from '../registry/types';

export const ECU = {
  fem: 0x40,
  lhm2Left: 0x43,
  lhm2Right: 0x44,
  kombi: 0x60,
  rem: 0x72,
} as const;

const KNOWN_ECU_NAMES: ReadonlyMap<number, string> = new Map([
  [ECU.fem, 'FEM_20'],
  [ECU.lhm2Left, 'LHM2_L'],
  [ECU.lhm2Right, 'LHM2_R'],
  [ECU.kombi, 'KOMB25'],
  [ECU.rem, 'REM_20'],
]);

export interface EcuChoice {
  address: number;
  name: string;
}

export const ecuNameOf = (address: number, car?: DetectedCar): string | undefined =>
  car?.modules.find((module) => module.address === address)?.sgbd ?? KNOWN_ECU_NAMES.get(address);

export const ecuChoicesOf = (car?: DetectedCar): EcuChoice[] =>
  (car?.modules ?? []).map((module) => ({ address: module.address, name: module.sgbd }));
