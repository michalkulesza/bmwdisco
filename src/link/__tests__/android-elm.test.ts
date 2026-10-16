import { fromHex } from '@/protocol/bytes';
import { frameLine, FakeElm, type ElmHandler } from '@/test-utils/fake-elm';
import { FakeTransport } from '@/test-utils/fake-transport';

import { ElmIsoTpLink } from '../elm-isotp-link';

const setup = (handler: ElmHandler = () => undefined) => {
  const transport = new FakeTransport();
  const elm = new FakeElm(transport, (command) => {
    const response = handler(command);
    if (response !== undefined) return response;
    if (command === 'ATI') return 'ELM327 v1.5';
    if (command.startsWith('AT')) return 'OK';
    return 'NO DATA';
  });
  return { transport, elm, link: new ElmIsoTpLink(transport, { settleMs: 0 }, 'android-mode2') };
};

describe('Android Android adapter default ELM mode', () => {
  it('wakes with ATI and configures extended addressing without resetting with ATZ', async () => {
    const { elm, link } = setup();
    await link.open();
    expect(elm.commands).toEqual([
      'ATI',
      'ATI',
      'ATD',
      'ATE0',
      'ATS0',
      'ATL0',
      'ATAL',
      'ATAT0',
      'ATH1',
      'ATPB C101',
      'ATCRA 612',
      'ATSH 6F1',
      'ATFC SH6F1',
      'ATFCSD 12300002',
      'ATFC SM1',
      'ATCEA 12',
      'ATCM 600',
      'ATCF 600',
      'ATSP B',
      'ATBI',
      'ATAT0',
    ]);
    await link.close();
  });

  it('sends UDS once without duplicating the target and PCI inserted by the adapter', async () => {
    const { elm, link } = setup((command) =>
      command === '22F150' ? frameLine(0x640, 'F1 06 62 F1 50 0F 16 B0') : undefined,
    );
    await link.open();
    const start = elm.commands.length;
    expect(await link.request(0x40, fromHex('22 F1 50'))).toEqual(fromHex('62 F1 50 0F 16 B0'));
    await link.request(0x40, fromHex('22 F1 50'));
    expect(elm.commands.slice(start)).toEqual([
      'ATCEA 40',
      'ATCRA 640',
      'ATFCSD 40300002',
      '22F150',
      '22F150',
    ]);
    await link.close();
  });

  it('switches formatting for long requests, strips only the target, then returns to automatic SF', async () => {
    const { elm, link } = setup((command) => {
      if (command === '10072ED5420005') return frameLine(0x640, 'F1 30 00 00');
      if (command === '21006400000000') return frameLine(0x640, 'F1 03 6E D5 42');
      if (command === '3E00') return frameLine(0x640, 'F1 02 7E 00');
      return undefined;
    });
    await link.open();
    const start = elm.commands.length;
    expect(await link.request(0x40, fromHex('2E D5 42 00 05 00 64'))).toEqual(fromHex('6E D5 42'));
    await link.request(0x40, fromHex('3E 00'));
    expect(elm.commands.slice(start)).toEqual([
      'ATCEA 40',
      'ATCRA 640',
      'ATFCSD 40300002',
      'ATCAF0',
      '10072ED5420005',
      '21006400000000',
      'ATCAF1',
      '3E00',
    ]);
    await link.close();
  });

  it('reassembles multi-frame identification responses', async () => {
    const { link } = setup((command) =>
      command === '22F190'
        ? [
            frameLine(0x640, 'F1 10 09 62 F1 90 57 42'),
            frameLine(0x640, 'F1 21 41 31 32 33 00 00'),
          ].join('\r')
        : undefined,
    );
    await link.open();
    expect(await link.request(0x40, fromHex('22 F1 90'))).toEqual(
      fromHex('62 F1 90 57 42 41 31 32 33'),
    );
    await link.close();
  });

  it.each(['?', ''])('fails closed on missing ATI identity %j', async (identity) => {
    const { link, transport } = setup((command) => (command === 'ATI' ? identity : undefined));
    await expect(link.open()).rejects.toMatchObject({ code: 'not-elm' });
    expect(transport.closeCalls).toBe(1);
  });

  it.each(['?', ''])('requires initialization acknowledgement %j', async (reply) => {
    const { link } = setup((command) => (command === 'ATPB C101' ? reply : undefined));
    await expect(link.open()).rejects.toMatchObject({ code: 'adapter-rejected' });
  });
});
