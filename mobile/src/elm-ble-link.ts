import { ConnectionCancelledError, DiagnosticLink } from './link';
import {
  BleAdvert, BleSelection, BleServiceInfo, ELM_MONITOR, IsoTpReceiver, chunkBytes, ecuCommands, encodeIsoTp, frameCommand,
  RememberedDevice, isElmAdvert, parseElmLine, selectProfile, sortByRssi, stMinMs,
} from './protocol/elm';
import { matchUdsResponse } from './protocol/uds';

export interface BleTransport {
  readonly writeSize: number;
  scan(onDevice: (advert: BleAdvert) => void, onError: (error: Error) => void): () => void;
  connect(id: string, onClosed: (error: Error) => void, timeoutMs?: number): Promise<BleServiceInfo[]>;
  attach(selection: BleSelection, onData: (bytes: Uint8Array) => void): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  close(): void;
}

export interface ElmBleDeps {
  chooseDevice(candidates: BleAdvert[]): Promise<string | null>;
  getRemembered(): Promise<RememberedDevice | null>;
  remember(device: RememberedDevice): Promise<void>;
}

export interface ElmTimings { responseMs: number; totalMs: number; settleMs: number; scanMs: number; rememberedMs: number; monitorMs: number }
const DEFAULT_TIMINGS: ElmTimings = { responseMs: 4000, totalMs: 12000, settleMs: 50, scanMs: 4000, rememberedMs: 5000, monitorMs: 1000 };

interface Command {
  text: string; resolve: (lines: string[]) => void; reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>; monitorTimer?: ReturnType<typeof setTimeout>;
}
interface Exchange { receiver: IsoTpReceiver; messages: Uint8Array[]; flows: { status: number; blockSize: number; stMin: number }[]; pending: boolean }

class NegativeResponse extends Error {}
class ElmError extends Error {
  constructor(public line: string, public command: string) { super(`ELM error "${line}" for ${command}`); }
}

const NOT_ELM = 'Selected device is not an ELM327 adapter';
const sleep = (ms: number) => ms > 0 ? new Promise<void>(resolve => setTimeout(resolve, ms)) : Promise.resolve();
const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));
const ascii = (bytes: Uint8Array) => Array.from(bytes, value => String.fromCharCode(value)).join('');
const encodeAscii = (text: string) => Uint8Array.from(text, char => char.charCodeAt(0));

export class ElmBleLink implements DiagnosticLink {
  private timings: ElmTimings;
  private started = false;
  private opened = false;
  private linkUp = false;
  private ended = false;
  private busy = false;
  private command?: Command;
  private buffer = '';
  private currentEcu?: number;
  private stopScan?: () => void;
  private rejectScan?: (error: Error) => void;

  constructor(private log: (message: string) => void, private lost: (error: Error) => void,
    private transport: BleTransport, private deps: ElmBleDeps, timings: Partial<ElmTimings> = {}) {
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
  }

  async open(): Promise<void> {
    if (this.ended || this.started) throw new Error('Create a new connection before retrying');
    this.started = true;
    try {
      const { device, services } = await this.connectDevice();
      this.linkUp = true;
      const selection = selectProfile(services);
      if (!selection) throw new Error('Connected Bluetooth device exposes no known ELM327 serial characteristic');
      this.log(`BLE profile ${selection.profile.id} (${selection.profile.label}): service ${selection.serviceUuid}, write ${selection.writeUuid}, notify ${selection.notifyUuid}`);
      await this.transport.attach(selection, bytes => this.receive(bytes));
      this.opened = true;
      await this.handshake(selection);
      this.log('ELM327 initialized');
      await this.deps.remember(device).catch(error => this.log(`Could not remember device: ${asError(error).message}`));
    } catch (error) {
      const failure = asError(error);
      this.finish(failure);
      throw failure;
    }
  }

  private async connectDevice(): Promise<{ device: RememberedDevice; services: BleServiceInfo[] }> {
    const onClosed = (error: Error) => { if (this.linkUp) this.fail(error); };
    const remembered = await this.deps.getRemembered();
    if (remembered) {
      this.log(`BLE connecting to remembered ${remembered.name ?? '(unnamed)'} (${remembered.id})`);
      try { return { device: remembered, services: await this.transport.connect(remembered.id, onClosed, this.timings.rememberedMs) }; }
      catch (error) { this.log(`Remembered device unavailable: ${asError(error).message}`); }
    }
    const candidates = await this.scanCandidates();
    const id = await this.deps.chooseDevice(candidates);
    if (this.ended) throw new Error('Connection closed');
    const chosen = candidates.find(candidate => candidate.id === id);
    if (!chosen) throw new ConnectionCancelledError();
    this.log(`BLE connecting to ${chosen.name ?? '(unnamed)'} (${chosen.id})`);
    return { device: { id: chosen.id, name: chosen.name }, services: await this.transport.connect(chosen.id, onClosed) };
  }

  private async handshake(selection: BleSelection) {
    let banner: string[];
    try { banner = await this.exchange('ATZ'); }
    catch (error) { throw error instanceof ElmError ? error : new Error(NOT_ELM); }
    if (!/elm/i.test(banner.join(' '))) throw new Error(NOT_ELM);
    for (const text of selection.profile.initCommands) if (text !== 'ATZ') await this.initCommand(text, selection);
  }

  private scanCandidates(): Promise<BleAdvert[]> {
    return new Promise((resolve, reject) => {
      const found = new Map<string, BleAdvert>();
      let settled = false;
      const timer = setTimeout(() => settle(() => {
        if (found.size) resolve(sortByRssi([...found.values()]));
        else reject(new Error('No Bluetooth ELM327 adapter found. Plug it into OBD with ignition on and retry.'));
      }), this.timings.scanMs);
      const settle = (done: () => void) => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.stopScan?.(); this.stopScan = undefined; this.rejectScan = undefined; done();
      };
      this.rejectScan = error => settle(() => reject(error));
      try {
        const stop = this.transport.scan(advert => {
          if (!isElmAdvert(advert)) return;
          const previous = found.get(advert.id);
          found.set(advert.id, { ...advert, name: advert.name ?? previous?.name ?? null, rssi: advert.rssi ?? previous?.rssi ?? null });
        }, error => settle(() => reject(error)));
        if (settled) stop(); else this.stopScan = stop;
      } catch (error) { settle(() => reject(asError(error))); }
    });
  }

  private async initCommand(text: string, selection: BleSelection) {
    try { return await this.exchange(text); }
    catch (error) {
      if (error instanceof ElmError) throw new Error(`Adapter rejected ${text} ("${error.line}"); this ${selection.profile.label} may not be supported`);
      throw error;
    }
  }

  private receive(bytes: Uint8Array) {
    if (this.ended) return;
    this.buffer += ascii(bytes);
    const end = this.buffer.indexOf('>');
    if (end < 0) return;
    const text = this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end + 1);
    const command = this.command;
    if (!command) { this.log('Unsolicited ELM output ignored'); return; }
    const lines = text.split(/[\r\n]+/).map(line => line.trim()).filter(line => line && line !== command.text);
    for (const line of lines) this.log(`ELM RX ${line}`);
    clearTimeout(command.timer); clearTimeout(command.monitorTimer); this.command = undefined;
    const bad = lines.find(line => parseElmLine(line).kind === 'error');
    if (bad) command.reject(new ElmError(bad, command.text));
    else command.resolve(lines);
  }

  private async write(text: string) {
    if (!this.opened || this.ended) throw new Error('Bluetooth is disconnected');
    this.log(`ELM TX ${text.trim()}`);
    for (const chunk of chunkBytes(encodeAscii(text), this.transport.writeSize)) await this.transport.write(chunk);
  }

  private exchange(text: string, monitorMs?: number): Promise<string[]> {
    if (this.command) return Promise.reject(new Error('An ELM command is already in progress'));
    return new Promise((resolve, reject) => {
      const command: Command = { text, resolve, reject,
        timer: setTimeout(() => this.fail(new Error(`ELM did not answer ${text}; reconnect before retrying`)), this.timings.responseMs + (monitorMs ?? 0)) };
      if (monitorMs !== undefined) {
        command.monitorTimer = setTimeout(() => { void this.write('\r').catch(error => this.fail(asError(error))); }, monitorMs);
      }
      this.command = command;
      this.buffer = '';
      this.write(`${text}\r`).catch(error => this.fail(asError(error)));
    });
  }

  private ingest(lines: string[], exchange: Exchange) {
    for (const line of lines) {
      const parsed = parseElmLine(line);
      if (parsed.kind !== 'frame') continue;
      const event = exchange.receiver.push(parsed.id, parsed.data);
      if (event?.type === 'message') exchange.messages.push(event.payload);
      else if (event?.type === 'flow') exchange.flows.push(event);
    }
  }

  private async selectEcu(ecu: number) {
    if (this.currentEcu === ecu) return;
    this.currentEcu = undefined;
    for (const text of ecuCommands(ecu)) await this.exchange(text);
    await sleep(this.timings.settleMs);
    this.currentEcu = ecu;
    this.log(`ELM addressed ECU 0x${ecu.toString(16).toUpperCase()}`);
  }

  private nextFlow(exchange: Exchange) {
    const flow = exchange.flows.shift();
    if (!flow) throw new Error('ECU sent no ISO-TP flow control');
    if (flow.status !== 0) throw new Error(`ECU ISO-TP flow control status ${flow.status} unsupported`);
    return flow;
  }

  private async sendFrames(frames: Uint8Array[], exchange: Exchange) {
    this.ingest(await this.exchange(frameCommand(frames[0])), exchange);
    if (frames.length === 1) return;
    let flow = this.nextFlow(exchange);
    let sent = 0;
    for (let index = 1; index < frames.length; index++) {
      await sleep(stMinMs(flow.stMin));
      this.ingest(await this.exchange(frameCommand(frames[index])), exchange);
      sent++;
      if (flow.blockSize && sent >= flow.blockSize && index < frames.length - 1) { flow = this.nextFlow(exchange); sent = 0; }
    }
  }

  private takeResponse(payload: Uint8Array, exchange: Exchange): Uint8Array | undefined {
    while (exchange.messages.length) {
      const message = exchange.messages.shift()!;
      const match = matchUdsResponse(payload, message);
      if (match.kind === 'unrelated') { this.log('Unrelated ECU response ignored'); continue; }
      if (match.kind === 'pending') { exchange.pending = true; this.log('ECU response pending (0x78)'); continue; }
      if (match.kind === 'negative') throw new NegativeResponse(`ECU rejected service 0x${payload[0].toString(16)}: NRC 0x${match.code.toString(16).padStart(2, '0')}`);
      return message;
    }
    return undefined;
  }

  private async run(payload: Uint8Array, ecu: number): Promise<Uint8Array> {
    const deadline = Date.now() + this.timings.totalMs;
    const exchange: Exchange = { receiver: new IsoTpReceiver(ecu), messages: [], flows: [], pending: false };
    await this.selectEcu(ecu);
    await this.sendFrames(encodeIsoTp(ecu, payload), exchange);
    for (;;) {
      const response = this.takeResponse(payload, exchange);
      if (response) return response;
      if (!exchange.pending) throw new Error('ECU response timed out; reconnect before retrying');
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('ECU response-pending deadline exceeded');
      this.ingest(await this.exchange(ELM_MONITOR, Math.min(this.timings.monitorMs, remaining)), exchange);
    }
  }

  async request(payload: Uint8Array, address: number): Promise<Uint8Array> {
    if (!this.opened || this.ended) throw new Error('Bluetooth is disconnected');
    if (this.busy) throw new Error('A diagnostic request is already in progress');
    this.busy = true;
    try { return await this.run(payload.slice(), address); }
    catch (error) {
      if (!(error instanceof NegativeResponse)) this.fail(asError(error));
      throw error;
    } finally { this.busy = false; }
  }

  private fail(error: Error) {
    if (this.ended) return;
    this.finish(error);
    this.lost(error);
  }

  private finish(error: Error) {
    this.ended = true; this.opened = false;
    this.rejectScan?.(error);
    const command = this.command;
    this.command = undefined;
    if (command) { clearTimeout(command.timer); clearTimeout(command.monitorTimer); command.reject(error); }
    this.transport.close();
  }

  close() { if (!this.ended) this.finish(new Error('Connection closed')); }
}
