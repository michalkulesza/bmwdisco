export type HeadlightType = 'halogen' | 'xenon' | 'led' | 'unknown';
export type FactSource =
  'userSelection' | 'factoryOrder' | 'inferred' | 'physicalConfirmation' | 'simulation';

export interface VehicleFacts {
  headlightType: HeadlightType;
  source?: FactSource;
  vehicleBinding?: string;
  revision?: number;
  assertions?: readonly { value: HeadlightType; source: FactSource; at: number }[];
  conflict?: boolean;
  updatedAt?: number;
  resolvedAt?: number;
}

export interface MappingValidation {
  mappingId: string;
  mappingVersion: number;
  vehicleBinding?: string;
  moduleIdentity?: string;
  equipmentRevision?: number;
  observedOutputs: readonly string[];
  releaseVerified: boolean;
  source?: 'physicalConfirmation' | 'simulation';
  timestamp?: number;
}
