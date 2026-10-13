export const hex = (data: Uint8Array): string =>
  Array.from(data, (value) => value.toString(16).padStart(2, '0').toUpperCase()).join(' ');

export const fromHex = (text: string): Uint8Array => {
  const compact = text.replace(/\s/g, '');
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(compact)) throw new RangeError('Invalid hexadecimal bytes');

  return Uint8Array.from(compact.match(/../g) ?? [], (pair) => parseInt(pair, 16));
};

export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const assertByte = (value: number): number => {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError('Invalid byte');

  return value;
};

export const additiveChecksum = (data: Uint8Array): number =>
  data.reduce((sum, value) => (sum + value) & 0xff, 0);

export const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
};

export const asciiToBytes = (text: string): Uint8Array =>
  Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);

export const bytesToAscii = (data: Uint8Array): string =>
  Array.from(data, (value) => String.fromCharCode(value)).join('');
