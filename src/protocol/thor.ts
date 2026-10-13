import { additiveChecksum, assertByte, concatBytes } from './bytes';
import { AdapterError } from './errors';

export const THOR_MAX_PAYLOAD = 4096;
export const THOR_TESTER_ADDRESS = 0xf1;

const FORMAT_MASK = 0xc0;
const FORMAT_PHYSICAL = 0x80;
const SHORT_LENGTH_MASK = 0x3f;
const SHORT_LENGTH_MAX = 63;
const BYTE_LENGTH_MAX = 255;

export interface ThorPacket {
  source: number;
  destination: number;
  payload: Uint8Array;
}

const malformed = (message: string): AdapterError => new AdapterError('malformed-frame', message);

const formatByte = (length: number): number =>
  length <= SHORT_LENGTH_MAX ? FORMAT_PHYSICAL | length : FORMAT_PHYSICAL;

export const encodeThorDiagnostic = (
  payload: Uint8Array,
  destination: number,
  source: number = THOR_TESTER_ADDRESS,
): Uint8Array => {
  const length = payload.length;
  if (length < 1 || length > THOR_MAX_PAYLOAD) throw new RangeError('Invalid THOR payload length');

  const addresses = Uint8Array.of(assertByte(destination), assertByte(source));
  const extension =
    length <= SHORT_LENGTH_MAX
      ? new Uint8Array()
      : length <= BYTE_LENGTH_MAX
        ? Uint8Array.of(length)
        : Uint8Array.of(0, length >> 8, length & 0xff);
  const body = concatBytes(Uint8Array.of(formatByte(length)), addresses, extension, payload);

  return concatBytes(body, Uint8Array.of(additiveChecksum(body)));
};

interface FrameHeader {
  payloadStart: number;
  length: number;
}

const readHeader = (buffer: Uint8Array): FrameHeader | undefined => {
  if (buffer.length < 3) return undefined;
  if ((buffer[0]! & FORMAT_MASK) !== FORMAT_PHYSICAL) throw malformed('Invalid THOR format byte');

  const shortLength = buffer[0]! & SHORT_LENGTH_MASK;
  if (shortLength > 0) return { payloadStart: 3, length: shortLength };
  if (buffer.length < 4) return undefined;
  if (buffer[3] !== 0) return { payloadStart: 4, length: buffer[3]! };
  if (buffer.length < 6) return undefined;

  return { payloadStart: 6, length: (buffer[4]! << 8) | buffer[5]! };
};

export class ThorParser {
  private buffer: Uint8Array = new Uint8Array();

  reset(): void {
    this.buffer = new Uint8Array();
  }

  push(chunk: Uint8Array): ThorPacket[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const packets: ThorPacket[] = [];

    try {
      for (;;) {
        const packet = this.takePacket();
        if (!packet) break;

        packets.push(packet);
      }
    } catch (error) {
      this.reset();
      throw error;
    }

    return packets;
  }

  private takePacket(): ThorPacket | undefined {
    const header = readHeader(this.buffer);
    if (!header) return undefined;
    if (header.length < 1 || header.length > THOR_MAX_PAYLOAD) {
      throw malformed('Invalid THOR frame length');
    }

    const total = header.payloadStart + header.length + 1;
    if (this.buffer.length < total) return undefined;

    const frame = this.buffer.slice(0, total);
    this.buffer = this.buffer.slice(total);

    if (additiveChecksum(frame.subarray(0, total - 1)) !== frame[total - 1]) {
      throw malformed('THOR checksum mismatch');
    }

    return {
      destination: frame[1]!,
      source: frame[2]!,
      payload: frame.slice(header.payloadStart, total - 1),
    };
  }
}
