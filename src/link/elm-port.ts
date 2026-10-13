import { asciiToBytes, bytesToAscii } from '@/protocol/bytes';
import { ELM_PROMPT } from '@/protocol/elm-at';
import { abortReason, TimeoutError } from '@/protocol/errors';

export interface ElmCommandOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  breakAfterMs?: number;
}

interface Active {
  text: string;
  detached: boolean;
  resolve: (lines: string[]) => void;
  reject: (error: Error) => void;
}

interface Drainer {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const LINE_BREAK = /[\r\n]+/;
const CARRIAGE_RETURN = '\r';

export class ElmPort {
  private buffer = '';
  private active?: Active;
  private drainers: Drainer[] = [];

  constructor(private readonly write: (data: Uint8Array) => Promise<void>) {}

  feed(data: Uint8Array): void {
    this.buffer += bytesToAscii(data);
    const end = this.buffer.indexOf(ELM_PROMPT);
    if (end < 0) return;

    const text = this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end + 1);
    this.finishActive(text);
  }

  async command(text: string, options: ElmCommandOptions): Promise<string[]> {
    await this.drain(options.timeoutMs);
    if (options.signal?.aborted) throw abortReason(options.signal);

    this.buffer = '';

    return new Promise<string[]>((resolve, reject) => {
      const active: Active = { text, detached: false, resolve, reject };
      const timers: ReturnType<typeof setTimeout>[] = [];

      const detach = (error: Error) => {
        if (active.detached) return;
        active.detached = true;
        timers.forEach(clearTimeout);
        options.signal?.removeEventListener('abort', onAbort);
        reject(error);
      };
      const onAbort = () => detach(abortReason(options.signal!));

      active.resolve = (lines) => {
        timers.forEach(clearTimeout);
        options.signal?.removeEventListener('abort', onAbort);
        resolve(lines);
      };

      timers.push(setTimeout(() => detach(new TimeoutError('response')), options.timeoutMs));
      if (options.breakAfterMs !== undefined) {
        timers.push(
          setTimeout(
            () => void this.write(asciiToBytes(CARRIAGE_RETURN)).catch(reject),
            options.breakAfterMs,
          ),
        );
      }
      options.signal?.addEventListener('abort', onAbort, { once: true });

      this.active = active;
      this.write(asciiToBytes(`${text}${CARRIAGE_RETURN}`)).catch((error: unknown) =>
        detach(error instanceof Error ? error : new Error(String(error))),
      );
    });
  }

  reset(error: Error): void {
    const active = this.active;
    this.active = undefined;
    if (active && !active.detached) active.reject(error);

    const drainers = this.drainers;
    this.drainers = [];
    for (const drainer of drainers) {
      clearTimeout(drainer.timer);
      drainer.reject(error);
    }
    this.buffer = '';
  }

  private finishActive(text: string): void {
    const active = this.active;
    this.active = undefined;

    const lines = text
      .split(LINE_BREAK)
      .map((line) => line.trim())
      .filter((line) => line && line !== active?.text);
    if (active && !active.detached) active.resolve(lines);

    const drainers = this.drainers;
    this.drainers = [];
    for (const drainer of drainers) {
      clearTimeout(drainer.timer);
      drainer.resolve();
    }
  }

  private drain(timeoutMs: number): Promise<void> {
    if (!this.active) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.drainers = this.drainers.filter((drainer) => drainer.timer !== timer);
        reject(new TimeoutError('response', 'Adapter did not return to prompt'));
      }, timeoutMs);
      this.drainers.push({ resolve, reject, timer });
    });
  }
}
