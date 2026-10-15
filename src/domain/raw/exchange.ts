import type { DiagnosticLink } from '@/link/types';
import { NegativeResponseError, TimeoutError, toError } from '@/protocol/errors';

import type { ExchangeOutcome } from './types';

export const RAW_TIMEOUT_MS = 2500;
export const RAW_TOTAL_MS = 8000;

const NEGATIVE_SID = 0x7f;

export const outcomeOfError = (error: unknown): ExchangeOutcome => {
  if (error instanceof NegativeResponseError) {
    return {
      kind: 'negative',
      nrc: error.nrc,
      response: Uint8Array.of(NEGATIVE_SID, error.service, error.nrc),
    };
  }
  if (error instanceof TimeoutError) return { kind: 'timeout' };

  return { kind: 'error', message: toError(error).message };
};

export const performRaw = async (
  link: DiagnosticLink,
  ecu: number,
  payload: Uint8Array,
  signal?: AbortSignal,
): Promise<ExchangeOutcome> => {
  try {
    const response = await link.request(ecu, payload, {
      probe: true,
      signal,
      timeoutMs: RAW_TIMEOUT_MS,
      totalMs: RAW_TOTAL_MS,
    });

    return { kind: 'positive', response };
  } catch (error) {
    return outcomeOfError(error);
  }
};
