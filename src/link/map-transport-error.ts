import { AdapterError, CancelledError, LinkClosedError, TimeoutError } from '@/protocol/errors';
import { TransportError } from '@/transport/errors';

export const mapTransportError = (error: unknown): Error => {
  if (!(error instanceof TransportError)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  switch (error.code) {
    case 'timeout':
      return new TimeoutError('open', error.message);
    case 'cancelled':
      return new CancelledError(error.message);
    case 'closed':
    case 'write-failed':
      return new LinkClosedError(error.message);
    case 'connect-failed':
    case 'invalid-host':
    case 'bluetooth-off':
    case 'bluetooth-denied':
    case 'bluetooth-unsupported':
    case 'no-adapter':
    case 'profile-unsupported':
      return new AdapterError(error.code, error.message);
  }
};
