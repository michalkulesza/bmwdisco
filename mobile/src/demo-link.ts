import { DiagnosticLink, hex } from './link';

/** Deliberately synthetic responses, never opens a socket. */
export class DemoLink implements DiagnosticLink {
  private opened = false;
  constructor(private log: (message: string) => void) {}
  async open() { this.opened = true; this.log('SIMULATION: no vehicle connection'); }
  close() { this.opened = false; }
  async request(payload: Uint8Array, address: number): Promise<Uint8Array> {
    if (!this.opened) throw new Error('Demo disconnected');
    this.log(`SIM TX ${address.toString(16).toUpperCase().padStart(2, '0')} ${hex(payload)}`);
    await new Promise(resolve => setTimeout(resolve, 60));
    if (!this.opened) throw new Error('Demo disconnected');
    if (address !== 0x40) throw new Error(`Simulated ECU 0x${address.toString(16)} does not respond`);
    const response = payload[0] === 0x22
      ? Uint8Array.of(0x62, 0xf1, 0x50, 0x0f, 0x16, 0xb0)
      : Uint8Array.from([payload[0] + 0x40, ...payload.slice(1, payload[0] === 0x10 ? 2 : 4)]);
    this.log(`SIM RX ${hex(response)}`);
    return response;
  }
}
