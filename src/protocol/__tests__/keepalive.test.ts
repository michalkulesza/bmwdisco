import { KeepaliveScheduler } from '../keepalive';

describe('KeepaliveScheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const build = (overrides: { busy?: () => boolean; send?: () => Promise<unknown> } = {}) => {
    const send = jest.fn(overrides.send ?? (async () => 'ok'));
    const onError = jest.fn();
    const scheduler = new KeepaliveScheduler({
      send,
      isBusy: overrides.busy ?? (() => false),
      intervalMs: 1000,
      onError,
    });

    return { scheduler, send, onError };
  };

  it('sends on every interval while started', async () => {
    const { scheduler, send } = build();
    scheduler.start();

    await jest.advanceTimersByTimeAsync(3000);

    expect(send).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('skips a tick while a request is in flight and retries after the interval', async () => {
    let busy = true;
    const { scheduler, send } = build({ busy: () => busy });
    scheduler.start();

    await jest.advanceTimersByTimeAsync(2000);
    expect(send).not.toHaveBeenCalled();

    busy = false;
    await jest.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('stops sending after stop()', async () => {
    const { scheduler, send } = build();
    scheduler.start();
    await jest.advanceTimersByTimeAsync(1000);
    scheduler.stop();

    await jest.advanceTimersByTimeAsync(5000);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports send failures and keeps running', async () => {
    const { scheduler, send, onError } = build({
      send: async () => {
        throw new Error('nope');
      },
    });
    scheduler.start();

    await jest.advanceTimersByTimeAsync(2000);

    expect(send).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'nope' }));
    scheduler.stop();
  });

  it('wraps non-error failures', async () => {
    const { scheduler, onError } = build({ send: () => Promise.reject('plain') });
    scheduler.start();

    await jest.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'plain' }));
    scheduler.stop();
  });

  it('restarts the interval on touch()', async () => {
    const { scheduler, send } = build();
    scheduler.start();

    await jest.advanceTimersByTimeAsync(900);
    scheduler.touch();
    await jest.advanceTimersByTimeAsync(900);
    expect(send).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('ignores touch() when stopped and applies a new interval', async () => {
    const { scheduler, send } = build();
    scheduler.touch();
    await jest.advanceTimersByTimeAsync(5000);
    expect(send).not.toHaveBeenCalled();

    scheduler.start();
    scheduler.configure({ intervalMs: 200 });
    await jest.advanceTimersByTimeAsync(600);
    expect(send).toHaveBeenCalledTimes(3);

    scheduler.stop();
    scheduler.configure({ intervalMs: 50 });
    await jest.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('does not reschedule when stopped during a send', async () => {
    let finish!: () => void;
    const { scheduler, send } = build({
      send: () => new Promise<void>((resolve) => (finish = resolve)),
    });
    scheduler.start();
    await jest.advanceTimersByTimeAsync(1000);

    scheduler.stop();
    finish();
    await jest.advanceTimersByTimeAsync(5000);

    expect(send).toHaveBeenCalledTimes(1);
  });
});
