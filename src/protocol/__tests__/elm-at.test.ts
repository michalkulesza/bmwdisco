import { ecuAddressCommands, ecuHex, ELM_INIT_COMMANDS, parseElmLine } from '../elm-at';

describe('ELM commands', () => {
  it('starts with a reset and ends with the tester header', () => {
    expect(ELM_INIT_COMMANDS[0]).toBe('ATZ');
    expect(ELM_INIT_COMMANDS.slice(-2)).toEqual(['ATFCSH6F1', 'ATSH6F1']);
    expect(ELM_INIT_COMMANDS).toHaveLength(13);
  });

  it('builds per-ECU addressing commands', () => {
    expect(ecuAddressCommands(0x40)).toEqual(['ATFCSD4030FF08', 'ATFCSM1', 'ATCRA640', 'ATCEA40']);
    expect(ecuHex(0x0a)).toBe('0A');
    expect(() => ecuHex(256)).toThrow(RangeError);
  });
});

describe('parseElmLine', () => {
  it('parses frames with or without spaces and prompt characters', () => {
    expect(parseElmLine('640F1 03 62 F1 50')).toEqual({
      kind: 'frame',
      id: 0x640,
      data: Uint8Array.of(0xf1, 0x03, 0x62, 0xf1, 0x50),
    });
    expect(parseElmLine('>640F10362F150')).toMatchObject({ kind: 'frame', id: 0x640 });
  });

  it.each([
    ['NO DATA', 'no-data'],
    ['CAN ERROR', 'can-error'],
    ['BUFFER FULL', 'buffer-full'],
    ['UNABLE TO CONNECT', 'can-error'],
    ['BUS BUSY', 'can-error'],
    ['?', 'adapter-rejected'],
  ])('maps %s to a typed error', (line, code) => {
    const parsed = parseElmLine(line);

    expect(parsed.kind).toBe('error');
    expect(parsed.kind === 'error' && parsed.error.code).toBe(code);
  });

  it('treats banners, OK and blanks as other', () => {
    expect(parseElmLine('OK').kind).toBe('other');
    expect(parseElmLine('ELM327 v1.5').kind).toBe('other');
    expect(parseElmLine('  ').kind).toBe('other');
    expect(parseElmLine('>').kind).toBe('other');
    expect(parseElmLine('6401').kind).toBe('other');
  });
});
