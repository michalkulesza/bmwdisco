import { abortReason, AdapterError, NegativeResponseError, toError } from '@/protocol/errors';
import type { RequestOptions } from '@/protocol/types';
import { matchUdsResponse } from '@/protocol/uds';

import { BaseLink, type ExchangeContext } from './base-link';

export interface IncomingFrame {
  source: number;
  destination: number;
  payload: Uint8Array;
}

interface InFlight {
  ecu: number;
  payload: Uint8Array;
  context: ExchangeContext;
  resolve: (response: Uint8Array) => void;
  reject: (error: Error) => void;
  detach: () => void;
}

export abstract class FramedLink extends BaseLink {
  private inFlight?: InFlight;

  protected readonly survivesProbeTimeout = true;

  protected abstract readonly testerAddress: number;

  protected abstract encodeRequest(ecu: number, payload: Uint8Array): Uint8Array;

  protected abstract decode(data: Uint8Array): IncomingFrame[];

  protected async handshake(): Promise<void> {}

  protected onTeardown(error: Error): void {
    this.settle((entry) => entry.reject(error));
  }

  protected receive(data: Uint8Array): void {
    try {
      for (const frame of this.decode(data)) this.deliver(frame);
    } catch (error) {
      this.fail(
        error instanceof AdapterError
          ? error
          : new AdapterError('malformed-frame', toError(error).message),
      );
    }
  }

  protected async exchange(
    ecu: number,
    payload: Uint8Array,
    context: ExchangeContext,
    options: RequestOptions,
  ): Promise<Uint8Array> {
    const frame = this.encodeRequest(ecu, payload);
    const expectResponse = options.expectResponse ?? true;

    const response = new Promise<Uint8Array>((resolve, reject) => {
      const onAbort = () => this.settle((entry) => entry.reject(abortReason(context.signal)));
      context.signal.addEventListener('abort', onAbort, { once: true });

      this.inFlight = {
        ecu,
        payload,
        context,
        resolve,
        reject,
        detach: () => context.signal.removeEventListener('abort', onAbort),
      };
    });

    response.catch(() => undefined);

    try {
      await this.transport.write(frame);
    } catch (error) {
      this.settle(() => undefined);
      throw error;
    }

    if (!expectResponse) {
      this.settle((entry) => entry.resolve(new Uint8Array()));
    }

    return response;
  }

  private deliver(frame: IncomingFrame): void {
    const current = this.inFlight;
    if (!current || frame.destination !== this.testerAddress || frame.source !== current.ecu)
      return;

    const match = matchUdsResponse(current.payload, frame.payload);
    switch (match.kind) {
      case 'unrelated':
        return;
      case 'pending':
        current.context.extend();

        return;
      case 'negative':
        this.settle((entry) =>
          entry.reject(new NegativeResponseError(entry.payload[0]!, match.code)),
        );

        return;
      case 'positive':
        this.settle((entry) => entry.resolve(frame.payload));
    }
  }

  private settle(action: (entry: InFlight) => void): void {
    const entry = this.inFlight;
    if (!entry) return;

    this.inFlight = undefined;
    entry.detach();
    action(entry);
  }
}
