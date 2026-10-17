import type { ModuleSgbd } from '@/data/generated';
import type { Effect, ElementId, Module } from '@/data/types';
import type { DiagnosticLink } from '@/link/types';

import type { MappingValidation, VehicleFacts } from '../vehicle/types';

export interface DetectedModule {
  sgbd: ModuleSgbd;
  /** Actual identification code returned by this ECU, not the module's full candidate list. */
  identity?: string;
  address: number;
  module: Module;
  chassis: string;
}

export interface ElementTarget {
  module: DetectedModule;
  element: ElementId;
}

export interface DetectedCar {
  actionContext?: {
    facts: VehicleFacts;
    validations: readonly MappingValidation[];
    revision: number;
    demo?: boolean;
  };
  vin?: string;
  chassis?: string;
  model?: string;
  chassisCandidates: readonly string[];
  modules: readonly DetectedModule[];
  elementSources: ReadonlyMap<ElementId, readonly DetectedModule[]>;
  elementTargets: ReadonlyMap<ElementId, readonly ElementTarget[]>;
  selectableElements: readonly ElementId[];
  effects: readonly Effect[];
}

export interface LinkProvider {
  readonly link: DiagnosticLink;
  reopen(): Promise<DiagnosticLink>;
}

export interface DetectOptions {
  addresses?: readonly number[];
  probeTimeoutMs?: number;
  signal?: AbortSignal;
}
