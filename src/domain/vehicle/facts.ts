import type { MappingValidation, VehicleFacts } from './types';
import type { DetectedModule } from '../registry/types';

export const UNKNOWN_VEHICLE_FACTS: VehicleFacts = { headlightType: 'unknown' };

export const moduleIdentityOf = (module: DetectedModule): string =>
  `${module.sgbd}:${module.address}:${module.identity ?? 'unknown'}`;

export const validationApplies = (
  validation: MappingValidation,
  binding: string | undefined,
  moduleIdentity: string | undefined,
  equipmentRevision: number | undefined,
): boolean =>
  Boolean(binding && moduleIdentity) &&
  equipmentRevision !== undefined &&
  validation.releaseVerified &&
  validation.vehicleBinding === binding &&
  validation.moduleIdentity === moduleIdentity &&
  validation.equipmentRevision === equipmentRevision;
