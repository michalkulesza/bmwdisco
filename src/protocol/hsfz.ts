import { assertByte, concatBytes } from './bytes';
import { AdapterError } from './errors';

export const HSFZ_MAX_BODY = 4096;
export const HSFZ_HEADER = 6;
export const TESTER_ADDRESS = 0xf4;

export const HsfzType = {
  Diagnostic: 0x01,
  Ack: 0x02,
  AliveCheckRequest: 0x12,
  AliveCheckResponse: 0x13,
} as const;

export interface HsfzPacket {
  type: number;
  body: Uint8Array;
  payload: Uint8Array;
  source?: number;
  destination?: number;
}

const malformed = (message: string): AdapterError => new AdapterError('malformed-frame', message);

const isAddressed = (type: number, length: number): boolean =>
  type === HsfzType.Diagnostic ||
  type === HsfzType.Ack ||
  (type === HsfzType.AliveCheckRequest && length === 2);

const validateHeader = (type: number, length: number): void => {
  if (length > HSFZ_MAX_BODY) throw malformed('HSFZ frame exceeds length limit');

  const tooShort =
    (type === HsfzType.Diagnostic && length < 3) ||
    (type === HsfzType.Ack && length < 2) ||
    (type === HsfzType.AliveCheckRequest && length === 1) ||
    (type >= 0x40 && type <= 0x45 && length < 1);
  if (tooShort) throw malformed('Malformed HSFZ body');
};

export const encodeHsfzControl = (
  type: number,
  body: Uint8Array = new Uint8Array(),
): Uint8Array => {
  if (!Number.isInteger(type) || type < 0 || type > 0xffff)
    throw new RangeError('Invalid HSFZ type');
  if (body.length > HSFZ_MAX_BODY) throw new RangeError('HSFZ body exceeds length limit');

  const packet = new Uint8Array(body.length + HSFZ_HEADER);
  const view = new DataView(packet.buffer);
  view.setUint32(0, body.length, false);
  view.setUint16(4, type, false);
  packet.set(body, HSFZ_HEADER);

  return packet;
};

export const encodeHsfzDiagnostic = (
  payload: Uint8Array,
  destination: number,
  source: number = TESTER_ADDRESS,
): Uint8Array =>
  encodeHsfzControl(
    HsfzType.Diagnostic,
    concatBytes(Uint8Array.of(assertByte(source), assertByte(destination)), payload),
  );

export const encodeAliveCheckResponse = (): Uint8Array =>
  encodeHsfzControl(HsfzType.AliveCheckResponse, Uint8Array.of(0x00, TESTER_ADDRESS));

export class HsfzParser {
  private buffer: Uint8Array = new Uint8Array();

  reset(): void {
    this.buffer = new Uint8Array();
  }

  push(chunk: Uint8Array): HsfzPacket[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const packets: HsfzPacket[] = [];

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

  private takePacket(): HsfzPacket | undefined {
    if (this.buffer.length < HSFZ_HEADER) return undefined;

    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
    const length = view.getUint32(0, false);
    const type = view.getUint16(4, false);
    validateHeader(type, length);

    const total = HSFZ_HEADER + length;
    if (this.buffer.length < total) return undefined;

    const body = this.buffer.slice(HSFZ_HEADER, total);
    this.buffer = this.buffer.slice(total);

    if (!isAddressed(type, length)) return { type, body, payload: body };

    return { type, body, payload: body.slice(2), source: body[0], destination: body[1] };
  }
}
