import type { DiagnosticLink } from '@/link/types';
import { NegativeResponseError, toError } from '@/protocol/errors';

import { systemClock } from '../clock';
import { RunLimitError } from '../errors';
import { MAX_RUN_MS, PRESET_LIMITS } from '../preset/limits';

import { createCleanupSend, restoreControl, type RestoreOptions } from './cleanup';
import { buildPlan, isReleaseOnly, planInputOf, type PlannedSend, type RunPlan } from './plan';
import {
  itemIdOf,
  type CleanupReport,
  type ExecutionResult,
  type RunnableItem,
  type RunnerEvent,
  type RunResult,
} from './types';

import type { ControlLedger } from './ledger';
import type { Clock } from '../clock';
import type { DetectedCar, DetectedModule } from '../registry/types';

export const LATENESS_TOLERANCE_MS = 25;

const EXTENDED_SESSION = Uint8Array.of(0x10, 0x03);
const COMMUNICATION_OFF = Uint8Array.of(0x28, 0x02, 0x01);

export interface RunnerDeps {
  link: DiagnosticLink;
  car: DetectedCar;
  ledger: ControlLedger;
  clock?: Clock;
  onEvent?: (event: RunnerEvent) => void;
  trace?: boolean;
}

export class PresetRunner {
  private readonly clock: Clock;
  private restoring?: Promise<CleanupReport>;
  private tooFastReported = false;
  private previousRestoreFailed = false;
  private tracing: boolean;

  constructor(private readonly deps: RunnerDeps) {
    this.clock = deps.clock ?? systemClock;
    this.tracing = deps.trace ?? false;
  }

  setTrace(enabled: boolean): void {
    this.tracing = enabled;
  }

  get ledger(): ControlLedger {
    return this.deps.ledger;
  }

  async run(item: RunnableItem, signal?: AbortSignal): Promise<RunResult> {
    let result: ExecutionResult | undefined;
    let cleanup: CleanupReport | undefined;

    try {
      result = await this.execute(item, signal);
    } finally {
      cleanup = await this.restore();
    }

    return { ...result, cleanup };
  }

  async execute(item: RunnableItem, signal?: AbortSignal): Promise<ExecutionResult> {
    const limit = new AbortController();
    const forwardAbort = () => limit.abort(signal?.reason);
    const playback =
      item.kind === 'preset'
        ? item.preset.steps.some((step) => step.type === 'loop')
          ? 'loop'
          : (item.preset.playback ?? 'once')
        : 'once';
    let timer = this.clock.setTimeout(() => limit.abort(new RunLimitError(MAX_RUN_MS)), MAX_RUN_MS);
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener('abort', forwardAbort, { once: true });

    const skipped: RunPlan['skipped'] = [];
    this.tooFastReported = false;

    try {
      if (isReleaseOnly(item)) {
        this.emit({ type: 'started', itemId: itemIdOf(item) });

        return { status: this.statusOf(limit.signal), skipped };
      }

      const plan = buildPlan(planInputOf(item), this.deps.car);
      skipped.push(...plan.skipped);
      this.emit({ type: 'started', itemId: itemIdOf(item) });
      for (const element of plan.skipped) this.emit({ type: 'elementSkipped', element });

      this.warnIfTooFast(plan);
      await this.prepare(plan);
      do {
        const cycleStart = this.clock.now();
        await this.play(plan, limit.signal);
        if (playback !== 'loop' || limit.signal.aborted) break;
        // Even an all-immediate loop must yield, so Stop and keepalives can run.
        await this.waitUntil(cycleStart + PRESET_LIMITS.minStepMs, limit.signal);
        this.clock.clearTimeout(timer);
        timer = this.clock.setTimeout(() => limit.abort(new RunLimitError(MAX_RUN_MS)), MAX_RUN_MS);
      } while (!limit.signal.aborted);

      if (playback === 'hold' && !limit.signal.aborted) {
        this.clock.clearTimeout(timer);
        await new Promise<void>((resolve) => {
          if (limit.signal.aborted) resolve();
          else limit.signal.addEventListener('abort', () => resolve(), { once: true });
        });
      }

      return {
        status: this.statusOf(limit.signal),
        error: this.limitErrorOf(limit.signal),
        skipped,
      };
    } catch (error) {
      return { status: 'failed', error: toError(error), skipped };
    } finally {
      this.clock.clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    }
  }

  restore(options: RestoreOptions = {}): Promise<CleanupReport> {
    if (this.restoring) return this.restoring;

    if (this.deps.ledger.hasPending) this.emit({ type: 'restoring' });
    const send = createCleanupSend(
      this.deps.link,
      (ecu, payload) => {
        if (this.tracing) this.emit({ type: 'request', ecu, payload });
        options.observer?.request?.(ecu, payload);
      },
      (ecu, payload) => {
        if (this.tracing) this.emit({ type: 'response', ecu, payload });
        options.observer?.response?.(ecu, payload);
      },
      (ecu, error) => {
        if (this.tracing) this.emit({ type: 'requestFailed', ecu, error });
        options.observer?.failure?.(ecu, error);
      },
    );
    const pending = restoreControl(this.deps.link, this.deps.ledger, send, {
      reenterSession: options.reenterSession || this.previousRestoreFailed,
      observer: options.observer,
    })
      .then((report) => {
        this.previousRestoreFailed = !report.restored;
        this.emit({ type: 'restored', report });

        return report;
      })
      .finally(() => {
        this.restoring = undefined;
      });
    this.restoring = pending;

    return pending;
  }

  private emit(event: RunnerEvent): void {
    this.deps.onEvent?.(event);
  }

  private statusOf(signal: AbortSignal): ExecutionResult['status'] {
    if (!signal.aborted) return 'completed';

    return signal.reason instanceof RunLimitError ? 'timeout' : 'aborted';
  }

  private limitErrorOf(signal: AbortSignal): Error | undefined {
    return signal.reason instanceof RunLimitError ? signal.reason : undefined;
  }

  private async send(module: DetectedModule, payload: Uint8Array): Promise<Uint8Array> {
    if (this.tracing) this.emit({ type: 'request', ecu: module.address, payload });

    try {
      const response = await this.deps.link.request(module.address, payload);
      if (this.tracing) this.emit({ type: 'response', ecu: module.address, payload: response });
      return response;
    } catch (error) {
      if (this.tracing)
        this.emit({ type: 'requestFailed', ecu: module.address, error: toError(error) });
      throw error;
    }
  }

  private warnIfTooFast(plan: RunPlan): void {
    const rttMs = this.deps.link.measuredRttMs;
    if (rttMs === null) return;

    plan.steps.slice(0, -1).forEach((step, index) => {
      const availableMs = plan.steps[index + 1]!.atMs - step.atMs;
      const requiredMs = Math.ceil(step.sends.length * rttMs);
      if (availableMs < requiredMs) this.reportTooFast(rttMs, requiredMs, availableMs);
    });
  }

  private async prepare(plan: RunPlan): Promise<void> {
    const { ledger } = this.deps;

    for (const module of plan.modules) {
      ledger.openSession(module.module);
      await this.send(module, EXTENDED_SESSION);
    }
    for (const module of plan.silence) {
      ledger.silence(module.module);
      await this.send(module, COMMUNICATION_OFF);
    }
    for (const module of plan.cluster) await this.startClusterFeedback(module);
  }

  private async startClusterFeedback(module: DetectedModule): Promise<void> {
    const { ledger } = this.deps;

    try {
      ledger.openSession(module.module);
      await this.send(module, EXTENDED_SESSION);
      ledger.touch(module.module, 'clusterFeedback');
      await this.send(module, Uint8Array.from(module.module.elements.clusterFeedback!.on));
    } catch (error) {
      if (error instanceof NegativeResponseError) ledger.untouch(module.module, 'clusterFeedback');
      this.emit({ type: 'clusterFeedbackFailed', error: toError(error) });
    }
  }

  private async play(plan: RunPlan, signal: AbortSignal): Promise<void> {
    const startedAt = this.clock.now();
    let offsetMs = 0;

    for (const step of plan.steps) {
      const latenessMs = await this.waitUntil(startedAt + offsetMs + step.atMs, signal);
      if (latenessMs === undefined) return;

      if (latenessMs > LATENESS_TOLERANCE_MS) {
        offsetMs += latenessMs;
        this.reportTooFast(this.deps.link.measuredRttMs ?? 0, latenessMs, 0);
      }

      for (const send of step.sends) {
        if (signal.aborted) return;

        await this.sendPlanned(send);
      }
    }

    await this.waitUntil(startedAt + offsetMs + plan.endMs, signal);
  }

  private reportTooFast(rttMs: number, requiredMs: number, availableMs: number): void {
    if (this.tooFastReported) return;

    this.tooFastReported = true;
    this.emit({ type: 'tooFast', rttMs, requiredMs, availableMs });
  }

  private async sendPlanned({ module, element, payload }: PlannedSend): Promise<void> {
    const { ledger } = this.deps;
    const wasTouched = ledger.isTouched(module.module, element);
    ledger.touch(module.module, element);
    try {
      await this.send(module, payload);
    } catch (error) {
      if (error instanceof NegativeResponseError && !wasTouched)
        ledger.untouch(module.module, element);
      this.emit({ type: 'commandFailed', sgbd: module.sgbd, element, error: toError(error) });
      throw error;
    }
  }

  private waitUntil(targetMs: number, signal: AbortSignal): Promise<number | undefined> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(undefined);

        return;
      }

      const remainingMs = targetMs - this.clock.now();
      if (remainingMs <= 0) {
        resolve(-remainingMs);

        return;
      }

      const onAbort = () => {
        this.clock.clearTimeout(timer);
        resolve(undefined);
      };
      const timer = this.clock.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve(Math.max(0, this.clock.now() - targetMs));
      }, remainingMs);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
