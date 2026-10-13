import { CommandQueue, type RequestContext } from '@/protocol/command-queue';
import { LinkClosedError, TimeoutError, toError } from '@/protocol/errors';
import type { RequestOptions } from '@/protocol/types';
import { Emitter } from '@/transport/emitter';
import { TransportError } from '@/transport/errors';
import type { Transport, Unsubscribe } from '@/transport/types';

import { mapTransportError } from './map-transport-error';

import type { DiagnosticLink, LinkState, LinkStateListener } from './types';

const RTT_SMOOTHING = 0.3;

export interface ExchangeContext extends RequestContext {
  skipRttSample(): void;
}

export abstract class BaseLink implements DiagnosticLink {
  private currentState: LinkState = 'idle';
  private rtt: number | null = null;
  private readonly queue = new CommandQueue();
  private readonly states = new Emitter<[LinkState, Error | undefined]>();
  private unsubscribers: Unsubscribe[] = [];

  protected readonly survivesProbeTimeout: boolean = false;

  constructor(protected readonly transport: Transport) {}

  get state(): LinkState {
    return this.currentState;
  }

  get busy(): boolean {
    return this.queue.busy;
  }

  get measuredRttMs(): number | null {
    return this.rtt;
  }

  onStateChange(listener: LinkStateListener): Unsubscribe {
    return this.states.subscribe(listener);
  }

  async open(signal?: AbortSignal): Promise<void> {
    if (this.currentState !== 'idle') throw new LinkClosedError('A link can only be opened once');

    this.setState('opening');
    this.unsubscribers = [
      this.transport.onData((data) => this.receive(data)),
      this.transport.onClose((error) =>
        this.fail(error ? mapTransportError(error) : new LinkClosedError('Connection closed')),
      ),
    ];

    try {
      await this.transport.open(signal);
      await this.handshake(signal);
    } catch (error) {
      const failure = mapTransportError(error);
      this.fail(failure);
      throw failure;
    }

    if (this.state === 'opening') this.setState('open');
  }

  request(ecu: number, payload: Uint8Array, options: RequestOptions = {}): Promise<Uint8Array> {
    if (this.currentState !== 'open') return Promise.reject(new LinkClosedError());

    const request = payload.slice();
    const job = async (context: RequestContext) => {
      const startedAt = Date.now();
      let sample = true;
      const exchangeContext: ExchangeContext = {
        signal: context.signal,
        extend: () => {
          sample = false;
          context.extend();
        },
        skipRttSample: () => {
          sample = false;
        },
      };
      const response = await this.exchange(ecu, request, exchangeContext, options);
      if (sample) this.recordRtt(Date.now() - startedAt);

      return response;
    };

    return this.queue.run(job, options).catch((error: unknown) => {
      const failure = mapTransportError(error);
      const harmlessProbe = options.probe === true && this.survivesProbeTimeout;
      const timedOut = failure instanceof TimeoutError && !harmlessProbe;
      if (timedOut || error instanceof TransportError) this.fail(failure);
      throw failure;
    });
  }

  async close(): Promise<void> {
    if (this.currentState === 'closed' || this.currentState === 'failed') return;

    this.setState('closed');
    await this.teardown(new LinkClosedError());
  }

  protected abstract handshake(signal?: AbortSignal): Promise<void>;

  protected abstract receive(data: Uint8Array): void;

  protected abstract exchange(
    ecu: number,
    payload: Uint8Array,
    context: ExchangeContext,
    options: RequestOptions,
  ): Promise<Uint8Array>;

  protected abstract onTeardown(error: Error): void;

  protected fail(error: unknown): void {
    if (this.currentState === 'closed' || this.currentState === 'failed') return;

    const failure = toError(error);
    this.setState('failed', failure);
    void this.teardown(failure);
  }

  private async teardown(error: Error): Promise<void> {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.onTeardown(error);
    this.queue.close(error);
    await this.transport.close().catch(() => undefined);
  }

  private setState(state: LinkState, error?: Error): void {
    this.currentState = state;
    this.states.emit(state, error);
  }

  private recordRtt(sampleMs: number): void {
    this.rtt = this.rtt === null ? sampleMs : this.rtt + RTT_SMOOTHING * (sampleMs - this.rtt);
  }
}
