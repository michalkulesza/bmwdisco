import { createLinkProvider, detectCar } from '@/domain/registry/detect-car';
import type { DetectedCar } from '@/domain/registry/types';
import type { AppStateSource, AppStateStatus, SessionDeps } from '@/domain/session/types';
import { SimLink } from '@/link/sim-link';
import type { DiagnosticLink } from '@/link/types';
import { hex } from '@/protocol/bytes';
import type { FaultOptions } from '@/simulator/faults';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';

export const PROBE_TIMEOUT_MS = 30;

export const makeVehicle = (chassis: string, faults?: FaultOptions, seed = 1): SimulatedVehicle => {
  const vehicle = new SimulatedVehicle({ profile: chassis, seed });
  if (faults) vehicle.faults.configure(faults);

  return vehicle;
};

export class FakeAppState implements AppStateSource {
  private readonly listeners = new Set<(status: AppStateStatus) => void>();

  subscribe(listener: (status: AppStateStatus) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(status: AppStateStatus): void {
    for (const listener of [...this.listeners]) listener(status);
  }
}

export const openSimLink = async (vehicle: SimulatedVehicle): Promise<SimLink> => {
  const link = new SimLink(vehicle);
  await link.open();

  return link;
};

export const detectOnSim = async (
  vehicle: SimulatedVehicle,
): Promise<{ link: DiagnosticLink; car: DetectedCar }> => {
  const provider = createLinkProvider(await openSimLink(vehicle), () => openSimLink(vehicle));
  const car = await detectCar(provider, { probeTimeoutMs: PROBE_TIMEOUT_MS });

  return { link: provider.link, car };
};

export const simSessionDeps = (
  vehicle: SimulatedVehicle,
  appState: AppStateSource = new FakeAppState(),
  overrides: Partial<SessionDeps> = {},
): SessionDeps => ({
  createLink: async () => new SimLink(vehicle),
  appState,
  probeTimeoutMs: PROBE_TIMEOUT_MS,
  ...overrides,
});

export const litIds = (vehicle: SimulatedVehicle): string[] =>
  vehicle.getLitElements().map((lit) => `${lit.sgbd}:${lit.element}`);

export const settle = async <T>(promise: Promise<T>, stepMs = 5, maxMs = 400_000): Promise<T> => {
  let finished = false;
  const guarded = promise.finally(() => {
    finished = true;
  });
  guarded.catch(() => undefined);

  for (let elapsed = 0; elapsed < maxMs && !finished; elapsed += stepMs) {
    await jest.advanceTimersByTimeAsync(stepMs);
  }

  return promise;
};

export const advanceUntil = async (
  predicate: () => boolean,
  stepMs = 5,
  maxMs = 400_000,
): Promise<void> => {
  for (let elapsed = 0; elapsed < maxMs && !predicate(); elapsed += stepMs) {
    await jest.advanceTimersByTimeAsync(stepMs);
  }
  if (!predicate()) throw new Error('condition not reached');
};

export const wireLog = (vehicle: SimulatedVehicle): string[] =>
  vehicle.requestLog.map(
    (entry) => `${entry.ecu.toString(16)}:${hex(entry.request).replaceAll(' ', '').toLowerCase()}`,
  );

export const NRC_SERVICE_NOT_SUPPORTED_IN_SESSION = 0x7f;
