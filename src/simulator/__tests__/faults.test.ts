import { FaultInjector } from '../faults';
import { createRng } from '../rng';

const IO_CONTROL = 0x2f;
const READ = 0x22;

const trace = (seed: number, requests: number) => {
  const faults = new FaultInjector(seed);
  faults.configure({
    latency: { fixedMs: 10, jitterMs: 20 },
    conditionsNotCorrect: { probability: 0.4 },
    timeouts: { probability: 0.2 },
  });

  return Array.from({ length: requests }, () => faults.plan(IO_CONTROL));
};

describe('FaultInjector', () => {
  it('is reproducible for the same seed and differs between seeds', () => {
    expect(trace(7, 50)).toEqual(trace(7, 50));
    expect(trace(7, 50)).not.toEqual(trace(8, 50));
  });

  it('keeps latency within fixed plus jitter', () => {
    for (const { latencyMs } of trace(3, 100)) {
      expect(latencyMs).toBeGreaterThanOrEqual(10);
      expect(latencyMs).toBeLessThanOrEqual(30);
    }
  });

  it('plans plain responses by default', () => {
    expect(new FaultInjector(1).plan(READ)).toEqual({
      action: 'respond',
      latencyMs: 0,
      pendingCount: 0,
    });
  });

  it('resets every fault', () => {
    const faults = new FaultInjector(1);
    faults.configure({ ignitionOff: true, latency: 'ble', dropAfterRequests: 0 });
    faults.reset();

    expect(faults.plan(READ)).toEqual({ action: 'respond', latencyMs: 0, pendingCount: 0 });
  });

  it('resolves latency presets and notifies listeners', () => {
    const faults = new FaultInjector(1);
    const listener = jest.fn();
    const unsubscribe = faults.onChange(listener);

    faults.configure({ latency: 'thor' });

    expect(faults.plan(READ).latencyMs).toBeGreaterThanOrEqual(15);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    faults.configure({ latency: 'enet' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('exposes the drop time', () => {
    const faults = new FaultInjector(1);
    faults.configure({ dropAtMs: 500 });

    expect(faults.dropAtMs).toBe(500);
  });
});

describe('createRng', () => {
  it('yields values in [0, 1) deterministically', () => {
    const first = createRng(42);
    const second = createRng(42);

    for (let index = 0; index < 20; index++) {
      const value = first();

      expect(value).toBe(second());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
