/** Small portable helpers: deliberately no Node Buffer or native dependencies. */
export function hex(data: Uint8Array): string {
  return Array.from(data, value => value.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function fromHex(text: string): Uint8Array {
  const compact = text.replace(/\s/g, '');
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(compact)) throw new Error('Invalid hexadecimal bytes');
  return Uint8Array.from(compact.match(/../g) ?? [], pair => parseInt(pair, 16));
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function byte(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error('Invalid byte');
  return value;
}

export function additiveChecksum(data: Uint8Array): number {
  return data.reduce((sum, value) => (sum + value) & 0xff, 0);
}
