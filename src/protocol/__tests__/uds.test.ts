import { fromHex } from '../bytes';
import { matchUdsResponse } from '../uds';

const match = (request: string, response: string) =>
  matchUdsResponse(fromHex(request), fromHex(response)).kind;

describe('matchUdsResponse', () => {
  it('matches ReadDataByIdentifier on DID', () => {
    expect(match('22 F1 50', '62 F1 50 0F 16 B0')).toBe('positive');
    expect(match('22 F1 50', '62 F1 51 00')).toBe('unrelated');
    expect(match('22 F1 50', '62 F1 50')).toBe('unrelated');
    expect(match('22 F1', '62 F1 50 00')).toBe('unrelated');
  });

  it('matches session control and tester present on sub-function', () => {
    expect(match('10 03', '50 03 00 32 01 F4')).toBe('positive');
    expect(match('10 01', '50 03')).toBe('unrelated');
    expect(match('10', '50 03')).toBe('unrelated');
    expect(match('3E 80', '7E 00')).toBe('positive');
    expect(match('3E 00', '7E 01')).toBe('unrelated');
  });

  it('matches WriteDataByIdentifier exactly', () => {
    expect(match('2E D5 42 00 05 00 64', '6E D5 42')).toBe('positive');
    expect(match('2E D5 42 00 05 00 64', '6E D5 42 00')).toBe('unrelated');
    expect(match('2E D5 42 00 05 00 64', '6E D5 43')).toBe('unrelated');
  });

  it('matches routine control on sub-function and routine id', () => {
    expect(match('31 01 F0 12 01', '71 01 F0 12 00')).toBe('positive');
    expect(match('31 01 F0 12 01', '71 01 F0 13')).toBe('unrelated');
  });

  describe('IO control', () => {
    it('accepts a bare acknowledgement', () => {
      expect(match('2F 45 01 03 0D 01', '6F 45 01 03')).toBe('positive');
    });

    it('requires the channel to match when the response echoes it', () => {
      expect(match('2F 45 01 03 0D 01', '6F 45 01 03 0D 01')).toBe('positive');
      expect(match('2F 45 01 03 0D 01', '6F 45 01 03 0E 01')).toBe('unrelated');
    });

    it('matches channel-in-DID requests on the DID', () => {
      expect(match('2F 01 1C 03 64', '6F 01 1C 03')).toBe('positive');
      expect(match('2F 01 1C 03 64', '6F 01 1D 03')).toBe('unrelated');
    });

    it('requires the control parameter to match', () => {
      expect(match('2F 45 01 00 FE', '6F 45 01 03')).toBe('unrelated');
      expect(match('2F 45 01 00 FE', '6F 45 01 00 FE')).toBe('positive');
    });

    it('rejects truncated frames', () => {
      expect(match('2F 45 01', '6F 45 01')).toBe('unrelated');
      expect(match('2F 45 01 03', '6F 45 01')).toBe('unrelated');
    });
  });

  it('accepts unknown services on the positive service id alone', () => {
    expect(match('19 02 FF', '59 02 FF')).toBe('positive');
    expect(match('19 02 FF', '5A 02 FF')).toBe('unrelated');
  });

  describe('negative responses', () => {
    it('reports pending and negative codes for the requested service', () => {
      expect(matchUdsResponse(fromHex('2F 45 01 03 0D 01'), fromHex('7F 2F 78'))).toEqual({
        kind: 'pending',
      });
      expect(matchUdsResponse(fromHex('2F 45 01 03 0D 01'), fromHex('7F 2F 22'))).toEqual({
        kind: 'negative',
        code: 0x22,
      });
    });

    it('ignores negative frames for other services or with bad length', () => {
      expect(match('2F 45 01 03 0D 01', '7F 22 31')).toBe('unrelated');
      expect(match('2F 45 01 03 0D 01', '7F 2F')).toBe('unrelated');
      expect(match('2F 45 01 03 0D 01', '7F 2F 22 00')).toBe('unrelated');
    });
  });

  it('treats empty frames as unrelated', () => {
    expect(matchUdsResponse(new Uint8Array(), fromHex('62'))).toEqual({ kind: 'unrelated' });
    expect(matchUdsResponse(fromHex('22 F1 50'), new Uint8Array())).toEqual({ kind: 'unrelated' });
  });
});
