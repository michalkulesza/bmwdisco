import { toError } from '@/protocol/errors';

import type { TestSession } from './test-session';
import type { RawExchange } from './types';
import type { CleanupReport } from '../runner/types';

export type GroupStatus = 'completed' | 'failed' | 'aborted';

export type GroupFailure =
  { kind: 'step'; exchange: RawExchange } | { kind: 'error'; code: string; message?: string };

export interface GroupResult {
  status: GroupStatus;
  exchanges: RawExchange[];
  cleanup: CleanupReport;
  failure?: GroupFailure;
}

export interface StepOptions {
  tolerate?: boolean;
  essential?: boolean;
}

export interface GroupContext {
  send(ecu: number, payload: ArrayLike<number>, options?: StepOptions): Promise<RawExchange>;
  wait(ms: number): Promise<void>;
  arm(ecu: number, undo?: readonly ArrayLike<number>[]): void;
  silence(ecu: number): void;
}

export type TestGroup = (context: GroupContext) => Promise<void>;

export class StepFailedError extends Error {
  constructor(public readonly exchange: RawExchange) {
    super('Step failed');
    this.name = 'StepFailedError';
  }
}

export class GroupAbortedError extends Error {
  constructor() {
    super('Test aborted');
    this.name = 'GroupAbortedError';
  }
}

export class GroupFailedError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'GroupFailedError';
  }
}

const toBytes = (payload: ArrayLike<number>): Uint8Array => Uint8Array.from(payload);

const failureOf = (error: unknown): GroupFailure => {
  if (error instanceof StepFailedError) return { kind: 'step', exchange: error.exchange };
  if (error instanceof GroupFailedError) return { kind: 'error', code: error.code };

  return { kind: 'error', code: 'unexpected', message: toError(error).message };
};

export const runTestGroup = async (
  session: TestSession,
  group: TestGroup,
  signal: AbortSignal,
): Promise<GroupResult> => {
  const exchanges: RawExchange[] = [];
  const context: GroupContext = {
    send: async (ecu, payload, { tolerate = false, essential = false } = {}) => {
      if (signal.aborted && !essential) throw new GroupAbortedError();

      const exchange = await session.request(ecu, toBytes(payload), essential ? undefined : signal);
      exchanges.push(exchange);
      if (signal.aborted && !essential) throw new GroupAbortedError();
      if (exchange.outcome.kind !== 'positive' && !tolerate) throw new StepFailedError(exchange);

      return exchange;
    },
    wait: async (ms) => {
      if (!(await session.wait(ms, signal))) throw new GroupAbortedError();
    },
    arm: (ecu, undo = []) => session.arm(ecu, undo.map(toBytes)),
    silence: (ecu) => session.silence(ecu),
  };

  let status: GroupStatus = 'completed';
  let failure: GroupFailure | undefined;
  let cleanup: CleanupReport;

  try {
    await group(context);
  } catch (error) {
    status = error instanceof GroupAbortedError ? 'aborted' : 'failed';
    if (status === 'failed') failure = failureOf(error);
  } finally {
    cleanup = await session.cleanup();
  }

  return { status, exchanges, cleanup, failure };
};
