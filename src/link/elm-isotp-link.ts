import {
  ecuAddressCommands,
  ELM_INIT_COMMANDS,
  ELM_MONITOR_COMMAND,
  parseElmLine,
} from '@/protocol/elm-at';
import { AdapterError, TimeoutError } from '@/protocol/errors';
import { encodeIsoTp, frameToCommand, stMinMs } from '@/protocol/isotp';
import { DEFAULT_TIMEOUT_MS, type RequestOptions } from '@/protocol/types';
import type { Transport } from '@/transport/types';

import { BaseLink, type ExchangeContext } from './base-link';
import { ElmExchange } from './elm-exchange';
import { ElmPort } from './elm-port';

export interface ElmTimings {
  settleMs: number;
  monitorMs: number;
  handshakeMs: number;
}

const DEFAULT_TIMINGS: ElmTimings = { settleMs: 50, monitorMs: 1000, handshakeMs: 4000 };
const BANNER_PATTERN = /elm|stn|obdlink|vgate|vlinker/i;

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export class ElmIsoTpLink extends BaseLink {
  private readonly port: ElmPort;
  private readonly timings: ElmTimings;
  private currentEcu?: number;

  constructor(transport: Transport, timings: Partial<ElmTimings> = {}) {
    super(transport);
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.port = new ElmPort((data) => transport.write(data));
  }

  protected receive(data: Uint8Array): void {
    this.port.feed(data);
  }

  protected onTeardown(error: Error): void {
    this.currentEcu = undefined;
    this.port.reset(error);
  }

  protected async handshake(signal?: AbortSignal): Promise<void> {
    const options = { timeoutMs: this.timings.handshakeMs, signal };

    const banner = await this.port.command('ATZ', options).catch((error: unknown) => {
      if (error instanceof TimeoutError)
        throw new AdapterError('not-elm', 'Adapter did not answer ATZ');
      throw error;
    });
    if (!BANNER_PATTERN.test(banner.join(' '))) {
      throw new AdapterError('not-elm', 'Device is not an ELM327-compatible adapter');
    }

    for (const text of ELM_INIT_COMMANDS.slice(1)) {
      this.assertAccepted(text, await this.port.command(text, options));
    }
  }

  protected async exchange(
    ecu: number,
    payload: Uint8Array,
    context: ExchangeContext,
    options: RequestOptions,
  ): Promise<Uint8Array> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const run = (text: string, breakAfterMs?: number) =>
      this.port.command(text, { timeoutMs, signal: context.signal, breakAfterMs });

    if (this.currentEcu !== ecu) {
      context.skipRttSample();
      await this.selectEcu(ecu, run);
    }

    const exchange = new ElmExchange(ecu, payload);
    await this.sendFrames(encodeIsoTp(ecu, payload), exchange, run);
    if (options.expectResponse === false) return new Uint8Array();

    for (;;) {
      const response = exchange.takeResponse(context.extend);
      if (response) return response;

      if (!exchange.pending) {
        throw new AdapterError('no-data', 'ECU did not answer (NO DATA)');
      }

      const { monitorMs } = this.timings;
      exchange.ingest(
        await this.port.command(ELM_MONITOR_COMMAND, {
          timeoutMs: monitorMs + timeoutMs,
          signal: context.signal,
          breakAfterMs: monitorMs,
        }),
      );
    }
  }

  private async selectEcu(ecu: number, run: (text: string) => Promise<string[]>): Promise<void> {
    this.currentEcu = undefined;
    for (const text of ecuAddressCommands(ecu)) this.assertAccepted(text, await run(text));

    await sleep(this.timings.settleMs);
    this.currentEcu = ecu;
  }

  private async sendFrames(
    frames: Uint8Array[],
    exchange: ElmExchange,
    run: (text: string) => Promise<string[]>,
  ): Promise<void> {
    exchange.ingest(await run(frameToCommand(frames[0]!)));
    if (frames.length === 1) return;

    let flow = exchange.nextFlow();
    let sentInBlock = 0;

    for (let index = 1; index < frames.length; index++) {
      await sleep(stMinMs(flow.stMin));
      exchange.ingest(await run(frameToCommand(frames[index]!)));
      sentInBlock++;

      const blockDone = flow.blockSize > 0 && sentInBlock >= flow.blockSize;
      if (blockDone && index < frames.length - 1) {
        flow = exchange.nextFlow();
        sentInBlock = 0;
      }
    }
  }

  private assertAccepted(text: string, lines: string[]): void {
    const rejected = lines.some((line) => parseElmLine(line).kind === 'error');
    if (rejected) throw new AdapterError('adapter-rejected', `Adapter rejected ${text}`);
  }
}
