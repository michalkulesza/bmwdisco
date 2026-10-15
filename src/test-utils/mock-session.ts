import { jest } from '@jest/globals';

import { ELEMENT_IDS, type ElementId } from '@/data/elements';
import { loadEffects } from '@/data/generated';
import type { DetectedCar, SessionPhase, TileStatus } from '@/domain';

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
): DetectedCar => ({
  chassisCandidates: ['F32'],
  modules: [],
  elementSources: new Map(),
  elementTargets: new Map(),
  selectableElements,
  effects: loadEffects().filter((effect) => !effectIds || effectIds.includes(effect.id)),
});

export const sessionModule = {
  useSessionSelector: <T>(selector: (snapshot: { context: MockSessionState }) => T): T =>
    selector({ context: sessionState }),
  useSessionPhase: () => sessionState.phase,
  useSessionActions: () => sessionActions,
};
