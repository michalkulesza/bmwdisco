import { TransportError } from '../errors';
import { assertAllowedHost, isAllowedHost } from '../host';

describe('isAllowedHost', () => {
  it.each([
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.0.10',
    '192.168.16.249',
    '169.254.1.1',
  ])('allows %s', (host) => {
    expect(isAllowedHost(host)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '172.15.0.1',
    '172.32.0.1',
    '192.169.0.1',
    '169.253.0.1',
    '127.0.0.1',
    '0.0.0.0',
    '11.0.0.1',
    '10.0.0.256',
    '10.0.0',
    '10.0.0.1.1',
    'localhost',
    'example.com',
    '::1',
    'fe80::1',
    '',
    ' 10.0.0.1',
    '10.0.0.1/8',
    '010.0.0.1',
    '10.00.0.1',
  ])('rejects %j', (host) => {
    expect(isAllowedHost(host)).toBe(false);
  });

  it('throws a typed error when asserting', () => {
    expect(() => assertAllowedHost('8.8.8.8')).toThrow(TransportError);
    expect(() => assertAllowedHost('192.168.0.10')).not.toThrow();
  });
});
