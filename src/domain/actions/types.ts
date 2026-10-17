import type { ElementId } from '@/data/elements';

import type { DetectedCar, ElementTarget } from '../registry/types';
import type { MappingValidation, VehicleFacts } from '../vehicle/types';

export const LOGICAL_ACTION_IDS = [
  'indicatorsLeft',
  'indicatorsRight',
  'bothHighBeams',
  'highBeamLeft',
  'highBeamRight',
  'lowBeamLeft',
  'lowBeamRight',
  'bothLowBeams',
  'corneringLeft',
  'corneringRight',
  'brakesAll',
  'biXenonShutterBoth',
] as const;
export type LogicalActionId = (typeof LOGICAL_ACTION_IDS)[number];
export const isLogicalActionId = (value: string): value is LogicalActionId =>
  (LOGICAL_ACTION_IDS as readonly string[]).includes(value);

export interface ResolutionContext {
  car: DetectedCar;
  facts?: VehicleFacts;
  validations?: readonly MappingValidation[];
  revision?: number;
  demo?: boolean;
}
export type ActionWarning = 'legacyLedMayNotLight' | 'compatibilityBehavior' | 'simulationOnly';
export type ActionResolution =
  | {
      status: 'supported';
      mappingId: string;
      targets: readonly ElementTarget[];
      evidence: 'existingCompatibility' | 'hardwareVerified' | 'simulation';
      warnings: readonly ActionWarning[];
    }
  | {
      status: 'unknown';
      reason: 'equipmentUnknown' | 'equipmentConflict' | 'confirmationRequired';
      candidateMappingIds: readonly string[];
    }
  | {
      status: 'unsupported';
      reason: 'missingModule' | 'missingOutput' | 'noSemanticMapping' | 'commandRejected';
    };
export interface ResolvedExecutionStep {
  atMs: number;
  state: 'on' | 'off';
  targets: readonly ElementTarget[];
}
export interface RunnableAssessment {
  status: 'runnable' | 'partial' | 'needsConfirmation' | 'unsupported';
  revision: number;
  steps: readonly ResolvedExecutionStep[];
  endMs: number;
  resolutions: readonly ActionResolution[];
  missing: readonly (ActionResolution & { intent: LogicalActionId | ElementId })[];
  warnings: readonly ActionWarning[];
}
