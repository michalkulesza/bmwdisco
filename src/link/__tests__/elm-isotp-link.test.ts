import { asciiToBytes, concatBytes, fromHex } from '@/protocol/bytes';
import { ELM_INIT_COMMANDS } from '@/protocol/elm-at';
import {
  CancelledError,
  LinkClosedError,
  NegativeResponseError,
  TimeoutError,
} from '@/protocol/errors';
import { encodeIsoTp, frameToCommand } from '@/protocol/isotp';
import { frameLine, FakeElm, type ElmHandler } from '@/test-utils/fake-elm';
import { FakeTransport } from '@/test-utils/fake-transport';
import { TransportError } from '@/transport/errors';

import { ElmIsoTpLink } from '../elm-isotp-link';

const ECU = 0x40;
const ID = 0x640;
const FAST = { settleMs: 0, monitorMs: 5 };

const sf = (hex: string, id = ID) => frameLine(id, hex);

const adapter = (script: ElmHandler = () => undefined) => {
  const transport = new FakeTransport();
  const elm = new FakeElm(transport, (command) => {
    if (command === 'ATZ') return '\rELM327 v1.5';
    const reply = script(command);
    if (command.startsWith('AT')) return reply === undefined ? 'OK' : reply;

    return reply;
  });
  const link = new ElmIsoTpLink(transport, FAST);

  return { transport, elm, link };
};

const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe('ElmIsoTpLink handshake', () => {
  it('runs the init list in order and becomes open', async () => {
    const { elm, link } = adapter();

    await link.open();

    expect(link.state).toBe('open');
    expect(elm.commands).toEqual([...ELM_INIT_COMMANDS]);
  });

  it('rejects devices that are not ELM327 compatible', async () => {
    const transport = new FakeTransport();
    new FakeElm(transport, () => 'HELLO');
    const link = new ElmIsoTpLink(transport, FAST);

    await expect(link.open()).rejects.toMatchObject({ code: 'not-elm' });
    expect(link.state).toBe('failed');
  });

  it('reports a silent adapter as not-elm', async () => {
    jest.useFakeTimers();
    try {
      const link = new ElmIsoTpLink(new FakeTransport(), { ...FAST, handshakeMs: 1000 });
      const outcome = link.open().catch((e: unknown) => e);

      await jest.advanceTimersByTimeAsync(1000);

      expect(await outcome).toMatchObject({ code: 'not-elm' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports a rejected init command', async () => {
    const { link } = adapter((command) => (command === 'ATPBE101' ? '?' : undefined));

    await expect(link.open()).rejects.toMatchObject({ code: 'adapter-rejected' });
  });

  it('can be cancelled during the handshake', async () => {
    const transport = new FakeTransport();
    const link = new ElmIsoTpLink(transport, FAST);
    const controller = new AbortController();
    const outcome = link.open(controller.signal).catch((e: unknown) => e);
    await flush();

    controller.abort();

    expect(await outcome).toBeInstanceOf(CancelledError);
  });
});

describe('ElmIsoTpLink requests', () => {
  it('switches ECU once, sends a single frame and returns the payload', async () => {
    const { elm, link } = adapter((command) =>
      command === '400322F150AAAAAA' ? sf('F1 06 62 F1 50 0F 16 B0') : undefined,
    );
    await link.open();
    const initCount = elm.commands.length;

    const first = await link.request(ECU, fromHex('22 F1 50'));
    const second = await link.request(ECU, fromHex('22 F1 50'));

    expect(first).toEqual(fromHex('62 F1 50 0F 16 B0'));
    expect(second).toEqual(first);
    expect(elm.commands.slice(initCount)).toEqual([
      'ATFCSD4030FF08',
      'ATFCSM1',
      'ATCRA640',
      'ATCEA40',
      '400322F150AAAAAA',
      '400322F150AAAAAA',
    ]);
  });

  it('re-addresses when the ECU changes and only then', async () => {
    const { elm, link } = adapter((command) =>
      command.length === 16
        ? sf(`F1 02 7E 00`, 0x600 + parseInt(command.slice(0, 2), 16))
        : undefined,
    );
    await link.open();

    await link.request(0x40, fromHex('3E 00'));
    await link.request(0x72, fromHex('3E 00'));
    await link.request(0x40, fromHex('3E 00'));

    expect(elm.commands.filter((command) => command.startsWith('ATCEA'))).toEqual([
      'ATCEA40',
      'ATCEA72',
      'ATCEA40',
    ]);
  });

  it('echo lines and noise around frames are ignored', async () => {
    const { link } = adapter((command) =>
      command.startsWith('4003')
        ? `${command}\rSEARCHING...\r${sf('F1 04 62 F1 50 AA')}\r`
        : undefined,
    );
    await link.open();

    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 AA'));
  });

  it('reassembles multi-frame responses', async () => {
    const response = fromHex('62 F1 90 57 42 41 31 32 33 34 35 36 37 38 39 30');
    const { link } = adapter((command) => {
      if (!command.startsWith('4003')) return undefined;

      return [
        sf('F1 10 10 62 F1 90 57 42'),
        sf('F1 21 41 31 32 33 34 35'),
        sf('F1 22 36 37 38 39 30 AA'),
      ].join('\r');
    });
    await link.open();

    expect(await link.request(ECU, fromHex('22 F1 90'))).toEqual(response);
  });

  it('segments multi-frame requests honouring flow control', async () => {
    const payload = fromHex('2E D5 42 00 05 00 64 00 01 02 03 04');
    const frames = encodeIsoTp(ECU, payload).map(frameToCommand);
    const { elm, link } = adapter((command) => {
      if (command === frames[0]) return sf('F1 30 00 00');
      if (command === frames[1]) return 'NO DATA';
      if (command === frames[2]) return sf('F1 03 6E D5 42');

      return undefined;
    });
    await link.open();

    const response = await link.request(ECU, payload);

    expect(response).toEqual(fromHex('6E D5 42'));
    expect(elm.commands.slice(-3)).toEqual(frames);
  });

  it('waits for a new flow control frame after each block', async () => {
    const payload = concatBytes(fromHex('2E D5 42'), new Uint8Array(17).fill(7));
    const frames = encodeIsoTp(ECU, payload).map(frameToCommand);
    const { elm, link } = adapter((command) => {
      const index = frames.indexOf(command);
      if (index < 0) return undefined;

      return index === frames.length - 1 ? sf('F1 03 6E D5 42') : sf('F1 30 01 00');
    });
    await link.open();

    const response = await link.request(ECU, payload);

    expect(response).toEqual(fromHex('6E D5 42'));
    expect(elm.commands.slice(-frames.length)).toEqual(frames);
  });

  it('fails when the ECU sends no or unsupported flow control', async () => {
    const payload = new Uint8Array(12).fill(1);
    const first = frameToCommand(encodeIsoTp(ECU, payload)[0]!);

    const silent = adapter((command) => (command === first ? 'NO DATA' : undefined));
    await silent.link.open();
    await expect(silent.link.request(ECU, payload)).rejects.toMatchObject({ code: 'flow-control' });

    const overflow = adapter((command) => (command === first ? sf('F1 32 00 00') : undefined));
    await overflow.link.open();
    await expect(overflow.link.request(ECU, payload)).rejects.toMatchObject({
      code: 'flow-control',
    });
  });

  it('extends through 0x78 by monitoring the bus', async () => {
    let monitoring = false;
    const { elm, link } = adapter((command) => {
      if (command.startsWith('4004')) return sf('F1 03 7F 2F 78');
      if (command === 'ATMA') {
        monitoring = true;

        return null;
      }
      if (command === '' && monitoring) return sf('F1 04 6F 45 01 03');

      return undefined;
    });
    await link.open();

    const response = await link.request(ECU, fromHex('2F 45 01 03'));

    expect(response).toEqual(fromHex('6F 45 01 03'));
    expect(elm.commands).toContain('ATMA');
  });

  it('keeps monitoring through repeated 0x78 frames', async () => {
    let round = 0;
    const { link } = adapter((command) => {
      if (command.startsWith('4004')) return sf('F1 03 7F 2F 78');
      if (command === 'ATMA') return null;
      if (command === '') {
        round++;

        return round < 3 ? sf('F1 03 7F 2F 78') : sf('F1 04 6F 45 01 03');
      }

      return undefined;
    });
    await link.open();

    expect(await link.request(ECU, fromHex('2F 45 01 03'))).toEqual(fromHex('6F 45 01 03'));
    expect(round).toBe(3);
  });

  it('maps negative responses', async () => {
    const { link } = adapter((command) =>
      command.startsWith('4004') ? sf('F1 03 7F 2F 22') : undefined,
    );
    await link.open();

    const failure = await link.request(ECU, fromHex('2F 45 01 03')).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(NegativeResponseError);
    expect((failure as NegativeResponseError).nrc).toBe(0x22);
    expect(link.state).toBe('open');
  });

  it.each([
    ['NO DATA', 'no-data'],
    ['CAN ERROR', 'can-error'],
    ['BUFFER FULL', 'buffer-full'],
  ])('maps %s to a typed adapter error and keeps the link', async (line, code) => {
    const { link } = adapter((command) => (command.startsWith('4003') ? line : undefined));
    await link.open();

    await expect(link.request(ECU, fromHex('22 F1 50'))).rejects.toMatchObject({ code });
    expect(link.state).toBe('open');
  });

  it('ignores unrelated replies and then reports no data', async () => {
    const { link } = adapter((command) =>
      command.startsWith('4003') ? sf('F1 03 62 F1 51') : undefined,
    );
    await link.open();

    await expect(link.request(ECU, fromHex('22 F1 50'))).rejects.toMatchObject({
      code: 'no-data',
    });
  });

  it('rejects a failing ECU address command', async () => {
    const { link } = adapter((command) => (command.startsWith('ATCRA') ? '?' : undefined));
    await link.open();

    await expect(link.request(ECU, fromHex('3E 00'))).rejects.toMatchObject({
      code: 'adapter-rejected',
    });
  });

  it('does not wait for a response when none is expected', async () => {
    const { link } = adapter((command) => (command.startsWith('4002') ? 'NO DATA' : undefined));
    await link.open();

    const response = await link.request(ECU, fromHex('3E 80'), { expectResponse: false });

    expect(response).toEqual(new Uint8Array());
  });

  it('reassembles split BLE notifications', async () => {
    const transport = new FakeTransport();
    new FakeElm(
      transport,
      (command) => {
        if (command === 'ATZ') return '\rELM327 v1.5';
        if (command.startsWith('AT')) return 'OK';

        return sf('F1 04 62 F1 50 AA');
      },
      4,
    );
    const link = new ElmIsoTpLink(transport, FAST);
    await link.open();

    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 AA'));
  });

  it('waits for the prompt of a cancelled command before sending the next', async () => {
    const { elm, link } = adapter((command) =>
      command.startsWith('4003') ? sf('F1 04 62 F1 50 AA') : undefined,
    );
    await link.open();
    await link.request(ECU, fromHex('22 F1 50'));
    elm.hold();
    const controller = new AbortController();

    const cancelled = link.request(ECU, fromHex('22 F1 50'), { signal: controller.signal });
    await flush();
    controller.abort();
    await expect(cancelled).rejects.toBeInstanceOf(CancelledError);

    const next = link.request(ECU, fromHex('22 F1 50'));
    await flush();
    elm.release();

    expect(await next).toEqual(fromHex('62 F1 50 AA'));
    expect(link.state).toBe('open');
  });

  it('fails the link when a command never returns to the prompt', async () => {
    jest.useFakeTimers();
    try {
      const { elm, link } = adapter();
      await link.open();
      elm.hold();
      const outcome = link.request(ECU, fromHex('22 F1 50')).catch((e: unknown) => e);

      await jest.advanceTimersByTimeAsync(4000);

      expect(await outcome).toBeInstanceOf(TimeoutError);
      expect(link.state).toBe('failed');
    } finally {
      jest.useRealTimers();
    }
  });

  it('still fails the link on a probe timeout because ELM output cannot be attributed', async () => {
    jest.useFakeTimers();
    try {
      const { elm, link } = adapter();
      await link.open();
      elm.hold();
      const outcome = link
        .request(ECU, fromHex('22 F1 50'), { probe: true })
        .catch((e: unknown) => e);

      await jest.advanceTimersByTimeAsync(4000);

      expect(await outcome).toBeInstanceOf(TimeoutError);
      expect(link.state).toBe('failed');
    } finally {
      jest.useRealTimers();
    }
  });

  it('fails the next command when the abandoned one never returns', async () => {
    jest.useFakeTimers();
    try {
      const { elm, link } = adapter();
      await link.open();
      elm.hold();
      const controller = new AbortController();
      const cancelled = link
        .request(ECU, fromHex('22 F1 50'), { signal: controller.signal })
        .catch((e: unknown) => e);
      await jest.advanceTimersByTimeAsync(1);
      controller.abort();
      expect(await cancelled).toBeInstanceOf(CancelledError);

      const next = link.request(ECU, fromHex('22 F1 50')).catch((e: unknown) => e);
      await jest.advanceTimersByTimeAsync(4000);

      expect(await next).toBeInstanceOf(TimeoutError);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects in-flight work when the transport drops', async () => {
    const { elm, transport, link } = adapter();
    await link.open();
    elm.hold();
    const outcome = link.request(ECU, fromHex('22 F1 50')).catch((e: unknown) => e);
    await flush();

    transport.drop(new TransportError('closed'));

    expect(await outcome).toBeInstanceOf(LinkClosedError);
    expect(link.state).toBe('failed');
  });

  it('fails when a write fails mid-request', async () => {
    const { transport, link } = adapter();
    await link.open();
    transport.writeError = new TransportError('write-failed');

    await expect(link.request(ECU, fromHex('22 F1 50'))).rejects.toBeInstanceOf(LinkClosedError);
    expect(link.state).toBe('failed');
  });

  it('ignores unsolicited output while idle', async () => {
    const { transport, link } = adapter((command) =>
      command.startsWith('4003') ? sf('F1 04 62 F1 50 AA') : undefined,
    );
    await link.open();

    transport.push(asciiToBytes('LV RESET\r\r>'));

    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 AA'));
  });
});
