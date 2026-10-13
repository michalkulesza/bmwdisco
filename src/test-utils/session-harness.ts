import type { AdapterConfig } from '@/domain/adapter/create-link';
import { createSessionActor } from '@/domain/session/create-session-actor';
import type { SessionActor } from '@/domain/session/machine';
import { phaseOf, type SessionPhase } from '@/domain/session/phase';
import type { SessionContext, SessionDeps } from '@/domain/session/types';
import { SimLink } from '@/link/sim-link';
import type { SimulatedVehicle } from '@/simulator/simulated-vehicle';

import { advanceUntil, FakeAppState, PROBE_TIMEOUT_MS } from './domain-sim';

export const DEMO_CONFIG: AdapterConfig = { adapter: 'demo', chassis: 'F20' };

export interface SessionRig {
  actor: SessionActor;
  appState: FakeAppState;
  vehicle: SimulatedVehicle;
  availability: { linkAvailable: boolean };
  phase(): SessionPhase;
  context(): SessionContext;
  waitFor(phase: SessionPhase | SessionPhase[]): Promise<void>;
  links: SimLink[];
}

export const createRig = (
  vehicle: SimulatedVehicle,
  overrides: Partial<SessionDeps> = {},
): SessionRig => {
  const appState = new FakeAppState();
  const availability = { linkAvailable: true };
  const links: SimLink[] = [];
  const deps: SessionDeps = {
    createLink: async () => {
      if (!availability.linkAvailable) throw new Error('adapter unreachable');

      const link = new SimLink(vehicle);
      links.push(link);

      return link;
    },
    appState,
    probeTimeoutMs: PROBE_TIMEOUT_MS,
    ...overrides,
  };
  const actor = createSessionActor(deps);
  actor.start();

  const phase = () => phaseOf(actor.getSnapshot());
  const waitFor = (target: SessionPhase | SessionPhase[]) => {
    const targets = Array.isArray(target) ? target : [target];

    return advanceUntil(() => targets.includes(phase()), 5, 200_000);
  };

  return {
    actor,
    appState,
    vehicle,
    availability,
    links,
    phase,
    context: () => actor.getSnapshot().context,
    waitFor,
  };
};
