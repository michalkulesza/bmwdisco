import type { ModuleSgbd } from '@/data/generated';
import type { Effect, ElementId, Module } from '@/data/types';
import type { DiagnosticLink } from '@/link/types';

export interface DetectedModule {
  sgbd: ModuleSgbd;
  address: number;
  module: Module;
  chassis: string;
}

export interface ElementTarget {
  module: DetectedModule;
  element: ElementId;
}

export interface DetectedCar {
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
