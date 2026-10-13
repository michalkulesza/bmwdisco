import { CommandQueue, type RequestContext } from '../command-queue';
import { CancelledError, LinkClosedError, TimeoutError } from '../errors';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

const deferred = <T = string>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const flush = async () => {
  for (let index = 0; index < 5; index++) await Promise.resolve();
};

describe('CommandQueue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs jobs one at a time in FIFO order', async () => {
    const queue = new CommandQueue();
    const log: string[] = [];
    const first = deferred();

    const a = queue.run(async () => {
      log.push('a:start');

      return first.promise;
    });
    const b = queue.run(async () => {
      log.push('b:start');

      return 'b';
    });
    await flush();

    expect(log).toEqual(['a:start']);
    expect(queue.busy).toBe(true);

    first.resolve('a');
    await expect(a).resolves.toBe('a');
    await expect(b).resolves.toBe('b');
    expect(log).toEqual(['a:start', 'b:start']);
    expect(queue.busy).toBe(false);
  });

  it('serves the priority lane before queued normal jobs but never preempts', async () => {
    const queue = new CommandQueue();
    const order: string[] = [];
    const gate = deferred();

    const running = queue.run(async () => {
      order.push('running');

      return gate.promise;
    });
    const normal = queue.run(async () => order.push('normal'));
    const high1 = queue.run(async () => order.push('high1'), { priority: 'high' });
    const high2 = queue.run(async () => order.push('high2'), { priority: 'high' });
    await flush();

    gate.resolve('done');
    await Promise.all([running, normal, high1, high2]);

    expect(order).toEqual(['running', 'high1', 'high2', 'normal']);
  });

  it('times out a job that never settles and then runs the next one', async () => {
    const queue = new CommandQueue();
    const stuck = queue.run(() => new Promise<string>(() => undefined));
    const next = queue.run(async () => 'next');
    const rejection = expect(stuck).rejects.toMatchObject({ kind: 'response' });

    await jest.advanceTimersByTimeAsync(4000);

    await rejection;
    await expect(next).resolves.toBe('next');
  });

  it('aborts the job signal on timeout', async () => {
    const queue = new CommandQueue();
    let seen: AbortSignal | undefined;
    const job = queue.run(
      (context) => {
        seen = context.signal;

        return new Promise<string>(() => undefined);
      },
      { timeoutMs: 100 },
    );
    const rejection = expect(job).rejects.toBeInstanceOf(TimeoutError);

    await jest.advanceTimersByTimeAsync(100);
    await rejection;

    expect(seen?.aborted).toBe(true);
    expect(seen?.reason).toBeInstanceOf(TimeoutError);
  });

  it('extends the per-request timeout on 0x78 up to the total deadline', async () => {
    const queue = new CommandQueue();
    let context!: RequestContext;
    const job = queue.run(
      (ctx) => {
        context = ctx;

        return new Promise<string>(() => undefined);
      },
      { timeoutMs: 4000, totalMs: 12000 },
    );
    const outcome = job.then(
      () => 'resolved',
      (error: TimeoutError) => error,
    );

    await jest.advanceTimersByTimeAsync(3000);
    context.extend();
    await jest.advanceTimersByTimeAsync(3000);
    context.extend();
    await jest.advanceTimersByTimeAsync(3000);
    context.extend();
    await jest.advanceTimersByTimeAsync(2999);
    let settled = false;
    void outcome.then(() => (settled = true));
    await flush();
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    const error = await outcome;

    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).kind).toBe('deadline');
  });

  it('switches to a deadline timeout once the remaining time is shorter than a window', async () => {
    const queue = new CommandQueue();
    let context!: RequestContext;
    const job = queue.run(
      (ctx) => {
        context = ctx;

        return new Promise<string>(() => undefined);
      },
      { timeoutMs: 1000, totalMs: 2500 },
    );
    const rejection = expect(job).rejects.toMatchObject({ kind: 'deadline' });

    await jest.advanceTimersByTimeAsync(900);
    context.extend();
    await jest.advanceTimersByTimeAsync(900);
    context.extend();
    await jest.advanceTimersByTimeAsync(700);
    await rejection;
  });

  it('fails immediately when extending after the deadline has passed', async () => {
    const queue = new CommandQueue();
    let context!: RequestContext;
    const job = queue.run(
      (ctx) => {
        context = ctx;

        return new Promise<string>(() => undefined);
      },
      { timeoutMs: 1000, totalMs: 1500 },
    );
    const rejection = expect(job).rejects.toMatchObject({ kind: 'deadline' });

    jest.setSystemTime(Date.now() + 5000);
    context.extend();

    await rejection;
  });

  it('rejects queued work when the caller aborts before it starts', async () => {
    const queue = new CommandQueue();
    const gate = deferred();
    const controller = new AbortController();
    const started = jest.fn();

    const first = queue.run(() => gate.promise);
    const queued = queue.run(async () => started(), { signal: controller.signal });
    await flush();

    controller.abort();
    await expect(queued).rejects.toBeInstanceOf(CancelledError);

    gate.resolve('ok');
    await first;
    expect(started).not.toHaveBeenCalled();
  });

  it('aborts the running job when the caller aborts and moves on', async () => {
    const queue = new CommandQueue();
    const controller = new AbortController();
    let signal: AbortSignal | undefined;

    const running = queue.run(
      (ctx) => {
        signal = ctx.signal;

        return new Promise<string>(() => undefined);
      },
      { signal: controller.signal },
    );
    const next = queue.run(async () => 'next');
    await flush();

    controller.abort();

    await expect(running).rejects.toBeInstanceOf(CancelledError);
    await expect(next).resolves.toBe('next');
    expect(signal?.aborted).toBe(true);
  });

  it('keeps a custom abort reason', async () => {
    const queue = new CommandQueue();
    const controller = new AbortController();
    const reason = new Error('user stopped');

    controller.abort(reason);

    await expect(queue.run(async () => 'x', { signal: controller.signal })).rejects.toBe(reason);
  });

  it('close() rejects queued and running jobs and refuses new ones', async () => {
    const queue = new CommandQueue();
    const running = queue.run(() => new Promise<string>(() => undefined));
    const queued = queue.run(async () => 'queued');
    await flush();
    const failure = new LinkClosedError();

    queue.close(failure);

    await expect(running).rejects.toBe(failure);
    await expect(queued).rejects.toBe(failure);
    await expect(queue.run(async () => 'late')).rejects.toBe(failure);
  });

  it('propagates job errors and continues', async () => {
    const queue = new CommandQueue();
    const failing = queue.run(async () => {
      throw new Error('boom');
    });
    const next = queue.run(async () => 'next');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('next');
  });

  it('wraps non-error rejections', async () => {
    const queue = new CommandQueue();

    await expect(queue.run(() => Promise.reject('plain'))).rejects.toThrow('plain');
  });
});
