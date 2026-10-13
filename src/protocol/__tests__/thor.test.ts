import { additiveChecksum, concatBytes, fromHex } from '../bytes';
import { AdapterError } from '../errors';
import { encodeThorDiagnostic, THOR_MAX_PAYLOAD, ThorParser } from '../thor';

const frame = (payload: Uint8Array, destination: number, source: number) =>
  new ThorParser().push(encodeThorDiagnostic(payload, destination, source));

describe('Thor encoding', () => {
  it('encodes a short frame with additive checksum', () => {
    const encoded = encodeThorDiagnostic(fromHex('22 F1 50'), 0x40);

    expect(encoded).toEqual(fromHex('83 40 F1 22 F1 50 17'));
    expect(encoded[encoded.length - 1]).toBe(additiveChecksum(encoded.subarray(0, -1)));
  });

  it.each([1, 63, 64, 255, 256, 1000, THOR_MAX_PAYLOAD])(
    'round-trips a %i byte payload',
    (length) => {
      const payload = Uint8Array.from({ length }, (_, index) => (index * 7 + 3) & 0xff);
      const [packet] = frame(payload, 0xf1, 0x40);

      expect(packet).toMatchObject({ destination: 0xf1, source: 0x40 });
      expect(packet?.payload).toEqual(payload);
    },
  );

  it('rejects invalid lengths and addresses', () => {
    expect(() => encodeThorDiagnostic(new Uint8Array(), 0x40)).toThrow(RangeError);
    expect(() => encodeThorDiagnostic(new Uint8Array(THOR_MAX_PAYLOAD + 1), 0x40)).toThrow(
      RangeError,
    );
    expect(() => encodeThorDiagnostic(fromHex('22'), 300)).toThrow(RangeError);
  });
});

describe('ThorParser', () => {
  it('reassembles frames split at every position', () => {
    const wire = concatBytes(
      encodeThorDiagnostic(fromHex('62 F1 50 0F 16 B0'), 0xf1, 0x40),
      encodeThorDiagnostic(new Uint8Array(100).fill(7), 0xf1, 0x40),
      encodeThorDiagnostic(new Uint8Array(300).fill(9), 0xf1, 0x40),
    );

    for (let split = 1; split < wire.length; split++) {
      const parser = new ThorParser();
      const packets = [
        ...parser.push(wire.subarray(0, split)),
        ...parser.push(wire.subarray(split)),
      ];

      expect(packets.map((packet) => packet.payload.length)).toEqual([6, 100, 300]);
    }
  });

  it('rejects a bad checksum', () => {
    const wire = encodeThorDiagnostic(fromHex('22 F1 50'), 0xf1, 0x40);
    wire[wire.length - 1] = (wire[wire.length - 1]! + 1) & 0xff;

    expect(() => new ThorParser().push(wire)).toThrow(AdapterError);
  });

  it('rejects frames with a wrong format byte', () => {
    expect(() => new ThorParser().push(fromHex('C3 F1 40 62 F1 50 00'))).toThrow(AdapterError);
    expect(() => new ThorParser().push(fromHex('03 F1 40 62'))).toThrow(AdapterError);
  });

  it('rejects oversized and zero extended lengths', () => {
    expect(() => new ThorParser().push(fromHex('80 F1 40 00 20 00'))).toThrow(AdapterError);
    expect(() => new ThorParser().push(fromHex('80 F1 40 00 00 00'))).toThrow(AdapterError);
  });

  it('waits for the extended length bytes', () => {
    const parser = new ThorParser();

    expect(parser.push(fromHex('80 F1 40'))).toEqual([]);
    expect(parser.push(fromHex('00'))).toEqual([]);
    expect(parser.push(fromHex('00'))).toEqual([]);
  });

  it('recovers after an error and supports reset', () => {
    const parser = new ThorParser();
    expect(() => parser.push(fromHex('FF FF FF'))).toThrow();

    parser.push(fromHex('83 F1'));
    parser.reset();

    expect(parser.push(encodeThorDiagnostic(fromHex('7E 00'), 0xf1, 0x40))).toHaveLength(1);
  });

  it('keeps echoes visible so the link can filter by address', () => {
    const [echo] = frame(fromHex('22 F1 50'), 0x40, 0xf1);

    expect(echo).toMatchObject({ destination: 0x40, source: 0xf1 });
  });
});
