import { assertByte } from './bytes';
import { AdapterError } from './errors';

export const ISOTP_MAX_PAYLOAD = 4095;
export const TESTER_ADDRESS_BYTE = 0xf1;
export const RESPONSE_ID_BASE = 0x600;

const PADDING = 0xaa;
const FRAME_SIZE = 8;
const SINGLE_FRAME_MAX = 6;
const FIRST_FRAME_DATA = 5;
const CONSECUTIVE_FRAME_DATA = 6;
const FLOW_FRAME_MIN = 4;
const ST_MIN_MS_MAX = 0x7f;
const ST_MIN_SUB_MS_FIRST = 0xf1;
const ST_MIN_SUB_MS_LAST = 0xf9;

enum FrameType {
  Single = 0,
  First = 1,
  Consecutive = 2,
  Flow = 3,
}

export interface FlowControl {
  status: number;
  blockSize: number;
  stMin: number;
}

export type IsoTpEvent =
  { type: 'message'; payload: Uint8Array } | ({ type: 'flow' } & FlowControl);

const malformed = (message: string): AdapterError => new AdapterError('malformed-frame', message);

const buildFrame = (ecu: number, pci: number[], data: Uint8Array): Uint8Array => {
  const frame = new Uint8Array(FRAME_SIZE).fill(PADDING);
  frame.set([ecu, ...pci]);
  frame.set(data, 1 + pci.length);

  return frame;
};

export const encodeIsoTp = (ecu: number, payload: Uint8Array): Uint8Array[] => {
  assertByte(ecu);
  if (payload.length < 1 || payload.length > ISOTP_MAX_PAYLOAD) {
    throw new RangeError('Invalid ISO-TP payload length');
  }

  if (payload.length <= SINGLE_FRAME_MAX) return [buildFrame(ecu, [payload.length], payload)];

  const first = buildFrame(
    ecu,
    [0x10 | (payload.length >> 8), payload.length & 0xff],
    payload.subarray(0, FIRST_FRAME_DATA),
  );
  const frames = [first];

  let sequence = 1;
  for (let offset = FIRST_FRAME_DATA; offset < payload.length; offset += CONSECUTIVE_FRAME_DATA) {
    const chunk = payload.subarray(offset, offset + CONSECUTIVE_FRAME_DATA);
    frames.push(buildFrame(ecu, [0x20 | (sequence & 0xf)], chunk));
    sequence++;
  }

  return frames;
};

export const frameToCommand = (frame: Uint8Array): string =>
  Array.from(frame, (value) => value.toString(16).toUpperCase().padStart(2, '0')).join('');

export const stMinMs = (value: number): number => {
  if (value <= ST_MIN_MS_MAX) return value;

  return value >= ST_MIN_SUB_MS_FIRST && value <= ST_MIN_SUB_MS_LAST ? 0 : ST_MIN_MS_MAX;
};

export class IsoTpReceiver {
  private buffer?: Uint8Array;
  private used = 0;
  private sequence = 0;

  constructor(private readonly ecu: number) {}

  reset(): void {
    this.buffer = undefined;
    this.used = 0;
    this.sequence = 0;
  }

  push(id: number, data: Uint8Array): IsoTpEvent | undefined {
    if (id !== RESPONSE_ID_BASE + this.ecu || data.length < 2 || data[0] !== TESTER_ADDRESS_BYTE) {
      return undefined;
    }

    switch (data[1]! >> 4) {
      case FrameType.Single:
        return this.single(data);
      case FrameType.First:
        return this.first(data);
      case FrameType.Consecutive:
        return this.consecutive(data);
      case FrameType.Flow:
        return this.flow(data);
      default:
        return undefined;
    }
  }

  private single(data: Uint8Array): IsoTpEvent {
    const length = data[1]! & 0xf;
    if (length < 1 || length > data.length - 2) throw malformed('Invalid ISO-TP single frame');

    this.reset();

    return { type: 'message', payload: data.slice(2, 2 + length) };
  }

  private first(data: Uint8Array): undefined {
    if (data.length < 3) throw malformed('Invalid ISO-TP first frame');

    const length = ((data[1]! & 0xf) << 8) | data[2]!;
    if (length <= SINGLE_FRAME_MAX) throw malformed('Invalid ISO-TP first frame length');

    this.buffer = new Uint8Array(length);
    this.used = Math.min(length, data.length - 3);
    this.buffer.set(data.subarray(3, 3 + this.used));
    this.sequence = 1;

    return undefined;
  }

  private consecutive(data: Uint8Array): IsoTpEvent | undefined {
    if (!this.buffer) return undefined;

    if ((data[1]! & 0xf) !== this.sequence) {
      this.reset();
      throw malformed('ISO-TP consecutive frame out of sequence');
    }

    const count = Math.min(this.buffer.length - this.used, data.length - 2);
    this.buffer.set(data.subarray(2, 2 + count), this.used);
    this.used += count;
    this.sequence = (this.sequence + 1) & 0xf;
    if (this.used < this.buffer.length) return undefined;

    const payload = this.buffer;
    this.reset();

    return { type: 'message', payload };
  }

  private flow(data: Uint8Array): IsoTpEvent | undefined {
    if (data.length < FLOW_FRAME_MIN) return undefined;

    return { type: 'flow', status: data[1]! & 0xf, blockSize: data[2]!, stMin: data[3]! };
  }
}
