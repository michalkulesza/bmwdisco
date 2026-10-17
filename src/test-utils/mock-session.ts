import { jest } from '@jest/globals';

import { ELEMENT_IDS, type ElementId } from '@/data/elements';
import { loadEffects, loadModule } from '@/data/generated';
import type { DetectedCar, DetectedModule, SessionPhase, TileStatus } from '@/domain';
import { buildElementTargets, sourcesOf } from '@/domain/registry/targets';

interface MockSessionState {
  phase: SessionPhase;
  tiles: Record<string, TileStatus>;
  activeToggleId: string | undefined;
  runningItemId: string | undefined;
  car: DetectedCar | undefined;
}

const initialState = (): MockSessionState => ({
  phase: 'ready',
  tiles: {},
  activeToggleId: undefined,
  runningItemId: undefined,
  car: undefined,
});

export const sessionState: MockSessionState = initialState();

export const sessionActions = {
  setVehicleFacts: jest.fn(),
  connect: jest.fn(),
  cancel: jest.fn(),
  disconnect: jest.fn(),
  run: jest.fn(),
  stop: jest.fn(),
  toggle: jest.fn(),
};

export const resetSession = () => {
  Object.assign(sessionState, initialState());
  Object.values(sessionActions).forEach((action) => action.mockClear());
};

export const fakeCar = (
  effectIds?: readonly string[],
  selectableElements: readonly ElementId[] = ELEMENT_IDS,
): DetectedCar => {
  const modules: DetectedModule[] = (['FEM_20', 'REM_20', 'KOMB25'] as const).map((sgbd) => ({
    sgbd,
    module: loadModule(sgbd),
    chassis: 'F20',
    address: loadModule(sgbd).address,
  }));
  const effects = loadEffects().filter((effect) => !effectIds || effectIds.includes(effect.id));
  const requiredElements =
    effectIds &&
    new Set(
      effects.flatMap((effect) =>
        [...effect.steps, ...(effect.offSteps ?? [])].map((step) => step.element),
      ),
    );
  const elementTargets = buildElementTargets(modules);
  if (requiredElements)
    for (const element of elementTargets.keys()) {
      if (!requiredElements.has(element)) elementTargets.delete(element);
    }
  return {
    chassisCandidates: ['F32'],
    modules,
    elementSources: sourcesOf(elementTargets),
    elementTargets,
    selectableElements,
    effects,
  };
};

export const sessionModule = {
  useSessionSelector: <T>(selector: (snapshot: { context: MockSessionState }) => T): T =>
    selector({ context: sessionState }),
  useSessionPhase: () => sessionState.phase,
  useSessionActions: () => sessionActions,
};
