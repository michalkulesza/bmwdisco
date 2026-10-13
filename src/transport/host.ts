import { TransportError } from './errors';

const OCTET = '(0|[1-9]\\d{0,2})';
const IPV4_PATTERN = new RegExp(`^${[OCTET, OCTET, OCTET, OCTET].join('\\.')}$`);

const parseOctets = (host: string): [number, number, number, number] | undefined => {
  const match = IPV4_PATTERN.exec(host);
  if (!match) return undefined;

  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return undefined;

  return octets as [number, number, number, number];
};

export const isAllowedHost = (host: string): boolean => {
  const octets = parseOctets(host);
  if (!octets) return false;

  const [first, second] = octets;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
};

export const assertAllowedHost = (host: string): void => {
  if (!isAllowedHost(host)) {
    throw new TransportError(
      'invalid-host',
      'Only private or link-local IPv4 addresses are allowed',
    );
  }
};
