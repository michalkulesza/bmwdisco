import {
  additiveChecksum,
  asciiToBytes,
  assertByte,
  bytesToAscii,
  concatBytes,
  equalBytes,
  fromHex,
  hex,
} from '../bytes';

describe('bytes', () => {
  it('round-trips hex', () => {
    expect(hex(Uint8Array.of(0x2f, 0x45, 0x01))).toBe('2F 45 01');
    expect(fromHex('2f 45 01')).toEqual(Uint8Array.of(0x2f, 0x45, 0x01));
    expect(fromHex('')).toEqual(new Uint8Array());
  });

  it('rejects malformed hex', () => {
    expect(() => fromHex('2f4')).toThrow(RangeError);
    expect(() => fromHex('zz')).toThrow(RangeError);
  });

  it('compares and concatenates', () => {
    expect(equalBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 2))).toBe(true);
    expect(equalBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 3))).toBe(false);
    expect(equalBytes(Uint8Array.of(1), Uint8Array.of(1, 2))).toBe(false);
    expect(concatBytes(Uint8Array.of(1), new Uint8Array(), Uint8Array.of(2, 3))).toEqual(
      Uint8Array.of(1, 2, 3),
    );
  });

  it('validates bytes', () => {
    expect(assertByte(255)).toBe(255);
    expect(() => assertByte(256)).toThrow(RangeError);
    expect(() => assertByte(-1)).toThrow(RangeError);
    expect(() => assertByte(1.5)).toThrow(RangeError);
  });

  it('computes additive checksums modulo 256', () => {
    expect(additiveChecksum(Uint8Array.of(0xff, 0x02))).toBe(0x01);
  });

  it('converts ascii', () => {
    expect(bytesToAscii(asciiToBytes('ATZ\r'))).toBe('ATZ\r');
  });
});
