import { describeNrc } from './nrc';

export type TimeoutKind = 'response' | 'deadline' | 'open';

export class TimeoutError extends Error {
  constructor(
    public readonly kind: TimeoutKind,
    message = `Timed out (${kind})`,
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class NegativeResponseError extends Error {
  constructor(
    public readonly service: number,
    public readonly nrc: number,
  ) {
    const serviceText = service.toString(16).toUpperCase();
    const nrcText = nrc.toString(16).toUpperCase().padStart(2, '0');
    super(`ECU rejected service 0x${serviceText}: ${describeNrc(nrc)} (0x${nrcText})`);
    this.name = 'NegativeResponseError';
  }
}

export class LinkClosedError extends Error {
  constructor(message = 'Link closed') {
    super(message);
    this.name = 'LinkClosedError';
  }
}

export class CancelledError extends Error {
  constructor(message = 'Request cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

export type AdapterErrorCode =
  | 'connect-failed'
  | 'invalid-host'
  | 'malformed-frame'
  | 'transport-error'
  | 'no-data'
  | 'can-error'
  | 'buffer-full'
  | 'adapter-rejected'
  | 'not-elm'
  | 'flow-control'
  | 'bluetooth-off'
  | 'bluetooth-denied'
  | 'bluetooth-unsupported'
  | 'no-adapter'
  | 'profile-unsupported';

export class AdapterError extends Error {
  constructor(
    public readonly code: AdapterErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

export const abortReason = (signal: AbortSignal): Error => {
  const reason: unknown = signal.reason;

  return reason instanceof Error && reason.name !== 'AbortError' ? reason : new CancelledError();
};
