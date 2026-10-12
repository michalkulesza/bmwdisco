import { additiveChecksum, byte } from './bytes';

export const THOR_MAX_PAYLOAD = 4096;
export interface ThorPacket { source: number; destination: number; payload: Uint8Array; }

export function encodeThorDiagnostic(payload: Uint8Array, source = 0xf1, destination = 0x40): Uint8Array {
  const length = payload.length;
  if (length < 1 || length > THOR_MAX_PAYLOAD) throw new Error('Invalid THOR payload length');
  const start = length <= 63 ? 3 : length <= 255 ? 4 : 6;
  const packet = new Uint8Array(start + length + 1);
  packet.set([length <= 63 ? 0x80 | length : 0x80, byte(destination), byte(source)]);
  if (start === 4) packet[3] = length;
  if (start === 6) new DataView(packet.buffer).setUint16(4, length, false);
  packet.set(payload, start);
  packet[packet.length - 1] = additiveChecksum(packet.subarray(0, -1));
  return packet;
}

export class ThorParser {
  private buffer = new Uint8Array(THOR_MAX_PAYLOAD + 7);
  private used = 0;
  private needed = 3;
  private start = 3;
  private readingBody = false;

  reset(): void { this.used = 0; this.needed = 3; this.start = 3; this.readingBody = false; }

  push(chunk: Uint8Array): ThorPacket[] {
    const packets: ThorPacket[] = [];
    let offset = 0;
    try {
      while (offset < chunk.length) {
        const count = Math.min(this.needed - this.used, chunk.length - offset);
        this.buffer.set(chunk.subarray(offset, offset + count), this.used);
        offset += count;
        this.used += count;
        if (this.used < this.needed) continue;
        if (!this.readingBody && this.needed === 3) {
          if ((this.buffer[0] & 0xc0) !== 0x80) throw new Error('Invalid THOR format byte');
          const shortLength = this.buffer[0] & 0x3f;
          this.needed = shortLength === 0 ? 4 : shortLength + 4;
          this.readingBody = shortLength !== 0;
          continue;
        }
        if (!this.readingBody) {
          let length = this.buffer[3];
          if (this.needed === 4 && length === 0) { this.needed = 6; continue; }
          this.start = this.needed;
          if (this.start === 6) length = new DataView(this.buffer.buffer).getUint16(4, false);
          if (length < 1 || length > THOR_MAX_PAYLOAD) throw new Error('Invalid THOR frame length');
          this.needed = this.start + length + 1;
          this.readingBody = true;
          continue;
        }
        const checksum = additiveChecksum(this.buffer.subarray(0, this.needed - 1));
        if (checksum !== this.buffer[this.needed - 1]) throw new Error('THOR checksum mismatch');
        packets.push({ destination: this.buffer[1], source: this.buffer[2],
          payload: this.buffer.slice(this.start, this.needed - 1) });
        this.reset();
      }
      return packets;
    } catch (error) { this.reset(); throw error; }
  }
}
