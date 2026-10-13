import type { Effect, ElementId } from '@/data/types';

import type { Preset } from '../preset/types';

export type RunnableItem =
  { kind: 'preset'; preset: Preset } | { kind: 'effect'; effect: Effect; on?: boolean };

export type RunStatus = 'completed' | 'aborted' | 'failed' | 'timeout';

export type CleanupStep =
  'extendedSession' | 'elementOff' | 'returnControl' | 'communication' | 'defaultSession' | 'link';

export interface CleanupFailure {
  sgbd: string;
  step: CleanupStep;
  element?: ElementId;
  error: Error;
}

export interface CleanupReport {
  restored: boolean;
  failures: CleanupFailure[];
}

export interface ExecutionResult {
  status: RunStatus;
  error?: Error;
  skipped: ElementId[];
}

export interface RunResult extends ExecutionResult {
  cleanup: CleanupReport;
}

export type RunnerEvent =
  | { type: 'started'; itemId: string }
  | { type: 'elementSkipped'; element: ElementId }
  | { type: 'tooFast'; rttMs: number; requiredMs: number; availableMs: number }
  | { type: 'clusterFeedbackFailed'; error: Error }
  | { type: 'request'; ecu: number; payload: Uint8Array }
  | { type: 'restoring' }
  | { type: 'restored'; report: CleanupReport };

export const itemIdOf = (item: RunnableItem): string =>
  item.kind === 'preset' ? item.preset.id : item.effect.id;
