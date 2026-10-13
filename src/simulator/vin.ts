import { createRng, hashText } from './rng';

const VIN_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const LETTER_VALUES: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

const valueOf = (char: string): number => LETTER_VALUES[char] ?? Number(char);

const checkDigit = (vin: string): string => {
  const sum = Array.from(vin).reduce(
    (total, char, index) => total + valueOf(char) * WEIGHTS[index]!,
    0,
  );
  const remainder = sum % 11;

  return remainder === 10 ? 'X' : String(remainder);
};

export const makeVin = (chassis: string): string => {
  const rng = createRng(hashText(chassis));
  const pick = (alphabet: string) => alphabet[Math.floor(rng() * alphabet.length)]!;
  const digits = (count: number) =>
    Array.from({ length: count }, () => pick('0123456789')).join('');
  const descriptor = Array.from({ length: 5 }, () => pick(VIN_ALPHABET)).join('');
  const body = `WBA${descriptor}0G${pick('ABCDEFGHJKLMN')}${digits(6)}`;

  return `${body.slice(0, 8)}${checkDigit(body)}${body.slice(9)}`;
};
