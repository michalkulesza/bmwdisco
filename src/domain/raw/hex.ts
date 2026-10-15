import { fromHex } from '@/protocol/bytes';

export const MAX_RAW_PAYLOAD_BYTES = 64;

export type HexParseError = 'empty' | 'invalid' | 'tooLong';

export type HexParseResult = { ok: true; bytes: Uint8Array } | { ok: false; error: HexParseError };

const normalizeHex = (text: string): string => text.replace(/0x/gi, '').replace(/[\s,]/g, '');

export const parseHexBytes = (text: string): HexParseResult => {
  const compact = normalizeHex(text);
  if (compact.length === 0) return { ok: false, error: 'empty' };
  if (!/^(?:[0-9a-f]{2})+$/i.test(compact)) return { ok: false, error: 'invalid' };

  const bytes = fromHex(compact);
  if (bytes.length > MAX_RAW_PAYLOAD_BYTES) return { ok: false, error: 'tooLong' };

  return { ok: true, bytes };
};

export const parseEcuAddress = (text: string): number | undefined => {
  const compact = normalizeHex(text);

  return /^[0-9a-f]{1,2}$/i.test(compact) ? parseInt(compact, 16) : undefined;
};

export const formatEcuAddress = (address: number): string =>
  `0x${address.toString(16).toUpperCase().padStart(2, '0')}`;
