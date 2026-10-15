import { categoryOf, ELEMENT_IDS, type ElementId } from '@/data/elements';
import {
  loadModule,
  loadTypeCodes,
  type ModuleSgbd,
  IDENTIFICATION,
  SERIES_HINTS,
} from '@/data/generated';
import type { Effect, IdentificationEntry, TypeCodeEntry } from '@/data/types';
import { bytesToAscii, hex } from '@/protocol/bytes';

import type { DetectedModule } from './types';

const IDENTITY_DID_LENGTH = 3;
const IDENTITY_BYTES = 3;
const VIN_LENGTH = 17;
const TYPE_CODE_START = 3;
const TYPE_CODE_END = 7;
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export const probeAddresses = (): number[] => [
  ...new Set(IDENTIFICATION.map((entry) => entry.adrIndex)),
];

export const matchIdentity = (
  address: number,
  response: Uint8Array,
): IdentificationEntry | undefined => {
  if (response.length < IDENTITY_DID_LENGTH + IDENTITY_BYTES) return undefined;

  const code = hex(response.subarray(IDENTITY_DID_LENGTH, IDENTITY_DID_LENGTH + IDENTITY_BYTES))
    .replaceAll(' ', '')
    .toUpperCase();

  return IDENTIFICATION.find((entry) => entry.adrIndex === address && entry.sgbdHex === code);
};

export const toDetectedModule = (entry: IdentificationEntry): DetectedModule => {
  const sgbd = entry.sgbd as ModuleSgbd;

  return { sgbd, address: entry.adrIndex, module: loadModule(sgbd), chassis: entry.chassis };
};

export const parseVin = (response: Uint8Array): string | undefined => {
  const vin = bytesToAscii(
    response.subarray(IDENTITY_DID_LENGTH, IDENTITY_DID_LENGTH + VIN_LENGTH),
  );

  return VIN_PATTERN.test(vin) ? vin : undefined;
};

export const typeCodeOf = (vin: string): string => vin.slice(TYPE_CODE_START, TYPE_CODE_END);

export const lookupVinType = (vin: string): TypeCodeEntry | undefined =>
  loadTypeCodes()[typeCodeOf(vin)];

export const rankChassis = (modules: readonly DetectedModule[]): string[] => {
  const sgbds = modules.map((module) => module.sgbd);
  const scores = new Map<string, number>();

  for (const module of modules) {
    scores.set(module.chassis, (scores.get(module.chassis) ?? 0) + 1);
  }
  for (const [chassis, hints] of Object.entries(SERIES_HINTS)) {
    const covered = sgbds.filter((sgbd) => hints.includes(sgbd)).length;
    if (covered === 0) continue;

    const completeness = covered === sgbds.length ? sgbds.length : 0;
    scores.set(chassis, (scores.get(chassis) ?? 0) + covered + completeness);
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([chassis]) => chassis);
};

export const selectableElementsOf = (sources: ReadonlyMap<ElementId, unknown>): ElementId[] =>
  ELEMENT_IDS.filter((element) => sources.has(element) && categoryOf(element) !== 'cluster');

export const isEffectAvailable = (
  effect: Effect,
  modules: readonly DetectedModule[],
  sources: ReadonlyMap<ElementId, unknown>,
): boolean => {
  const hasModule = effect.requiredModules.some((sgbd) =>
    modules.some((module) => module.sgbd === sgbd),
  );
  const steps = [...effect.steps, ...(effect.offSteps ?? [])];

  return (
    hasModule &&
    (effect.id === 'ghost.fullOFF'
      ? steps.some((step) => sources.has(step.element))
      : steps.every((step) => sources.has(step.element)))
  );
};
