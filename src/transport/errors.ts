export type TransportErrorCode =
  | 'invalid-host'
  | 'connect-failed'
  | 'timeout'
  | 'closed'
  | 'write-failed'
  | 'cancelled'
  | 'bluetooth-off'
  | 'bluetooth-denied'
  | 'bluetooth-unsupported'
  | 'no-adapter'
  | 'profile-unsupported';

export class TransportError extends Error {
  constructor(
    public readonly code: TransportErrorCode,
    message: string = code,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'TransportError';
  }
}
