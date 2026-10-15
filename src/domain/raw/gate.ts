import type { TestBlockReason } from './types';
import type { SessionPhase } from '../session/phase';

export interface TestGateInput {
  phase: SessionPhase;
  activeToggleId: string | undefined;
  hasPending: boolean;
  testActive: boolean;
}

export const testBlockReason = ({
  phase,
  activeToggleId,
  hasPending,
  testActive,
}: TestGateInput): TestBlockReason | undefined => {
  if (phase === 'running') return 'effectRunning';
  if (phase !== 'ready') return 'notReady';
  if (activeToggleId !== undefined) return 'toggleActive';
  if (hasPending && !testActive) return 'controlPending';

  return undefined;
};
