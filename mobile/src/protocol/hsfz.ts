import { byte } from './bytes';

export const HSFZ_MAX_BODY = 4096;
export interface HsfzPacket {
  type: number;
  /** Complete body, including addresses when present. */
  body: Uint8Array;
  /** Address-stripped for diagnostics, ACKs and two-byte alive frames. */
  payload: Uint8Array;
  source?: number;
  destination?: number;
}

function validateBody(type: number, length: number): void {
  if (!Number.isInteger(type) || type < 0 || type > 0xffff) throw new Error('Invalid HSFZ type');
  if (length > HSFZ_MAX_BODY) throw new Error('HSFZ frame exceeds length limit');
  if ((type === 1 && length < 3) || (type === 2 && length < 2) ||
      (type === 0x12 && length === 1) || (type === 0x40 && length < 2)) {
    throw new Error('Malformed HSFZ body');
  }
}

/** Control body is raw: encodeHsfzControl(0x13, Uint8Array.of(0, 0xf4)). */
export function encodeHsfzControl(type: number, body: Uint8Array = new Uint8Array()): Uint8Array {
  validateBody(type, body.length);
  const packet = new Uint8Array(body.length + 6);
  const view = new DataView(packet.buffer);
  view.setUint32(0, body.length, false);
  view.setUint16(4, type, false);
  packet.set(body, 6);
  return packet;
}

export function encodeHsfzDiagnostic(payload: Uint8Array, source = 0xf4, destination = 0x40): Uint8Array {
  const body = new Uint8Array(payload.length + 2);
  body.set([byte(source), byte(destination)]);
  body.set(payload, 2);
  return encodeHsfzControl(1, body);
}

/** Frames may span any number of chunks; one chunk may contain many frames. */
export class HsfzParser {
  private buffer = new Uint8Array(HSFZ_MAX_BODY + 6);
  private used = 0;
  private needed = 6;

  reset(): void { this.used = 0; this.needed = 6; }

  push(chunk: Uint8Array): HsfzPacket[] {
    const packets: HsfzPacket[] = [];
    let offset = 0;
    try {
      while (offset < chunk.length) {
        const count = Math.min(this.needed - this.used, chunk.length - offset);
        this.buffer.set(chunk.subarray(offset, offset + count), this.used);
        this.used += count;
        offset += count;
        if (this.used < this.needed) continue;
        const view = new DataView(this.buffer.buffer);
        const length = view.getUint32(0, false);
        const type = view.getUint16(4, false);
        if (this.needed === 6) {
          validateBody(type, length);
          this.needed = length + 6;
          if (this.used < this.needed) continue;
        }
        const body = this.buffer.slice(6, this.needed);
        const addressed = type === 1 || type === 2 || (type === 0x12 && length === 2);
        packets.push({ type, body, payload: addressed ? body.slice(2) : body.slice(),
          ...(addressed ? { source: body[0], destination: body[1] } : {}) });
        this.reset();
      }
      return packets;
    } catch (error) { this.reset(); throw error; }
  }
}
