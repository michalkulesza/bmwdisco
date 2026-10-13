import { SID } from '@/protocol/uds';

import { createRng, type Rng } from './rng';

export type LatencyPreset = 'enet' | 'thor' | 'ble';

export interface Latency {
  fixedMs: number;
  jitterMs: number;
}

export const LATENCY_PRESETS: Record<LatencyPreset, Latency> = {
  enet: { fixedMs: 5, jitterMs: 2 },
  thor: { fixedMs: 15, jitterMs: 5 },
  ble: { fixedMs: 60, jitterMs: 20 },
};

export interface FaultTrigger {
  requests?: number;
  probability?: number;
}

export interface FaultOptions {
  latency?: LatencyPreset | Latency;
  conditionsNotCorrect?: FaultTrigger;
  timeouts?: FaultTrigger;
  responsePending?: { times: number; requests?: number };
  dropAfterRequests?: number;
  dropAtMs?: number;
  ignitionOff?: boolean;
}

export type FaultAction = 'respond' | 'reject' | 'silent' | 'drop';

export interface FaultPlan {
  action: FaultAction;
  latencyMs: number;
  pendingCount: number;
}

const ACTUATION_SERVICES: readonly number[] = [
  SID.WriteDataByIdentifier,
  SID.IoControl,
  SID.RoutineControl,
];

export class FaultInjector {
  private readonly rng: Rng;
  private latency: Latency = { fixedMs: 0, jitterMs: 0 };
  private notCorrect?: FaultTrigger;
  private timeouts?: FaultTrigger;
  private pending?: { times: number; requests: number };
  private requestsBeforeDrop?: number;
  private ignitionOff = false;
  private dropAt?: number;
  private readonly listeners = new Set<() => void>();

  constructor(seed: number) {
    this.rng = createRng(seed);
  }

  get dropAtMs(): number | undefined {
    return this.dropAt;
  }

  configure(options: FaultOptions): void {
    if ('latency' in options) this.latency = resolveLatency(options.latency);
    if ('conditionsNotCorrect' in options)
      this.notCorrect = copyTrigger(options.conditionsNotCorrect);
    if ('timeouts' in options) this.timeouts = copyTrigger(options.timeouts);
    if ('responsePending' in options) this.pending = copyPending(options.responsePending);
    if ('dropAfterRequests' in options) this.requestsBeforeDrop = options.dropAfterRequests;
    if ('ignitionOff' in options) this.ignitionOff = options.ignitionOff ?? false;
    if ('dropAtMs' in options) this.dropAt = options.dropAtMs;

    for (const listener of [...this.listeners]) listener();
  }

  reset(): void {
    this.configure({
      latency: undefined,
      conditionsNotCorrect: undefined,
      timeouts: undefined,
      responsePending: undefined,
      dropAfterRequests: undefined,
      dropAtMs: undefined,
      ignitionOff: false,
    });
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  plan(service: number): FaultPlan {
    const latencyMs = this.nextLatency();

    if (this.shouldDrop()) return { action: 'drop', latencyMs, pendingCount: 0 };
    if (this.ignitionOff || fires(this.timeouts, this.rng)) {
      return { action: 'silent', latencyMs, pendingCount: 0 };
    }

    const rejected = ACTUATION_SERVICES.includes(service) && fires(this.notCorrect, this.rng);

    return {
      action: rejected ? 'reject' : 'respond',
      latencyMs,
      pendingCount: this.nextPendingCount(),
    };
  }

  private nextLatency(): number {
    const jitter = this.latency.jitterMs > 0 ? Math.round(this.rng() * this.latency.jitterMs) : 0;

    return this.latency.fixedMs + jitter;
  }

  private shouldDrop(): boolean {
    if (this.requestsBeforeDrop === undefined) return false;
    if (this.requestsBeforeDrop === 0) return true;

    this.requestsBeforeDrop--;

    return false;
  }

  private nextPendingCount(): number {
    if (!this.pending || this.pending.requests <= 0) return 0;

    this.pending.requests--;

    return this.pending.times;
  }
}

const resolveLatency = (latency: FaultOptions['latency']): Latency => {
  if (latency === undefined) return { fixedMs: 0, jitterMs: 0 };

  return typeof latency === 'string' ? LATENCY_PRESETS[latency] : latency;
};

const copyTrigger = (trigger?: FaultTrigger): FaultTrigger | undefined =>
  trigger ? { ...trigger } : undefined;

const copyPending = (pending?: FaultOptions['responsePending']) =>
  pending ? { times: pending.times, requests: pending.requests ?? 1 } : undefined;

const fires = (trigger: FaultTrigger | undefined, rng: Rng): boolean => {
  if (!trigger) return false;

  if (trigger.requests !== undefined && trigger.requests > 0) {
    trigger.requests--;

    return true;
  }

  return trigger.probability !== undefined && rng() < trigger.probability;
};
