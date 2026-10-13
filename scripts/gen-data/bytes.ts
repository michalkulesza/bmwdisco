export const hexToBytes = (hex: string): number[] => {
  const clean = hex.replace(/\s+/g, '');
  if (!/^([0-9a-fA-F]{2})*$/.test(clean)) throw new Error(`Invalid hex string: ${hex}`);

  return clean.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? [];
};

export const toBigEndian = (value: number, width: number): number[] => {
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** (8 * width)) {
    throw new Error(`Value ${value} does not fit in ${width} byte(s)`);
  }

  return Array.from({ length: width }, (_, index) => (value >> (8 * (width - 1 - index))) & 0xff);
};

export const formatBytes = (bytes: readonly number[]) =>
  bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
