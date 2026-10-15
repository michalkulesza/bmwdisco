import type { ElementId } from './elements';

export type { ElementCategory, ElementId } from './elements';

export type Bytes = readonly number[];

export interface ElementCommands {
  readonly on: Bytes;
  readonly off: Bytes;
  readonly expectedResponsePrefix?: Bytes;
}

export interface ModuleIdentity {
  readonly sgbdHex: string;
  readonly response: Bytes;
  readonly chassis: string;
}

export interface Module {
  readonly sgbd: string;
  readonly address: number;
  readonly protocol: 'uds';
  readonly identity: readonly ModuleIdentity[];
  readonly keepalive: Bytes;
  readonly returnControl: readonly Bytes[];
  readonly elements: Readonly<Partial<Record<ElementId, ElementCommands>>>;
  readonly commands: Readonly<Record<string, Bytes>>;
}

export type EffectKind = 'oneShot' | 'toggle';

export interface EffectStep {
  readonly element: ElementId;
  readonly on: boolean;
}

export interface Effect {
  readonly id: string;
  readonly pack: string;
  readonly nameKey: string;
  readonly sectionKey?: string;
  readonly kind: EffectKind;
  readonly steps: readonly EffectStep[];
  readonly offSteps?: readonly EffectStep[];
  readonly clusterFeedback: boolean;
  readonly silenceCommunication: boolean;
  readonly requiredModules: readonly string[];
}

export interface IdentificationEntry {
  readonly adrIndex: number;
  readonly sgbdHex: string;
  readonly sgbd: string;
  readonly chassis: string;
}

export interface VehicleModel {
  readonly name: string;
  readonly engine: string;
  readonly body: string;
}

export interface VehicleSeries {
  readonly series: string;
  readonly code: string;
  readonly models: readonly VehicleModel[];
}

export interface TypeCodeEntry {
  readonly code: string;
  readonly model: string;
}
