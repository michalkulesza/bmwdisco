import { ANDROID_ELM_INIT, androidEcuCommands } from '@/protocol/android-elm';
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

export type ElmProfile = 'legacy' | 'android-mode2';

const DEFAULT_TIMINGS: ElmTimings = { settleMs: 50, monitorMs: 1000, handshakeMs: 4000 };
const BANNER_PATTERN = /elm|stn|obdlink|vgate|vlinker/i;

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export class ElmIsoTpLink extends BaseLink {
  private readonly port: ElmPort;
  private readonly timings: ElmTimings;
  private currentEcu?: number;
  private automaticFormatting = true;

  constructor(
    transport: Transport,
    timings: Partial<ElmTimings> = {},
    private readonly profile: ElmProfile = 'legacy',
  ) {
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

    if (this.profile === 'android-mode2') {
      // The first ATI wakes/drains the adapter; the second must identify it.
      await this.port.command('ATI', options);
      const identity = await this.port.command('ATI', options);
      if (!identity.length || identity.some((line) => parseElmLine(line).kind === 'error')) {
        throw new AdapterError('not-elm', 'Adapter did not answer ATI');
      }
      for (const command of ANDROID_ELM_INIT) {
        this.assertAccepted(command, await this.port.command(command, options));
      }
      this.automaticFormatting = true;
      return;
    }

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
    const encoded = encodeIsoTp(ecu, payload);
    if (this.profile === 'android-mode2') {
      const automatic = payload.length <= 6;
      if (automatic !== this.automaticFormatting) {
        const command = automatic ? 'ATCAF1' : 'ATCAF0';
        this.assertAccepted(command, await run(command));
        this.automaticFormatting = automatic;
      }
      // Never duplicate the address byte inserted by ATCEA.
      if (automatic) exchange.ingest(await run(frameToCommand(payload)));
      else {
        const frames = encoded.map((frame) => frame.slice(1));
        const usedInLast = (payload.length - 5) % 6 || 6;
        frames[frames.length - 1]!.fill(0, 1 + usedInLast);
        await this.sendFrames(frames, exchange, run);
      }
    } else {
      await this.sendFrames(encoded, exchange, run);
    }
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
    const commands =
      this.profile === 'android-mode2' ? androidEcuCommands(ecu) : ecuAddressCommands(ecu);
    for (const text of commands) this.assertAccepted(text, await run(text));

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
      await sleep(Math.max(this.profile === 'android-mode2' ? 50 : 0, stMinMs(flow.stMin)));
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
    const missingAck =
      this.profile === 'android-mode2' && !lines.some((line) => line.trim() === 'OK');
    if (rejected || missingAck)
      throw new AdapterError('adapter-rejected', `Adapter rejected ${text}`);
  }
}
