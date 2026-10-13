import { loadModule } from '@/data/generated';
import { fromHex } from '@/protocol/bytes';
import {
  AdapterError,
  CancelledError,
  LinkClosedError,
  NegativeResponseError,
  TimeoutError,
} from '@/protocol/errors';
import { LATENCY_PRESETS } from '@/simulator/faults';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';

import { DEMO_ADAPTER_ID, SimLink } from '../sim-link';

const FEM = 0x40;
const IDENTITY = fromHex('22 F1 50');
const EXTENDED = fromHex('10 03');
const fem = loadModule('FEM_20');
const lowBeamLeft = fem.elements.lowBeamLeft!;
const LOW_BEAM_ON = Uint8Array.from(lowBeamLeft.on);
const LOW_BEAM_OFF = Uint8Array.from(lowBeamLeft.off);
const RETURN_CONTROL = Uint8Array.from(fem.returnControl[0]!);
const FAST = { timeoutMs: 40 };

const setup = async (seed?: number) => {
  const vehicle = new SimulatedVehicle({ profile: 'F20', seed });
  const link = new SimLink(vehicle);
  await link.open();

  return { vehicle, link };
};

const failure = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  return undefined;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SimLink', () => {
  it('uses the demo adapter id', () => {
    expect(DEMO_ADAPTER_ID).toBe('demo');
  });

  it('identifies modules and controls lights through the real queue and matcher', async () => {
    const { vehicle, link } = await setup();

    expect(await link.request(FEM, IDENTITY)).toEqual(fromHex('62 F1 50 0F 16 B0'));
    expect(link.state).toBe('open');

    await link.request(FEM, EXTENDED);

    expect(await link.request(FEM, LOW_BEAM_ON)).toEqual(fromHex('6F 45 01 03 01'));
    expect(vehicle.getLitElements()).toEqual([{ sgbd: 'FEM_20', element: 'lowBeamLeft' }]);

    await link.request(FEM, RETURN_CONTROL);

    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('maps session and keepalive replies', async () => {
    const { link } = await setup();

    expect(await link.request(FEM, EXTENDED)).toEqual(fromHex('50 03 00 32 01 F4'));
    expect(await link.request(FEM, Uint8Array.from(fem.keepalive))).toEqual(fromHex('7E 7F'));
  });

  it('rejects IO control outside the extended session with a typed NRC', async () => {
    const { link } = await setup();

    const error = await failure(link.request(FEM, LOW_BEAM_ON));

    expect(error).toBeInstanceOf(NegativeResponseError);
    expect(error).toMatchObject({ service: 0x2f, nrc: 0x7f });
  });

  it('applies the latency preset to each reply', async () => {
    const { vehicle, link } = await setup();
    vehicle.faults.configure({ latency: { fixedMs: 30, jitterMs: 0 } });

    const startedAt = Date.now();
    await link.request(FEM, IDENTITY);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(25);
    expect(link.measuredRttMs).toBeGreaterThanOrEqual(25);
    expect(LATENCY_PRESETS.enet.fixedMs).toBeLessThan(LATENCY_PRESETS.thor.fixedMs);
    expect(LATENCY_PRESETS.thor.fixedMs).toBeLessThan(LATENCY_PRESETS.ble.fixedMs);
  });

  it('serves high priority requests before queued normal ones', async () => {
    const { vehicle, link } = await setup();
    vehicle.faults.configure({ latency: { fixedMs: 10, jitterMs: 0 } });

    const requests = [
      link.request(FEM, fromHex('3E 00')),
      link.request(FEM, IDENTITY),
      link.request(FEM, fromHex('22 F1 90')),
      link.request(FEM, EXTENDED, { priority: 'high' }),
    ];
    await Promise.all(requests);

    expect(vehicle.requestLog.map((entry) => entry.request[0])).toEqual([0x3e, 0x10, 0x22, 0x22]);
  });

  describe('NRC 0x22 conditionsNotCorrect', () => {
    it('rejects actuation for the next N requests only', async () => {
      const { vehicle, link } = await setup();
      await link.request(FEM, EXTENDED);
      vehicle.faults.configure({ conditionsNotCorrect: { requests: 2 } });

      const first = await failure(link.request(FEM, LOW_BEAM_ON));
      const second = await failure(link.request(FEM, LOW_BEAM_ON));

      expect(first).toBeInstanceOf(NegativeResponseError);
      expect(first).toMatchObject({ service: 0x2f, nrc: 0x22 });
      expect(second).toMatchObject({ nrc: 0x22 });
      expect(vehicle.getLitElements()).toEqual([]);

      await link.request(FEM, LOW_BEAM_ON);

      expect(vehicle.getLitElements()).toHaveLength(1);
    });

    it('does not affect reads and can be cleared', async () => {
      const { vehicle, link } = await setup();
      await link.request(FEM, EXTENDED);
      vehicle.faults.configure({ conditionsNotCorrect: { probability: 1 } });

      await link.request(FEM, IDENTITY);

      expect(await failure(link.request(FEM, LOW_BEAM_ON))).toMatchObject({ nrc: 0x22 });

      vehicle.faults.configure({ conditionsNotCorrect: undefined });

      await link.request(FEM, LOW_BEAM_ON);
    });
  });

  describe('0x78 responsePending', () => {
    it('extends the response window k times and then answers', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({
        latency: { fixedMs: 30, jitterMs: 0 },
        responsePending: { times: 3 },
      });

      const response = await link.request(FEM, IDENTITY, { timeoutMs: 60, totalMs: 1000 });

      expect(response).toEqual(fromHex('62 F1 50 0F 16 B0'));

      expect(await link.request(FEM, IDENTITY, { timeoutMs: 60 })).toEqual(response);
    });

    it('repeats for the configured number of requests', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({
        latency: { fixedMs: 30, jitterMs: 0 },
        responsePending: { times: 1, requests: 2 },
      });

      await link.request(FEM, IDENTITY, { timeoutMs: 45, totalMs: 1000 });
      await link.request(FEM, IDENTITY, { timeoutMs: 45, totalMs: 1000 });
      const third = Date.now();
      await link.request(FEM, IDENTITY, { timeoutMs: 45, totalMs: 1000 });

      expect(Date.now() - third).toBeLessThan(55);
    });

    it('still times out when the total deadline is exceeded', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({
        latency: { fixedMs: 30, jitterMs: 0 },
        responsePending: { times: 10 },
      });

      const error = await failure(link.request(FEM, IDENTITY, { timeoutMs: 60, totalMs: 100 }));

      expect(error).toBeInstanceOf(TimeoutError);
      expect(error).toMatchObject({ kind: 'deadline' });
    });
  });

  describe('timeouts', () => {
    it('drops the reply and surfaces a TimeoutError', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({ timeouts: { requests: 1 } });

      const error = await failure(link.request(FEM, IDENTITY, FAST));

      expect(error).toBeInstanceOf(TimeoutError);
      expect(link.state).toBe('failed');
    });

    it('times out for unknown ECUs and suppressed replies', async () => {
      const first = await setup();
      const second = await setup();

      expect(await failure(first.link.request(0x7a, IDENTITY, FAST))).toBeInstanceOf(TimeoutError);
      expect(await failure(second.link.request(FEM, fromHex('3E 80'), FAST))).toBeInstanceOf(
        TimeoutError,
      );
    });

    it('answers nothing in ignition-off mode', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({ ignitionOff: true });

      expect(await failure(link.request(FEM, IDENTITY, FAST))).toBeInstanceOf(TimeoutError);
    });

    it('fires without waiting when no response is expected', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({ ignitionOff: true });

      expect(await link.request(FEM, IDENTITY, { expectResponse: false })).toEqual(
        new Uint8Array(),
      );
      expect(vehicle.requestLog).toHaveLength(0);
    });

    it('applies fire-and-forget requests to the vehicle', async () => {
      const { vehicle, link } = await setup();
      vehicle.handle(FEM, EXTENDED);

      await link.request(FEM, LOW_BEAM_ON, { expectResponse: false });

      expect(vehicle.getLitElements()).toHaveLength(1);

      await link.request(FEM, LOW_BEAM_OFF, { expectResponse: false });

      expect(vehicle.getLitElements()).toEqual([]);
    });
  });

  describe('connection drops', () => {
    it('closes the link after N requests with LinkClosedError', async () => {
      const { vehicle, link } = await setup();
      const states: string[] = [];
      link.onStateChange((state) => states.push(state));
      vehicle.faults.configure({ dropAfterRequests: 2 });

      await link.request(FEM, IDENTITY);
      await link.request(FEM, IDENTITY);
      const error = await failure(link.request(FEM, IDENTITY));

      expect(error).toBeInstanceOf(LinkClosedError);
      expect(link.state).toBe('failed');
      expect(states).toEqual(['failed']);
      expect(await failure(link.request(FEM, IDENTITY))).toBeInstanceOf(LinkClosedError);
    });

    it('drops at a given time, even while idle', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({ dropAtMs: 20 });

      await sleep(60);

      expect(link.state).toBe('failed');
      expect(await failure(link.request(FEM, IDENTITY))).toBeInstanceOf(LinkClosedError);
    });

    it('fails an in-flight request when the drop timer fires', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({ latency: { fixedMs: 200, jitterMs: 0 }, dropAtMs: 20 });

      expect(await failure(link.request(FEM, IDENTITY))).toBeInstanceOf(LinkClosedError);
    });

    it('re-arms or cancels the timer when the configuration changes', async () => {
      const { vehicle, link } = await setup();
      vehicle.faults.configure({ dropAtMs: 20 });
      vehicle.faults.configure({ dropAtMs: undefined });

      await sleep(50);

      expect(link.state).toBe('open');

      vehicle.faults.reset();
      await link.close();

      expect(link.state).toBe('closed');
    });

    it('stops watching the faults after close', async () => {
      const { vehicle, link } = await setup();
      await link.close();

      vehicle.faults.configure({ dropAtMs: 1 });
      await sleep(20);

      expect(link.state).toBe('closed');
    });
  });

  it('cancels a pending reply when the caller aborts', async () => {
    const { vehicle, link } = await setup();
    vehicle.faults.configure({ latency: { fixedMs: 200, jitterMs: 0 } });
    const controller = new AbortController();

    const pending = failure(link.request(FEM, IDENTITY, { signal: controller.signal }));
    await sleep(10);
    controller.abort();

    expect(await pending).toBeInstanceOf(CancelledError);
  });

  it('cancels a silent request when the caller aborts', async () => {
    const { vehicle, link } = await setup();
    vehicle.faults.configure({ ignitionOff: true });
    const controller = new AbortController();

    const pending = failure(link.request(FEM, IDENTITY, { signal: controller.signal }));
    await sleep(10);
    controller.abort();

    expect(await pending).toBeInstanceOf(CancelledError);
  });

  it('reports an adapter error if the vehicle returns an unrelated reply', async () => {
    const { vehicle, link } = await setup();
    jest.spyOn(vehicle, 'handle').mockReturnValue(fromHex('62 AA BB CC'));

    expect(await failure(link.request(FEM, IDENTITY))).toBeInstanceOf(AdapterError);
  });
});
