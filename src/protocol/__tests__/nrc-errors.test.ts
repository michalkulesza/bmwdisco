import {
  AdapterError,
  CancelledError,
  LinkClosedError,
  NegativeResponseError,
  TimeoutError,
  toError,
} from '../errors';
import { decodeNrc, describeNrc, Nrc } from '../nrc';

describe('nrc', () => {
  it('decodes the codes the app reacts to', () => {
    expect(decodeNrc(0x78)).toBe(Nrc.ResponsePending);
    expect(decodeNrc(0x22)).toBe(Nrc.ConditionsNotCorrect);
    expect(decodeNrc(0x31)).toBe(Nrc.RequestOutOfRange);
    expect(decodeNrc(0x7f)).toBe(Nrc.ServiceNotSupportedInActiveSession);
    expect(decodeNrc(0x11)).toBe(Nrc.ServiceNotSupported);
    expect(decodeNrc(0x12)).toBe(Nrc.SubFunctionNotSupported);
    expect(decodeNrc(0x33)).toBe(Nrc.SecurityAccessDenied);
  });

  it('returns undefined for unknown codes', () => {
    expect(decodeNrc(0xee)).toBeUndefined();
    expect(describeNrc(0xee)).toBe('unknown negative response');
  });
});

describe('errors', () => {
  it('carries typed fields', () => {
    const negative = new NegativeResponseError(0x2f, 0x22);
    expect(negative).toBeInstanceOf(Error);
    expect(negative.nrc).toBe(0x22);
    expect(negative.message).toContain('conditions not correct');
    expect(negative.message).toContain('0x2F');

    expect(new TimeoutError('deadline').kind).toBe('deadline');
    expect(new AdapterError('no-data').message).toBe('no-data');
    expect(new LinkClosedError().name).toBe('LinkClosedError');
    expect(new CancelledError().name).toBe('CancelledError');
  });

  it('wraps non-errors', () => {
    const original = new Error('x');
    expect(toError(original)).toBe(original);
    expect(toError('boom').message).toBe('boom');
  });
});
