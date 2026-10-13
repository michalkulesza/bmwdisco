import {
  AdapterError,
  LinkClosedError,
  NegativeResponseError,
  abortReason,
} from '@/protocol/errors';
import { Nrc } from '@/protocol/nrc';
import type { RequestOptions } from '@/protocol/types';
import { matchUdsResponse } from '@/protocol/uds';
import type { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import type { Transport } from '@/transport/types';

import { BaseLink, type ExchangeContext } from './base-link';

export const DEMO_ADAPTER_ID = 'demo';

const NEGATIVE_SID = 0x7f;
const NO_RESPONSE = new Uint8Array();
const noop = () => undefined;

const IDLE_TRANSPORT: Transport = {
  open: async () => undefined,
  close: async () => undefined,
  write: async () => undefined,
  onData: () => noop,
  onClose: () => noop,
};

const delay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));

      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

const waitForAbort = (signal: AbortSignal): Promise<never> =>
  new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));

      return;
    }

    signal.addEventListener('abort', () => reject(abortReason(signal)), { once: true });
  });

export class SimLink extends BaseLink {
  protected readonly survivesProbeTimeout = true;
  private dropTimer?: ReturnType<typeof setTimeout>;
  private openedAt = 0;
  private stopWatchingFaults: () => void = noop;

  constructor(private readonly vehicle: SimulatedVehicle) {
    super(IDLE_TRANSPORT);
  }

  protected async handshake(): Promise<void> {
    this.openedAt = Date.now();
    this.armDropTimer();
    this.stopWatchingFaults = this.vehicle.faults.onChange(() => this.armDropTimer());
  }

  protected receive(): void {}

  protected onTeardown(): void {
    clearTimeout(this.dropTimer);
    this.stopWatchingFaults();
  }

  protected async exchange(
    ecu: number,
    payload: Uint8Array,
    context: ExchangeContext,
    options: RequestOptions,
  ): Promise<Uint8Array> {
    const { signal } = context;
    const expectResponse = options.expectResponse ?? true;
    const plan = this.vehicle.faults.plan(payload[0]!);

    if (plan.action === 'drop') {
      this.drop();

      return waitForAbort(signal);
    }

    if (plan.action === 'silent') return expectResponse ? waitForAbort(signal) : NO_RESPONSE;

    if (!expectResponse) {
      this.vehicle.handle(ecu, payload);

      return NO_RESPONSE;
    }

    for (let index = 0; index < plan.pendingCount; index++) {
      await delay(plan.latencyMs, signal);
      context.extend();
    }
    await delay(plan.latencyMs, signal);

    const reply =
      plan.action === 'reject'
        ? Uint8Array.of(NEGATIVE_SID, payload[0]!, Nrc.ConditionsNotCorrect)
        : this.vehicle.handle(ecu, payload);
    if (!reply) return waitForAbort(signal);

    return this.settle(payload, reply);
  }

  private settle(payload: Uint8Array, reply: Uint8Array): Uint8Array {
    const match = matchUdsResponse(payload, reply);
    if (match.kind === 'negative') throw new NegativeResponseError(payload[0]!, match.code);
    if (match.kind !== 'positive') {
      throw new AdapterError('malformed-frame', 'Simulator produced an unrelated response');
    }

    return reply;
  }

  private drop(): void {
    this.fail(new LinkClosedError('Simulated connection drop'));
  }

  private armDropTimer(): void {
    clearTimeout(this.dropTimer);
    this.dropTimer = undefined;

    const { dropAtMs } = this.vehicle.faults;
    if (dropAtMs === undefined) return;

    const remaining = Math.max(0, this.openedAt + dropAtMs - Date.now());
    this.dropTimer = setTimeout(() => this.drop(), remaining);
  }
}
