import type { Effect } from '@/data/types';
import { hex } from '@/protocol/bytes';

import { classifyRunError } from '../runner/classify';
import {
  itemIdOf,
  type ExecutionResult,
  type RunnableItem,
  type RunnerEvent,
} from '../runner/types';

import type { LogEntry, RunInput, RunnerNotice, SessionContext, TileStatus } from './types';
import type { DetectedCar } from '../registry/types';

export const MAX_RECONNECT_ATTEMPTS = 3;
export const MAX_RESTORE_FAILURES = 2;
export const RECONNECT_BASE_DELAY_MS = 500;
export const KEEPALIVE_INTERVAL_MS = 2000;
export const JUST_RAN_MS = 1500;
export const LOG_CAPACITY = 300;

export const backoffMs = (attempt: number, baseMs: number = RECONNECT_BASE_DELAY_MS): number =>
  baseMs * 2 ** attempt;

export const isEffect = (input: RunInput): input is Effect => 'nameKey' in input;

export const toRunnable = (input: RunInput, on?: boolean): RunnableItem =>
  isEffect(input) ? { kind: 'effect', effect: input, on } : { kind: 'preset', preset: input };

export const findToggle = (car: DetectedCar | undefined, effectId: string): Effect | undefined =>
  car?.effects.find((effect) => effect.id === effectId && effect.kind === 'toggle');

export const appendLog = (context: SessionContext, message: string): LogEntry[] => {
  if (!context.deps.debug) return context.log;

  const at = (context.deps.clock?.now ?? Date.now)();

  return [...context.log, { at, message }].slice(-LOG_CAPACITY);
};

export const describeRunnerEvent = (event: RunnerEvent): string => {
  switch (event.type) {
    case 'started':
      return `run ${event.itemId}`;
    case 'elementSkipped':
      return `skipped ${event.element}`;
    case 'tooFast':
      return `faster than adapter: needs ${event.requiredMs} ms`;
    case 'clusterFeedbackFailed':
      return `cluster feedback failed: ${event.error.message}`;
    case 'request':
      return `-> ${event.ecu.toString(16)} ${hex(event.payload)}`;
    case 'restoring':
      return 'restoring';
    case 'restored':
      return `restored=${event.report.restored}`;
  }
};

export const noticeOf = (event: RunnerEvent): RunnerNotice | undefined => {
  switch (event.type) {
    case 'elementSkipped':
      return { type: 'elementSkipped', element: event.element };
    case 'tooFast':
      return {
        type: 'tooFast',
        rttMs: event.rttMs,
        requiredMs: event.requiredMs,
        availableMs: event.availableMs,
      };
    case 'clusterFeedbackFailed':
      return { type: 'clusterFeedbackFailed', message: event.error.message };
    default:
      return undefined;
  }
};

export const isToggleItem = (
  item: RunnableItem | undefined,
): item is RunnableItem & { kind: 'effect' } =>
  item?.kind === 'effect' && item.effect.kind === 'toggle';

export const withTile = (
  tiles: SessionContext['tiles'],
  id: string,
  status: TileStatus | undefined,
): SessionContext['tiles'] => {
  const rest = Object.fromEntries(Object.entries(tiles).filter(([key]) => key !== id));

  return status ? { ...rest, [id]: status } : rest;
};

export const clearJustRan = (tiles: SessionContext['tiles']): SessionContext['tiles'] =>
  Object.fromEntries(Object.entries(tiles).filter(([, tile]) => tile.state !== 'justRan'));

export const tileForResult = (
  item: RunnableItem,
  result: ExecutionResult,
): TileStatus | undefined => {
  if (result.status === 'completed') return isToggleItem(item) ? undefined : { state: 'justRan' };
  if (result.status === 'aborted') return undefined;
  if (result.status === 'timeout') return { state: 'error', reason: 'limitExceeded' };

  return { state: 'error', reason: classifyRunError(result.error) };
};

export const togglesAfter = (
  active: readonly string[],
  item: RunnableItem,
  result: ExecutionResult,
): string[] => {
  if (!isToggleItem(item) || result.status !== 'completed') return [...active];

  const id = itemIdOf(item);
  const without = active.filter((candidate) => candidate !== id);

  return (item.on ?? true) ? [...without, id] : without;
};
