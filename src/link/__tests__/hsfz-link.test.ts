import { concatBytes, fromHex } from '@/protocol/bytes';
import {
  AdapterError,
  CancelledError,
  LinkClosedError,
  NegativeResponseError,
  TimeoutError,
} from '@/protocol/errors';
import { encodeHsfzControl } from '@/protocol/hsfz';
import { FakeTransport } from '@/test-utils/fake-transport';
import { TransportError } from '@/transport/errors';

import { HsfzLink } from '../hsfz-link';

import type { LinkState } from '../types';

const ECU = 0x40;

const diagnostic = (source: number, destination: number, payload: string) =>
  encodeHsfzControl(0x01, concatBytes(Uint8Array.of(source, destination), fromHex(payload)));

const reply = (payload: string, source = ECU) => diagnostic(source, 0xf4, payload);

const setup = async () => {
  const transport = new FakeTransport();
  const link = new HsfzLink(transport);
  await link.open();

  return { transport, link };
};

const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe('HsfzLink', () => {
  it('opens, frames a request and resolves with the ECU payload', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => transport.push(reply('62 F1 50 0F 16 B0'));

    const response = await link.request(ECU, fromHex('22 F1 50'));

    expect(link.state).toBe('open');
    expect(response).toEqual(fromHex('62 F1 50 0F 16 B0'));
    expect(transport.written[0]).toEqual(fromHex('00 00 00 05 00 01 F4 40 22 F1 50'));
    expect(link.measuredRttMs).not.toBeNull();
  });

  it('reports state transitions', async () => {
    const transport = new FakeTransport();
    const link = new HsfzLink(transport);
    const states: LinkState[] = [];
    link.onStateChange((state) => states.push(state));

    await link.open();
    await link.close();

    expect(states).toEqual(['opening', 'open', 'closed']);
    expect(transport.closeCalls).toBe(1);
  });

  it('handles split chunks, merged frames, alive checks and ACKs', async () => {
    const { transport, link } = await setup();
    const ack = encodeHsfzControl(0x02, fromHex('F4 40 22 F1 50'));
    const alive = encodeHsfzControl(0x12, fromHex('00 F4'));
    const wire = concatBytes(alive, ack, reply('62 F1 50 AA'));

    transport.onWrite = (data) => {
      if (data.length !== 11) return;

      transport.push(wire.subarray(0, 3));
      transport.push(wire.subarray(3, 13));
      transport.push(wire.subarray(13));
    };

    const response = await link.request(ECU, fromHex('22 F1 50'));

    expect(response).toEqual(fromHex('62 F1 50 AA'));
    expect(transport.written).toContainEqual(fromHex('00 00 00 02 00 13 00 F4'));
  });

  it('does not treat an ACK as a response', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => transport.push(encodeHsfzControl(0x02, fromHex('F4 40 22 F1 50')));
    let settled = false;

    void link
      .request(ECU, fromHex('22 F1 50'))
      .then(() => (settled = true))
      .catch(() => undefined);
    await flush();

    expect(settled).toBe(false);
    await link.close();
  });

  it('ignores replies from other ECUs, other destinations and unrelated services', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => {
      transport.push(reply('62 F1 50 11', 0x41));
      transport.push(diagnostic(ECU, 0xf1, '62 F1 50 22'));
      transport.push(reply('62 F1 51 33'));
      transport.push(reply('62 F1 50 44'));
    };

    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 44'));
  });

  it('ignores an IO-control reply for another channel', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => {
      transport.push(reply('6F 45 01 03 0E 01'));
      transport.push(reply('6F 45 01 03 0D 01'));
    };

    const response = await link.request(ECU, fromHex('2F 45 01 03 0D 01'));

    expect(response).toEqual(fromHex('6F 45 01 03 0D 01'));
  });

  it('keeps waiting through 0x78 and resolves with the final answer', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => transport.push(reply('7F 2F 78'));
    let result: Uint8Array | undefined;

    void link.request(ECU, fromHex('2F 45 01 03 0D 01')).then((value) => (result = value));
    await flush();
    expect(result).toBeUndefined();

    transport.push(reply('6F 45 01 03'));
    await flush();

    expect(result).toEqual(fromHex('6F 45 01 03'));
  });

  it('rejects with a typed negative response and stays open', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => transport.push(reply('7F 2F 22'));

    const failure = await link.request(ECU, fromHex('2F 45 01 03 0D 01')).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(NegativeResponseError);
    expect((failure as NegativeResponseError).nrc).toBe(0x22);
    expect(link.state).toBe('open');
  });

  it('times out and fails the link', async () => {
    jest.useFakeTimers();
    try {
      const { link } = await setup();
      const states: LinkState[] = [];
      link.onStateChange((state) => states.push(state));
      const outcome = link.request(ECU, fromHex('22 F1 50')).catch((e: unknown) => e);

      await jest.advanceTimersByTimeAsync(4000);

      expect(await outcome).toBeInstanceOf(TimeoutError);
      expect(link.state).toBe('failed');
      expect(states).toEqual(['failed']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels a request via AbortSignal without failing the link', async () => {
    const { transport, link } = await setup();
    const controller = new AbortController();
    const cancelled = link.request(ECU, fromHex('22 F1 50'), { signal: controller.signal });
    await flush();

    controller.abort();
    await expect(cancelled).rejects.toBeInstanceOf(CancelledError);

    transport.push(reply('62 F1 50 99'));
    transport.onWrite = () => transport.push(reply('62 F1 50 55'));
    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 55'));
    expect(link.state).toBe('open');
  });

  it('sends high priority requests before queued normal ones', async () => {
    const { transport, link } = await setup();
    const sent: string[] = [];
    transport.onWrite = (data) => {
      sent.push(String(data[data.length - 1]));
      transport.push(reply(`7E ${data[data.length - 1]!.toString(16).padStart(2, '0')}`));
    };

    await Promise.all([
      link.request(ECU, fromHex('3E 01')),
      link.request(ECU, fromHex('3E 02')),
      link.request(ECU, fromHex('3E 03'), { priority: 'high' }),
    ]);

    expect(sent).toEqual(['1', '3', '2']);
  });

  it('resolves immediately when no response is expected', async () => {
    const { link, transport } = await setup();

    const response = await link.request(ECU, fromHex('3E 80'), { expectResponse: false });

    expect(response).toEqual(new Uint8Array());
    expect(transport.written).toHaveLength(1);
    expect(link.busy).toBe(false);
  });

  it('fails the link on error frames and malformed data', async () => {
    const first = await setup();
    const error = first.link.request(ECU, fromHex('22 F1 50')).catch((e: unknown) => e);
    first.transport.push(encodeHsfzControl(0x40, fromHex('01')));

    expect(await error).toBeInstanceOf(AdapterError);
    expect(first.link.state).toBe('failed');

    const second = await setup();
    second.transport.push(fromHex('FF FF FF FF 00 01'));
    expect(second.link.state).toBe('failed');
  });

  it('rejects the in-flight request when the transport drops', async () => {
    const { transport, link } = await setup();
    const outcome = link.request(ECU, fromHex('22 F1 50')).catch((e: unknown) => e);
    await flush();

    transport.drop(new TransportError('closed', 'reset'));

    expect(await outcome).toBeInstanceOf(LinkClosedError);
    expect(link.state).toBe('failed');
    await expect(link.request(ECU, fromHex('22 F1 50'))).rejects.toBeInstanceOf(LinkClosedError);
  });

  it('treats a clean transport close as a link failure', async () => {
    const { transport, link } = await setup();

    transport.drop();

    expect(link.state).toBe('failed');
  });

  it('maps transport open failures to typed errors', async () => {
    const transport = new FakeTransport();
    transport.openError = new TransportError('connect-failed', 'refused');
    const link = new HsfzLink(transport);

    await expect(link.open()).rejects.toBeInstanceOf(AdapterError);
    expect(link.state).toBe('failed');
  });

  it('refuses to open twice and to request before opening', async () => {
    const link = new HsfzLink(new FakeTransport());

    await expect(link.request(ECU, fromHex('22 F1 50'))).rejects.toBeInstanceOf(LinkClosedError);
    await link.open();
    await expect(link.open()).rejects.toBeInstanceOf(LinkClosedError);
  });

  it('fails when a write fails', async () => {
    const { transport, link } = await setup();
    transport.writeError = new TransportError('write-failed', 'broken pipe');

    await expect(link.request(ECU, fromHex('22 F1 50'))).rejects.toBeInstanceOf(LinkClosedError);
  });

  it('answers alive checks even when no request is pending and fails if the answer cannot be sent', async () => {
    const { transport, link } = await setup();
    transport.writeError = new TransportError('write-failed', 'broken pipe');

    transport.push(encodeHsfzControl(0x12, fromHex('00 F4')));
    await flush();

    expect(link.state).toBe('failed');
  });

  it('rejects pending requests on close', async () => {
    const { link } = await setup();
    const outcome = link.request(ECU, fromHex('22 F1 50')).catch((e: unknown) => e);
    await flush();

    await link.close();
    await link.close();

    expect(await outcome).toBeInstanceOf(LinkClosedError);
  });

  it('is cancelled during open when the transport reports it', async () => {
    const transport = new FakeTransport();
    transport.openError = new TransportError('cancelled');
    const link = new HsfzLink(transport);

    await expect(link.open()).rejects.toBeInstanceOf(CancelledError);
  });

  it('keeps the link open after a probe timeout and discards the late reply', async () => {
    const { transport, link } = await setup();

    await expect(
      link.request(0x41, fromHex('22 F1 50'), { probe: true, timeoutMs: 20, totalMs: 20 }),
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(link.state).toBe('open');

    transport.push(reply('62 F1 50 DE AD', 0x41));
    transport.onWrite = () => transport.push(reply('62 F1 50 0F 16 B0'));

    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 0F 16 B0'));
    expect(link.state).toBe('open');
  });

  it('still fails the link when a non-probe request times out', async () => {
    const { link } = await setup();

    await expect(
      link.request(ECU, fromHex('22 F1 50'), { timeoutMs: 20, totalMs: 20 }),
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(link.state).toBe('failed');
  });
});
