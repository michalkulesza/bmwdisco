import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DetectedCar } from '@/domain/registry/types';
import type {
  FactSource,
  HeadlightType,
  MappingValidation,
  VehicleFacts,
} from '@/domain/vehicle/types';

import { kvStorage } from './kv-storage';

export interface VehicleFactsProfile {
  facts: VehicleFacts;
  validations: readonly MappingValidation[];
}

type StoredProfile = VehicleFactsProfile;
type SessionProfiles = { demo: StoredProfile | null; unbound: StoredProfile | null };
type VehicleFactsState = {
  byVin: Record<string, StoredProfile>;
  sessionProfiles: SessionProfiles;
  getProfile: (car: Pick<DetectedCar, 'vin'>, isDemo?: boolean) => VehicleFactsProfile;
  saveReadyProfile: (
    car: Pick<DetectedCar, 'vin'>,
    profile: VehicleFactsProfile,
    isDemo?: boolean,
  ) => void;
  recordReadyFacts: (
    car: Pick<DetectedCar, 'vin'>,
    facts: VehicleFacts,
    validations: readonly MappingValidation[],
    isDemo?: boolean,
  ) => void;
  clearSessionProfile: () => void;
};

const EMPTY_PROFILE: VehicleFactsProfile = { facts: { headlightType: 'unknown' }, validations: [] };
const HEADLIGHT_TYPES: readonly HeadlightType[] = ['halogen', 'xenon', 'led', 'unknown'];
const FACT_SOURCES: readonly FactSource[] = [
  'userSelection',
  'factoryOrder',
  'inferred',
  'physicalConfirmation',
  'simulation',
];
const isHeadlightType = (value: unknown): value is HeadlightType =>
  HEADLIGHT_TYPES.includes(value as HeadlightType);
const isVin = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-HJ-NPR-Z0-9]{17}$/i.test(value);
const hasOnlyKeys = (value: object, allowed: readonly string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

const validFacts = (value: unknown): value is VehicleFacts => {
  if (!value || typeof value !== 'object') return false;
  const facts = value as Partial<VehicleFacts>;
  return (
    hasOnlyKeys(value, [
      'headlightType',
      'source',
      'vehicleBinding',
      'revision',
      'assertions',
      'conflict',
      'updatedAt',
      'resolvedAt',
    ]) &&
    isHeadlightType(facts.headlightType) &&
    (facts.source === undefined || FACT_SOURCES.includes(facts.source)) &&
    (facts.vehicleBinding === undefined || typeof facts.vehicleBinding === 'string') &&
    (facts.revision === undefined || (Number.isInteger(facts.revision) && facts.revision >= 0)) &&
    (facts.resolvedAt === undefined || Number.isFinite(facts.resolvedAt)) &&
    (facts.updatedAt === undefined || Number.isFinite(facts.updatedAt)) &&
    (facts.assertions === undefined ||
      (Array.isArray(facts.assertions) &&
        facts.assertions.every(
          (assertion) =>
            !!assertion &&
            hasOnlyKeys(assertion, ['value', 'source', 'at']) &&
            isHeadlightType(assertion.value) &&
            FACT_SOURCES.includes(assertion.source) &&
            Number.isFinite(assertion.at),
        ))) &&
    (facts.conflict === undefined || typeof facts.conflict === 'boolean')
  );
};

const validValidation = (value: unknown): value is MappingValidation => {
  if (!value || typeof value !== 'object') return false;
  const validation = value as Partial<MappingValidation>;
  return (
    hasOnlyKeys(value, [
      'mappingId',
      'mappingVersion',
      'vehicleBinding',
      'moduleIdentity',
      'equipmentRevision',
      'observedOutputs',
      'releaseVerified',
      'source',
      'timestamp',
    ]) &&
    typeof validation.mappingId === 'string' &&
    validation.mappingId.length > 0 &&
    Number.isInteger(validation.mappingVersion) &&
    Array.isArray(validation.observedOutputs) &&
    validation.observedOutputs.every((output) => typeof output === 'string') &&
    (validation.vehicleBinding === undefined || typeof validation.vehicleBinding === 'string') &&
    (validation.moduleIdentity === undefined || typeof validation.moduleIdentity === 'string') &&
    (validation.equipmentRevision === undefined ||
      Number.isInteger(validation.equipmentRevision)) &&
    typeof validation.releaseVerified === 'boolean' &&
    (validation.timestamp === undefined || Number.isFinite(validation.timestamp)) &&
    (validation.source === undefined ||
      validation.source === 'physicalConfirmation' ||
      validation.source === 'simulation')
  );
};

const hasSessionBinding = (profile: StoredProfile, vin: string) =>
  (Boolean(profile.facts.vehicleBinding) && profile.facts.vehicleBinding !== vin) ||
  profile.validations.some(
    (validation) => Boolean(validation.vehicleBinding) && validation.vehicleBinding !== vin,
  );

const validProfile = (value: unknown): value is StoredProfile => {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<StoredProfile>;
  return (
    hasOnlyKeys(value, ['facts', 'validations']) &&
    validFacts(profile.facts) &&
    Array.isArray(profile.validations) &&
    profile.validations.every(validValidation)
  );
};

const mergeAssertion = (prior: VehicleFacts, value: HeadlightType, at: number): VehicleFacts => {
  const previousAssertions =
    prior.assertions ??
    (prior.headlightType === 'unknown'
      ? []
      : [
          {
            value: prior.headlightType,
            source: prior.source ?? 'inferred',
            at: prior.updatedAt ?? at - 1,
          },
        ]);
  const assertions = [...previousAssertions, { value, source: 'userSelection' as const, at }];
  const conflict = assertions
    .filter((assertion) => assertion.at >= (prior.resolvedAt ?? -Infinity))
    .some((assertion) => assertion.value !== 'unknown' && assertion.value !== value);
  return {
    headlightType: value,
    source: 'userSelection',
    vehicleBinding: prior.vehicleBinding,
    revision: (prior.revision ?? 0) + 1,
    assertions,
    conflict: prior.conflict === true || conflict,
    updatedAt: at,
    ...(prior.resolvedAt === undefined ? {} : { resolvedAt: prior.resolvedAt }),
  };
};

export const selectHeadlightType = (
  prior: VehicleFacts,
  value: HeadlightType,
  at = Date.now(),
): VehicleFacts => mergeAssertion(prior, value, at);

/** Confirms fitted equipment only; this does not validate any physical light command. */
export const resolveEquipmentConflict = (prior: VehicleFacts, at = Date.now()): VehicleFacts => ({
  ...prior,
  source: 'userSelection',
  revision: (prior.revision ?? 0) + 1,
  assertions: [
    ...(prior.assertions ?? []),
    { value: prior.headlightType, source: 'userSelection', at },
  ],
  conflict: false,
  updatedAt: at,
  resolvedAt: at,
});

const profileFor = (
  state: Pick<VehicleFactsState, 'byVin' | 'sessionProfiles'>,
  vin: unknown,
  isDemo: boolean,
) =>
  !isDemo && isVin(vin)
    ? (state.byVin[vin.toUpperCase()] ?? EMPTY_PROFILE)
    : (state.sessionProfiles[isDemo ? 'demo' : 'unbound'] ?? EMPTY_PROFILE);

export const useVehicleFactsStore = create<VehicleFactsState>()(
  persist(
    (set, get) => ({
      byVin: {},
      sessionProfiles: { demo: null, unbound: null },
      getProfile: (car, isDemo = false) => profileFor(get(), car.vin, isDemo),
      saveReadyProfile: (car, profile, isDemo = false) => {
        if (!validProfile(profile)) return;
        if (!isDemo && isVin(car.vin) && !hasSessionBinding(profile, car.vin.toUpperCase()))
          set((state) => ({ byVin: { ...state.byVin, [car.vin!.toUpperCase()]: profile } }));
        else
          set((state) => ({
            sessionProfiles: { ...state.sessionProfiles, [isDemo ? 'demo' : 'unbound']: profile },
          }));
      },
      recordReadyFacts: (car, facts, validations, isDemo = false) => {
        const profile = { facts, validations };
        if (!validProfile(profile)) return;
        if (!isDemo && isVin(car.vin) && !hasSessionBinding(profile, car.vin.toUpperCase()))
          set((state) => ({ byVin: { ...state.byVin, [car.vin!.toUpperCase()]: profile } }));
        else
          set((state) => ({
            sessionProfiles: { ...state.sessionProfiles, [isDemo ? 'demo' : 'unbound']: profile },
          }));
      },
      clearSessionProfile: () => set({ sessionProfiles: { demo: null, unbound: null } }),
    }),
    {
      name: 'vehicle-facts',
      version: 1,
      storage: kvStorage,
      partialize: ({ byVin }) => ({ byVin }),
      merge: (persisted, current) => {
        const raw = (persisted as { byVin?: unknown } | undefined)?.byVin;
        const byVin: Record<string, StoredProfile> = {};
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          for (const [vin, profile] of Object.entries(raw)) {
            if (
              isVin(vin) &&
              validProfile(profile) &&
              !hasSessionBinding(profile, vin.toUpperCase())
            )
              byVin[vin.toUpperCase()] = profile;
          }
        }
        return { ...current, byVin, sessionProfiles: { demo: null, unbound: null } };
      },
    },
  ),
);
