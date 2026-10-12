import { DiagnosticLink, hex } from './link';
import { HsfzParser, encodeHsfzDiagnostic, encodeHsfzControl } from './protocol/hsfz';
import { ThorParser, encodeThorDiagnostic } from './protocol/thor';
import { matchUdsResponse } from './protocol/uds';

export interface SocketLike {
  on(event: string, callback: (...args: any[]) => void): unknown;
  connect(options: { host: string; port: number; connectTimeout: number }, callback: () => void): unknown;
  write(bytes: Uint8Array): unknown;
  destroy(): unknown;
}
interface Pending {
  payload: Uint8Array; resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>; deadline: number;
}

/** One outstanding diagnostic request, bounded receive/deadline state. */
export class WireLink implements DiagnosticLink {
  private socket?: SocketLike;
  private opened = false;
  private ended = false;
  private pending?: Pending;
  private rejectOpen?: (error: Error) => void;
  private enet = new HsfzParser();
  private thor = new ThorParser();
  constructor(private mode: 'enet' | 'thor', private host: string, private port: number,
    private log: (message: string) => void, private lost: (error: Error) => void,
    private makeSocket: () => SocketLike,
    private responseMs = 4000, private totalMs = 12000) {}

  async open(): Promise<void> {
    if (this.ended || this.socket) throw new Error('Create a new connection before retrying');
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('TCP connection timed out')), 8000);
      this.rejectOpen = error => { clearTimeout(timer); reject(error); };
      try {
        const socket = this.makeSocket(); this.socket = socket;
        socket.on('data', (bytes: Uint8Array) => this.receive(new Uint8Array(bytes)));
        socket.on('error', (error: Error) => this.fail(error));
        socket.on('close', () => { if (!this.ended) this.fail(new Error('TCP connection closed')); });
        socket.connect({ host: this.host, port: this.port, connectTimeout: 8000 }, () => {
          if (this.ended) return;
          clearTimeout(timer); this.rejectOpen = undefined; this.opened = true;
          this.log(`TCP connected (${this.mode.toUpperCase()})`); resolve();
        });
      } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
    });
  }
  private write(bytes: Uint8Array) {
    if (!this.opened || this.ended || !this.socket) throw new Error('TCP is disconnected');
    this.log(`WIRE TX ${hex(bytes)}`); this.socket.write(bytes);
  }
  private receive(bytes: Uint8Array) {
    if (this.ended) return;
    this.log(`WIRE RX ${hex(bytes)}`);
    try {
      if (this.mode === 'enet') {
        for (const packet of this.enet.push(bytes)) {
          if (packet.type === 0x12) {
            this.write(encodeHsfzControl(0x13, Uint8Array.of(0, 0xf4))); continue;
          }
          if (packet.type === 2) { this.log('HSFZ transport ACK (not an ECU reply)'); continue; }
          if (packet.type !== 1) throw new Error(`HSFZ control/error type 0x${packet.type.toString(16)}`);
          if (packet.source === 0x40 && packet.destination === 0xf4) this.response(packet.payload);
        }
      } else {
        for (const packet of this.thor.push(bytes)) {
          // THOR may echo our request; never accept that as a vehicle response.
          if (packet.source === 0x40 && packet.destination === 0xf1) this.response(packet.payload);
        }
      }
    } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
  }
  private response(bytes: Uint8Array) {
    const pending = this.pending; if (!pending) { this.log('Unsolicited ECU response ignored'); return; }
    const match = matchUdsResponse(pending.payload, bytes);
    if (match.kind === 'unrelated') { this.log('Unrelated ECU response ignored'); return; }
    if (match.kind === 'pending') {
      clearTimeout(pending.timer);
      const remaining = pending.deadline - Date.now();
      if (remaining <= 0) { this.fail(new Error('ECU response-pending deadline exceeded')); return; }
      pending.timer = setTimeout(() => this.fail(new Error('ECU response timed out after pending')), remaining);
      this.log('ECU response pending (0x78)'); return;
    }
    clearTimeout(pending.timer); this.pending = undefined;
    if (match.kind === 'negative') pending.reject(new Error(`ECU rejected service 0x${pending.payload[0].toString(16)}: NRC 0x${match.code.toString(16).padStart(2, '0')}`));
    else pending.resolve(bytes);
  }
  request(payload: Uint8Array): Promise<Uint8Array> {
    if (!this.opened || this.ended) return Promise.reject(new Error('TCP is disconnected'));
    if (this.pending) return Promise.reject(new Error('A diagnostic request is already in progress'));
    return new Promise((resolve, reject) => {
      this.pending = { payload: payload.slice(), resolve, reject, deadline: Date.now() + this.totalMs,
        timer: setTimeout(() => this.fail(new Error('ECU response timed out; reconnect before retrying')), this.responseMs) };
      try { this.write(this.mode === 'enet' ? encodeHsfzDiagnostic(payload) : encodeThorDiagnostic(payload)); }
      catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
    });
  }
  private fail(error: Error) {
    if (this.ended) return;
    this.finish(error); this.lost(error);
  }
  private finish(error: Error) {
    this.ended = true; this.opened = false;
    this.rejectOpen?.(error); this.rejectOpen = undefined;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = undefined; }
    this.socket?.destroy(); this.enet.reset(); this.thor.reset();
  }
  close() { if (!this.ended) this.finish(new Error('Connection closed')); }
}
