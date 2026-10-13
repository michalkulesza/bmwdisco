import { fromHex } from '../bytes';
import { AdapterError } from '../errors';
import { encodeIsoTp, frameToCommand, ISOTP_MAX_PAYLOAD, IsoTpReceiver, stMinMs } from '../isotp';

const ECU = 0x12;
const RESPONSE_ID = 0x612;

const reassemble = (frames: Uint8Array[]) => {
  const receiver = new IsoTpReceiver(ECU);
  let result: Uint8Array | undefined;

  for (const request of frames) {
    const response = Uint8Array.from(request);
    response[0] = 0xf1;
    const event = receiver.push(RESPONSE_ID, response);
    if (event?.type === 'message') result = event.payload;
  }

  return result;
};

describe('ISO-TP encoding', () => {
  it('builds a padded single frame', () => {
    const [frame] = encodeIsoTp(ECU, fromHex('22 F1 50'));

    expect(frameToCommand(frame!)).toBe('1203' + '22F150' + 'AAAAAA');
  });

  it('segments multi-frame payloads with sequence numbers', () => {
    const payload = Uint8Array.from({ length: 20 }, (_, index) => index);
    const frames = encodeIsoTp(ECU, payload);

    expect(frames).toHaveLength(4);
    expect(frames[0]!.slice(0, 3)).toEqual(fromHex('12 10 14'));
    expect(frames.slice(1).map((frame) => frame[1])).toEqual([0x21, 0x22, 0x23]);
  });

  it.each([1, 6, 7, 11, 12, 100, 4095])('round-trips %i bytes', (length) => {
    const payload = Uint8Array.from({ length }, (_, index) => (index * 13 + 1) & 0xff);

    expect(reassemble(encodeIsoTp(ECU, payload))).toEqual(payload);
  });

  it('wraps the sequence number after 15 consecutive frames', () => {
    const payload = new Uint8Array(5 + 6 * 17).fill(1);
    const frames = encodeIsoTp(ECU, payload);

    expect(frames[16]![1]).toBe(0x20);
    expect(reassemble(frames)).toEqual(payload);
  });

  it('rejects empty and oversized payloads', () => {
    expect(() => encodeIsoTp(ECU, new Uint8Array())).toThrow(RangeError);
    expect(() => encodeIsoTp(ECU, new Uint8Array(ISOTP_MAX_PAYLOAD + 1))).toThrow(RangeError);
    expect(() => encodeIsoTp(300, fromHex('22'))).toThrow(RangeError);
  });
});

describe('IsoTpReceiver', () => {
  it('ignores frames for other ids or testers', () => {
    const receiver = new IsoTpReceiver(ECU);

    expect(receiver.push(0x6aa, fromHex('F1 01 7E'))).toBeUndefined();
    expect(receiver.push(RESPONSE_ID, fromHex('AA 01 7E'))).toBeUndefined();
    expect(receiver.push(RESPONSE_ID, fromHex('F1'))).toBeUndefined();
    expect(receiver.push(RESPONSE_ID, fromHex('F1 70 00'))).toBeUndefined();
  });

  it('parses flow control', () => {
    const receiver = new IsoTpReceiver(ECU);

    expect(receiver.push(RESPONSE_ID, fromHex('F1 30 00 05'))).toEqual({
      type: 'flow',
      status: 0,
      blockSize: 0,
      stMin: 5,
    });
    expect(receiver.push(RESPONSE_ID, fromHex('F1 30 00'))).toBeUndefined();
  });

  it('rejects malformed single and first frames', () => {
    const receiver = new IsoTpReceiver(ECU);

    expect(() => receiver.push(RESPONSE_ID, fromHex('F1 00 AA'))).toThrow(AdapterError);
    expect(() => receiver.push(RESPONSE_ID, fromHex('F1 07 AA'))).toThrow(AdapterError);
    expect(() => receiver.push(RESPONSE_ID, fromHex('F1 10'))).toThrow(AdapterError);
    expect(() => receiver.push(RESPONSE_ID, fromHex('F1 10 05 AA AA AA'))).toThrow(AdapterError);
  });

  it('rejects out-of-sequence consecutive frames and resets', () => {
    const receiver = new IsoTpReceiver(ECU);
    receiver.push(RESPONSE_ID, fromHex('F1 10 10 01 02 03 04 05'));

    expect(() => receiver.push(RESPONSE_ID, fromHex('F1 22 06 07'))).toThrow(AdapterError);
    expect(receiver.push(RESPONSE_ID, fromHex('F1 21 06 07'))).toBeUndefined();
  });

  it('ignores consecutive frames without a first frame', () => {
    expect(new IsoTpReceiver(ECU).push(RESPONSE_ID, fromHex('F1 21 06 07'))).toBeUndefined();
  });

  it('drops a partial message when a single frame arrives', () => {
    const receiver = new IsoTpReceiver(ECU);
    receiver.push(RESPONSE_ID, fromHex('F1 10 10 01 02 03 04 05'));

    expect(receiver.push(RESPONSE_ID, fromHex('F1 02 7E 00'))).toEqual({
      type: 'message',
      payload: fromHex('7E 00'),
    });
    expect(receiver.push(RESPONSE_ID, fromHex('F1 21 06'))).toBeUndefined();
  });

  it('can be reset', () => {
    const receiver = new IsoTpReceiver(ECU);
    receiver.push(RESPONSE_ID, fromHex('F1 10 10 01 02 03 04 05'));
    receiver.reset();

    expect(receiver.push(RESPONSE_ID, fromHex('F1 21 06'))).toBeUndefined();
  });
});

describe('stMinMs', () => {
  it('decodes millisecond, microsecond and reserved values', () => {
    expect(stMinMs(0)).toBe(0);
    expect(stMinMs(20)).toBe(20);
    expect(stMinMs(0xf3)).toBe(0);
    expect(stMinMs(0xfa)).toBe(0x7f);
  });
});
