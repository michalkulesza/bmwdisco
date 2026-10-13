import { describeModule, toHex } from '../__fixtures__/helpers';
import { F10_FRM3_ORACLE, F32_FEM_20_ORACLE, type OracleTable } from '../__fixtures__/oracle';
import { ELEMENT_IDS, categoryOf } from '../elements';
import { MODULE_SGBDS, loadModule } from '../generated';

const expectOracle = (sgbd: (typeof MODULE_SGBDS)[number], oracle: OracleTable) => {
  const { elements } = loadModule(sgbd);

  for (const [id, [on, off]] of Object.entries(oracle)) {
    const commands = elements[id as keyof typeof elements];
    expect({
      id,
      on: commands && toHex(commands.on),
      off: commands && toHex(commands.off),
    }).toEqual({
      id,
      on,
      off,
    });
  }
};

describe.each(MODULE_SGBDS)('module %s', (sgbd) => {
  const module = loadModule(sgbd);

  it('matches the byte snapshot', () => {
    expect(describeModule(module)).toMatchSnapshot();
  });

  it('is frozen and speaks UDS', () => {
    expect(Object.isFrozen(module)).toBe(true);
    expect(module.protocol).toBe('uds');
  });

  it('only exposes known element ids', () => {
    for (const id of Object.keys(module.elements)) expect(ELEMENT_IDS).toContain(id);
  });

  it('carries well-formed payloads', () => {
    const payloads = [
      module.keepalive,
      ...module.returnControl,
      ...Object.values(module.commands),
      ...Object.values(module.elements).flatMap((commands) => [commands.on, commands.off]),
    ];

    for (const bytes of payloads) {
      expect(bytes.length).toBeGreaterThan(0);
      expect(bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 0xff)).toBe(true);
    }
  });

  it('identifies via 22 F1 50 responses', () => {
    expect(module.identity.length).toBeGreaterThan(0);
    for (const entry of module.identity) {
      expect(toHex(entry.response.slice(0, 3))).toBe('62 F1 50');
      expect(toHex(entry.response.slice(3))).toBe(entry.sgbdHex.match(/../g)?.join(' '));
    }
  });
});

describe('prototype oracles', () => {
  it('reproduces every hand-mapped F32 / FEM_20 payload', () => {
    expectOracle('FEM_20', F32_FEM_20_ORACLE);
  });

  it('reproduces every hand-mapped F10 / FRM3 payload', () => {
    expectOracle('FRM3', F10_FRM3_ORACLE);
  });

  it('uses the FEM_20 identity, return control and keepalive of the prototype', () => {
    const fem = loadModule('FEM_20');

    expect(fem.identity.map((entry) => toHex(entry.response))).toEqual(['62 F1 50 0F 16 B0']);
    expect(fem.returnControl.map(toHex)).toEqual(['2F 45 01 00 FE']);
    expect(toHex(fem.keepalive)).toBe('3E FF');
    expect(fem.address).toBe(0x40);
  });

  it('uses the FRM3 identity and has no return control', () => {
    const frm = loadModule('FRM3');

    expect(frm.identity.map((entry) => toHex(entry.response))).toEqual(['62 F1 50 0F 10 D0']);
    expect(frm.returnControl).toEqual([]);
    expect(frm.address).toBe(0x72);
  });
});

describe('payload shapes', () => {
  const digitalFem = /^2F 45 01 03 [0-9A-F]{2} 0[01]$/;
  const aggregateFem = /^2E D5 42 00 [0-9A-F]{2} 00 (64|00)$/;
  const frm3 = /^2F 01 [0-9A-F]{2} 03 (64|00)$/;

  it('FEM_20 and BDC use digital output or aggregate frames only', () => {
    for (const sgbd of ['FEM_20', 'BDC'] as const) {
      for (const [id, commands] of Object.entries(loadModule(sgbd).elements)) {
        if (id === 'clusterFeedback') continue;
        for (const bytes of [commands.on, commands.off]) {
          expect(toHex(bytes)).toMatch(new RegExp(`${digitalFem.source}|${aggregateFem.source}`));
        }
      }
    }
  });

  it('FRM3 uses 2F 01 <channel> 03 64/00 frames and never channel 00', () => {
    for (const commands of Object.values(loadModule('FRM3').elements)) {
      expect(toHex(commands.on)).toMatch(frm3);
      expect(toHex(commands.on).split(' ')[2]).not.toBe('00');
      expect(toHex(commands.off)).toMatch(/^2F 01 [0-9A-F]{2} 03 00$/);
    }
  });

  it('REM_20 uses 2E 45 01 <channel> 01/00 frames', () => {
    for (const commands of Object.values(loadModule('REM_20').elements)) {
      expect(toHex(commands.on)).toMatch(/^2E 45 01 [0-9A-F]{2} 01$/);
      expect(toHex(commands.off)).toMatch(/^2E 45 01 [0-9A-F]{2} 00$/);
    }
  });

  it('FLE02 headlight LEDs start and stop routine A543', () => {
    const { elements } = loadModule('FLE02_L');

    expect(toHex(elements.ledHeadlightLeft3?.on ?? [])).toBe('31 01 A5 43 03');
    expect(toHex(elements.ledHeadlightLeft3?.off ?? [])).toBe('31 02 A5 43 03');
    expect(toHex(elements.ledHeadlightLeftAll?.on ?? [])).toBe('31 01 A5 43 FF');
    expect(toHex(loadModule('FLE02_L').commands.STOP_ROUTINE ?? [])).toBe('31 02 A5 43');
  });

  it('keeps LHM2 free of invented element payloads', () => {
    for (const sgbd of ['LHM2_L', 'LHM2_R'] as const) {
      expect(loadModule(sgbd).elements).toEqual({});
    }
  });

  it('does not expose the empty FRM3 SL_I_L channel', () => {
    expect(loadModule('FRM3').elements.tailInnerLeft).toBeUndefined();
    expect(toHex(loadModule('FRM3').elements.tailInnerRight?.on ?? [])).toBe('2F 01 01 03 64');
  });

  it('exposes cluster feedback on both cluster modules', () => {
    for (const sgbd of ['KOMB01', 'KOMB25'] as const) {
      const feedback = loadModule(sgbd).elements.clusterFeedback;

      expect(toHex(feedback?.on ?? [])).toBe('31 01 F0 12 01 FC 21');
      expect(toHex(feedback?.off ?? [])).toBe('31 01 F0 12 01 FC 00');
    }
  });
});

describe('element catalog', () => {
  it('assigns every id a category', () => {
    for (const id of ELEMENT_IDS) expect(categoryOf(id)).toBeDefined();
  });

  it('is fully used by at least one module', () => {
    const used = new Set(MODULE_SGBDS.flatMap((sgbd) => Object.keys(loadModule(sgbd).elements)));

    expect(ELEMENT_IDS.filter((id) => !used.has(id))).toEqual([]);
  });
});
