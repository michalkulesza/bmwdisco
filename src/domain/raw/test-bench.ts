import { phaseOf } from '../session/phase';

import { testBlockReason } from './gate';
import { runTestGroup, type GroupResult, type TestGroup } from './group-runner';
import { requiresConfirmation, silencesCommunication } from './services';
import { createTestUsage, TestSession, type TestUsage } from './test-session';

import type { Clock } from '../clock';
import type { RawExchange, TestBlockReason } from './types';
import type { SessionActor } from '../session/machine';
import type { SessionPhase } from '../session/phase';

export type BenchResult = { status: 'blocked'; reason: TestBlockReason | 'busy' } | GroupResult;

export type RawSendResult =
  | { status: 'blocked'; reason: TestBlockReason | 'busy' }
  | { status: 'sent'; exchange: RawExchange };

export type TestBenchHost = Pick<SessionActor, 'getSnapshot' | 'send'>;

export interface TestBenchOptions {
  host: TestBenchHost;
  onExchange?: (exchange: RawExchange) => void;
  onHeldChange?: (held: boolean) => void;
  clock?: Clock;
}

export class TestBench {
  readonly usage: TestUsage = createTestUsage();
  private active?: Promise<unknown>;
  private abortController?: AbortController;
  private held = false;

  constructor(private readonly options: TestBenchOptions) {}

  get isHeld(): boolean {
    return this.held;
  }

  get isBusy(): boolean {
    return this.active !== undefined;
  }

  runGroup(group: TestGroup): Promise<BenchResult> {
    return this.exclusive<BenchResult>(async () => {
      const session = this.begin();
      if (typeof session === 'string') return { status: 'blocked', reason: session };

      const controller = new AbortController();
      this.abortController = controller;
      try {
        return await runTestGroup(session, group, controller.signal);
      } finally {
        this.abortController = undefined;
        this.setHeld(false);
        this.end();
      }
    });
  }

  sendRaw(ecu: number, payload: Uint8Array): Promise<RawSendResult> {
    return this.exclusive<RawSendResult>(async () => {
      const session = this.begin();
      if (typeof session === 'string') return { status: 'blocked', reason: session };

      const risky = requiresConfirmation(payload);
      if (risky) {
        session.arm(ecu);
        if (silencesCommunication(payload)) session.silence(ecu);
        this.setHeld(true);
      }

      const exchange = await session.request(ecu, payload);
      if (!this.held) this.end();

      return { status: 'sent', exchange };
    });
  }

  abort(): void {
    this.abortController?.abort();
  }

  async release(): Promise<GroupResult | undefined> {
    this.abort();
    await this.active?.catch(() => undefined);
    if (!this.held) return undefined;

    const result = await this.runGroup(async () => undefined);
    if (result.status !== 'blocked') return result;

    this.setHeld(false);

    return undefined;
  }

  notifyPhase(phase: SessionPhase): void {
    if (phase === 'ready') return;

    this.abort();
    this.setHeld(false);
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T | { status: 'blocked'; reason: 'busy' }> {
    if (this.active) return Promise.resolve({ status: 'blocked', reason: 'busy' });

    const running = task();
    this.active = running;
    const clear = () => {
      this.active = undefined;
    };
    running.then(clear, clear);

    return running;
  }

  private setHeld(held: boolean): void {
    if (this.held === held) return;

    this.held = held;
    this.options.onHeldChange?.(held);
  }

  private begin(): TestSession | TestBlockReason {
    const { host } = this.options;
    const snapshot = host.getSnapshot();
    const { context } = snapshot;
    const reason = testBlockReason({
      phase: phaseOf(snapshot),
      activeToggleId: context.activeToggleId,
      hasPending: context.ledger.hasPending,
      testActive: context.testActive,
    });
    if (reason) return reason;

    const { link, runner } = context;
    if (!link || !runner) return 'notReady';

    host.send({ type: 'TEST_BEGIN' });

    return new TestSession({
      link,
      ledger: context.ledger,
      restore: (restoreOptions) => runner.restore(restoreOptions),
      usage: this.usage,
      clock: this.options.clock,
      onExchange: this.options.onExchange,
    });
  }

  private end(): void {
    this.options.host.send({ type: 'TEST_END' });
  }
}
