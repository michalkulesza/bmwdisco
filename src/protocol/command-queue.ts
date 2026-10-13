import { abortReason, CancelledError, TimeoutError, toError } from './errors';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TOTAL_MS,
  type RequestOptions,
  type RequestPriority,
} from './types';

export interface RequestContext {
  signal: AbortSignal;
  extend(): void;
}

export type QueueJob<T> = (context: RequestContext) => Promise<T>;

type QueueOptions = Pick<RequestOptions, 'priority' | 'signal' | 'timeoutMs' | 'totalMs'>;

interface Entry {
  job: QueueJob<unknown>;
  priority: RequestPriority;
  signal?: AbortSignal;
  timeoutMs: number;
  totalMs: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  detach: () => void;
}

export class CommandQueue {
  private readonly lanes: Record<RequestPriority, Entry[]> = { high: [], normal: [] };
  private current?: { abort: (error: Error) => void };
  private closedWith?: Error;

  get busy(): boolean {
    return this.current !== undefined || this.lanes.high.length > 0 || this.lanes.normal.length > 0;
  }

  run<T>(job: QueueJob<T>, options: QueueOptions = {}): Promise<T> {
    if (this.closedWith) return Promise.reject(this.closedWith);
    if (options.signal?.aborted) return Promise.reject(abortReason(options.signal));

    return new Promise<T>((resolve, reject) => {
      const entry: Entry = {
        job: job as QueueJob<unknown>,
        priority: options.priority ?? 'normal',
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        totalMs: options.totalMs ?? DEFAULT_TOTAL_MS,
        resolve: resolve as (value: unknown) => void,
        reject,
        detach: () => undefined,
      };

      const onAbort = () => this.cancel(entry);
      options.signal?.addEventListener('abort', onAbort, { once: true });
      entry.detach = () => options.signal?.removeEventListener('abort', onAbort);

      this.lanes[entry.priority].push(entry);
      this.pump();
    });
  }

  close(error: Error): void {
    this.closedWith = error;
    const queued = [...this.lanes.high, ...this.lanes.normal];
    this.lanes.high = [];
    this.lanes.normal = [];
    for (const entry of queued) {
      entry.detach();
      entry.reject(error);
    }
    this.current?.abort(error);
  }

  private cancel(entry: Entry): void {
    const lane = this.lanes[entry.priority];
    const index = lane.indexOf(entry);
    if (index < 0) {
      this.current?.abort(entry.signal ? abortReason(entry.signal) : new CancelledError());

      return;
    }

    lane.splice(index, 1);
    entry.detach();
    entry.reject(entry.signal ? abortReason(entry.signal) : new CancelledError());
  }

  private pump(): void {
    if (this.current) return;

    const entry = this.lanes.high.shift() ?? this.lanes.normal.shift();
    if (!entry) return;

    void this.execute(entry);
  }

  private async execute(entry: Entry): Promise<void> {
    const controller = new AbortController();
    const deadline = Date.now() + entry.totalMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fail: (error: Error) => void = () => undefined;

    const aborted = new Promise<never>((_, reject) => {
      fail = reject;
    });

    const abort = (error: Error) => {
      if (controller.signal.aborted) return;
      controller.abort(error);
      fail(error);
    };

    const arm = () => {
      clearTimeout(timer);
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        abort(new TimeoutError('deadline'));

        return;
      }

      const finalWindow = remaining <= entry.timeoutMs;
      timer = setTimeout(
        () => abort(new TimeoutError(finalWindow ? 'deadline' : 'response')),
        Math.min(entry.timeoutMs, remaining),
      );
    };

    this.current = { abort };
    arm();

    try {
      const value = await Promise.race([
        entry.job({ signal: controller.signal, extend: arm }),
        aborted,
      ]);
      entry.resolve(value);
    } catch (error) {
      entry.reject(toError(error));
    } finally {
      clearTimeout(timer);
      entry.detach();
      this.current = undefined;
      this.pump();
    }
  }
}
