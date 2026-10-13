import { concatBytes, fromHex } from '../bytes';
import { AdapterError } from '../errors';
import {
  encodeAliveCheckResponse,
  encodeHsfzControl,
  encodeHsfzDiagnostic,
  HSFZ_MAX_BODY,
  HsfzParser,
  HsfzType,
} from '../hsfz';

const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;

  return seed / 0x100000000;
};

const randomPayload = (next: () => number, length: number) =>
  Uint8Array.from({ length }, () => Math.floor(next() * 256));

describe('HSFZ encoding', () => {
  it('frames a diagnostic request', () => {
    expect(encodeHsfzDiagnostic(fromHex('22 F1 50'), 0x40)).toEqual(
      fromHex('00 00 00 05 00 01 F4 40 22 F1 50'),
    );
  });

  it('answers alive checks with the tester address', () => {
    expect(encodeAliveCheckResponse()).toEqual(fromHex('00 00 00 02 00 13 00 F4'));
  });

  it('rejects invalid input', () => {
    expect(() => encodeHsfzControl(-1)).toThrow(RangeError);
    expect(() => encodeHsfzControl(0x10000)).toThrow(RangeError);
    expect(() => encodeHsfzControl(1, new Uint8Array(HSFZ_MAX_BODY + 1))).toThrow(RangeError);
    expect(() => encodeHsfzDiagnostic(fromHex('22'), 256)).toThrow(RangeError);
  });
});

describe('HsfzParser', () => {
  it('parses a diagnostic packet with addresses', () => {
    const [packet] = new HsfzParser().push(fromHex('00 00 00 05 00 01 40 F4 62 F1 50'));

    expect(packet).toMatchObject({ type: HsfzType.Diagnostic, source: 0x40, destination: 0xf4 });
    expect(packet?.payload).toEqual(fromHex('62 F1 50'));
  });

  it('exposes ACKs separately with their addresses', () => {
    const [packet] = new HsfzParser().push(fromHex('00 00 00 03 00 02 F4 40 22'));

    expect(packet).toMatchObject({ type: HsfzType.Ack, source: 0xf4, destination: 0x40 });
  });

  it('keeps alive checks raw with and without addresses', () => {
    const parser = new HsfzParser();
    const [empty, addressed] = parser.push(fromHex('00 00 00 00 00 12  00 00 00 02 00 12 00 F4'));

    expect(empty?.payload).toEqual(new Uint8Array());
    expect(empty?.source).toBeUndefined();
    expect(addressed).toMatchObject({ source: 0x00, destination: 0xf4 });
  });

  it('reassembles frames split at every possible position', () => {
    const wire = concatBytes(
      fromHex('00 00 00 05 00 01 40 F4 62 F1 50'),
      fromHex('00 00 00 02 00 12 00 F4'),
      fromHex('00 00 00 04 00 01 40 F4 6F 45'),
    );

    for (let split = 1; split < wire.length; split++) {
      const parser = new HsfzParser();
      const packets = [
        ...parser.push(wire.subarray(0, split)),
        ...parser.push(wire.subarray(split)),
      ];

      expect(packets.map((packet) => packet.type)).toEqual([1, 0x12, 1]);
    }
  });

  it('handles byte-at-a-time delivery and merged chunks of random frames', () => {
    const next = lcg(42);
    const payloads = Array.from({ length: 25 }, () =>
      randomPayload(next, 1 + Math.floor(next() * 300)),
    );
    const wire = concatBytes(
      ...payloads.map((payload) => encodeHsfzDiagnostic(payload, 0xf4, 0x40)),
    );

    const byByte = new HsfzParser();
    const received = Array.from(wire).flatMap((value) => byByte.push(Uint8Array.of(value)));
    expect(received.map((packet) => packet.payload)).toEqual(payloads);

    const merged = new HsfzParser().push(wire);
    expect(merged.map((packet) => packet.payload)).toEqual(payloads);
  });

  it('returns copies that later input cannot mutate', () => {
    const parser = new HsfzParser();
    const [first] = parser.push(fromHex('00 00 00 03 00 01 40 F4 AA'));
    parser.push(fromHex('00 00 00 03 00 01 40 F4 BB'));

    expect(first?.payload).toEqual(Uint8Array.of(0xaa));
  });

  it('rejects oversized frames before buffering the body', () => {
    const parser = new HsfzParser();

    expect(() => parser.push(fromHex('00 00 20 00 00 01'))).toThrow(AdapterError);
  });

  it.each([
    ['diagnostic without addresses', '00 00 00 02 00 01 F4 40'],
    ['ack without addresses', '00 00 00 01 00 02 F4'],
    ['single-byte alive check', '00 00 00 01 00 12 00'],
    ['empty error frame', '00 00 00 00 00 40'],
  ])('rejects malformed %s', (_name, wire) => {
    expect(() => new HsfzParser().push(fromHex(wire))).toThrow(AdapterError);
  });

  it('recovers after an error because the buffer is reset', () => {
    const parser = new HsfzParser();
    expect(() => parser.push(fromHex('FF FF FF FF 00 01'))).toThrow();

    const [packet] = parser.push(fromHex('00 00 00 03 00 01 40 F4 AA'));
    expect(packet?.payload).toEqual(Uint8Array.of(0xaa));
  });

  it('never throws anything but AdapterError on random garbage', () => {
    const next = lcg(7);

    for (let round = 0; round < 200; round++) {
      const parser = new HsfzParser();
      try {
        parser.push(randomPayload(next, 1 + Math.floor(next() * 64)));
      } catch (error) {
        expect(error).toBeInstanceOf(AdapterError);
      }
    }
  });

  it('can be reset mid-frame', () => {
    const parser = new HsfzParser();
    parser.push(fromHex('00 00 00 06 00 01'));
    parser.reset();

    expect(parser.push(fromHex('00 00 00 03 00 01 40 F4 AA'))).toHaveLength(1);
  });
});
