import type { TestBlockReason } from './types';
import type { SessionPhase } from '../session/phase';

export interface TestGateInput {
  phase: SessionPhase;
  activeToggles: readonly string[];
  hasPending: boolean;
  testActive: boolean;
}

export const testBlockReason = ({
  phase,
  activeToggles,
  hasPending,
  testActive,
}: TestGateInput): TestBlockReason | undefined => {
  if (phase === 'running') return 'effectRunning';
  if (phase !== 'ready') return 'notReady';
  if (activeToggles.length > 0) return 'toggleActive';
  if (hasPending && !testActive) return 'controlPending';

  return undefined;
};
