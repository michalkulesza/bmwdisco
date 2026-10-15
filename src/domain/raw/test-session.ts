import type { DiagnosticLink } from '@/link/types';

import { systemClock, type Clock } from '../clock';

import { outcomeOfError, performRaw } from './exchange';

import type { ExchangeOutcome, ExchangeStage, RawExchange } from './types';
import type { RestoreOptions } from '../runner/cleanup';
import type { ControlLedger } from '../runner/ledger';
import type { CleanupReport } from '../runner/types';

export interface TestUsage {
  touched: Set<number>;
  silenced: Set<number>;
  exchangeCount: number;
}

export const createTestUsage = (): TestUsage => ({
  touched: new Set(),
  silenced: new Set(),
  exchangeCount: 0,
});

export interface TestSessionDeps {
  link: DiagnosticLink;
  ledger: ControlLedger;
  restore: (options: RestoreOptions) => Promise<CleanupReport>;
  usage?: TestUsage;
  clock?: Clock;
  onExchange?: (exchange: RawExchange) => void;
}

export class TestSession {
  private readonly clock: Clock;
  private readonly usage: TestUsage;

  constructor(private readonly deps: TestSessionDeps) {
    this.clock = deps.clock ?? systemClock;
    this.usage = deps.usage ?? createTestUsage();
  }

  get touchedEcus(): number[] {
    return [...this.usage.touched];
  }

  get silencedEcus(): number[] {
    return [...this.usage.silenced];
  }

  async request(ecu: number, payload: Uint8Array, signal?: AbortSignal): Promise<RawExchange> {
    const outcome = await performRaw(this.deps.link, ecu, payload, signal);

    return this.record(ecu, payload, outcome, 'step');
  }

  arm(ecu: number, undo: readonly Uint8Array[] = []): void {
    this.deps.ledger.armRaw(ecu, undo);
    this.usage.touched.add(ecu);
  }

  silence(ecu: number): void {
    this.deps.ledger.silenceRaw(ecu);
    this.usage.silenced.add(ecu);
  }

  wait(ms: number, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(false);

        return;
      }

      const onAbort = () => {
        this.clock.clearTimeout(timer);
        resolve(false);
      };
      const timer = this.clock.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve(true);
      }, ms);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async cleanup(): Promise<CleanupReport> {
    let pending: { ecu: number; request: Uint8Array } | undefined;
    const finish = (outcome: ExchangeOutcome) => {
      if (pending) this.record(pending.ecu, pending.request, outcome, 'cleanup');
      pending = undefined;
    };

    try {
      return await this.deps.restore({
        observer: {
          request: (ecu, request) => {
            pending = { ecu, request };
          },
          response: (_, response) => finish({ kind: 'positive', response }),
          failure: (_, error) => finish(outcomeOfError(error)),
        },
      });
    } catch {
      return { restored: false, failures: [] };
    }
  }

  private record(
    ecu: number,
    request: Uint8Array,
    outcome: ExchangeOutcome,
    stage: ExchangeStage,
  ): RawExchange {
    const exchange: RawExchange = {
      id: ++this.usage.exchangeCount,
      at: this.clock.now(),
      ecu,
      request: request.slice(),
      outcome,
      stage,
    };
    this.deps.onExchange?.(exchange);

    return exchange;
  }
}
