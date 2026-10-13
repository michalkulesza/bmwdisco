import { loadModule } from '@/data/generated';
import type { ElementId, Module } from '@/data/types';
import { asciiToBytes } from '@/protocol/bytes';
import type { Unsubscribe } from '@/transport/types';

import { deadOutputsOf } from './dead-outputs';
import { FaultInjector } from './faults';
import { createProfile, type VehicleProfile } from './profiles';
import { SimulatedModule } from './simulated-module';
import { makeVin } from './vin';

const MAX_LOG_ENTRIES = 1000;
const DEFAULT_SEED = 1;

export interface LitElement {
  sgbd: string;
  element: ElementId;
}

export interface RequestLogEntry {
  ecu: number;
  request: Uint8Array;
  response: Uint8Array | null;
  at: number;
}

export interface SimulatedVehicleOptions {
  profile: VehicleProfile | string;
  seed?: number;
}

export type LitListener = (lit: readonly LitElement[]) => void;

const identityFor = (module: Module, chassis: string) =>
  (module.identity.find((entry) => entry.chassis === chassis) ?? module.identity[0]!).response;

export class SimulatedVehicle {
  readonly profile: VehicleProfile;
  readonly vin: string;
  readonly faults: FaultInjector;
  private readonly modules = new Map<number, SimulatedModule>();
  private readonly listeners = new Set<LitListener>();
  private log: RequestLogEntry[] = [];

  constructor({ profile, seed = DEFAULT_SEED }: SimulatedVehicleOptions) {
    this.profile = typeof profile === 'string' ? createProfile(profile) : profile;
    this.vin = makeVin(this.profile.chassis);
    this.faults = new FaultInjector(seed);

    const vin = asciiToBytes(this.vin);
    for (const sgbd of this.profile.modules) {
      const module = loadModule(sgbd);
      const simulated = new SimulatedModule(
        module,
        identityFor(module, this.profile.chassis),
        vin,
        () => this.notify(),
        deadOutputsOf(sgbd, this.profile.modules),
      );
      this.modules.set(module.address, simulated);
    }
  }

  get requestLog(): readonly RequestLogEntry[] {
    return this.log;
  }

  clearLog(): void {
    this.log = [];
  }

  handle(ecu: number, request: Uint8Array): Uint8Array | null {
    const response = this.modules.get(ecu)?.respond(request) ?? null;
    this.record({ ecu, request: request.slice(), response, at: Date.now() });

    return response;
  }

  getLitElements(): LitElement[] {
    return [...this.modules.values()].flatMap((simulated) =>
      simulated.litElements.map((element) => ({ sgbd: simulated.module.sgbd, element })),
    );
  }

  onStateChange(listener: LitListener): Unsubscribe {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private record(entry: RequestLogEntry): void {
    this.log.push(entry);
    if (this.log.length > MAX_LOG_ENTRIES) this.log.shift();
  }

  private notify(): void {
    const lit = this.getLitElements();
    for (const listener of [...this.listeners]) listener(lit);
  }
}
