import { fromHex } from '@/protocol/bytes';
import { AdapterError, NegativeResponseError } from '@/protocol/errors';
import { encodeThorDiagnostic } from '@/protocol/thor';
import { FakeTransport } from '@/test-utils/fake-transport';

import { ThorLink } from '../thor-link';

const ECU = 0x40;

const reply = (payload: string, source = ECU) =>
  encodeThorDiagnostic(fromHex(payload), 0xf1, source);

const setup = async () => {
  const transport = new FakeTransport();
  const link = new ThorLink(transport);
  await link.open();

  return { transport, link };
};

describe('ThorLink', () => {
  it('sends BMW-FAST frames and resolves with the ECU payload', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => transport.push(reply('62 F1 50 0F 16 B0'));

    const response = await link.request(ECU, fromHex('22 F1 50'));

    expect(response).toEqual(fromHex('62 F1 50 0F 16 B0'));
    expect(transport.written[0]).toEqual(fromHex('83 40 F1 22 F1 50 17'));
  });

  it('filters the adapter echo of our own request', async () => {
    const { transport, link } = await setup();
    transport.onWrite = (data) => {
      transport.push(data);
      transport.push(reply('62 F1 50 AA'));
    };

    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 AA'));
  });

  it('reassembles a reply split across chunks', async () => {
    const { transport, link } = await setup();
    const wire = reply('62 F1 50 01 02 03');
    transport.onWrite = () => {
      transport.push(wire.subarray(0, 2));
      transport.push(wire.subarray(2));
    };

    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 01 02 03'));
  });

  it('ignores replies from other modules', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => {
      transport.push(reply('62 F1 50 11', 0x41));
      transport.push(reply('62 F1 50 22'));
    };

    expect(await link.request(ECU, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 22'));
  });

  it('handles 0x78 then negative responses', async () => {
    const { transport, link } = await setup();
    transport.onWrite = () => {
      transport.push(reply('7F 2F 78'));
      transport.push(reply('7F 2F 31'));
    };

    const failure = await link.request(ECU, fromHex('2F 45 01 03 0D 01')).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(NegativeResponseError);
    expect((failure as NegativeResponseError).nrc).toBe(0x31);
  });

  it('fails the link on a checksum error', async () => {
    const { transport, link } = await setup();
    const wire = reply('62 F1 50 AA');
    wire[wire.length - 1] = (wire[wire.length - 1]! + 1) & 0xff;

    const outcome = link.request(ECU, fromHex('22 F1 50')).catch((e: unknown) => e);
    transport.push(wire);

    expect(await outcome).toBeInstanceOf(AdapterError);
    expect(link.state).toBe('failed');
  });
});
