export interface KeepaliveOptions {
  send: () => Promise<unknown>;
  isBusy: () => boolean;
  intervalMs: number;
  onError?: (error: Error) => void;
}

export class KeepaliveScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(private options: KeepaliveOptions) {}

  configure(options: Partial<Pick<KeepaliveOptions, 'intervalMs'>>): void {
    this.options = { ...this.options, ...options };
    if (this.running) this.schedule();
  }

  start(): void {
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  touch(): void {
    if (this.running) this.schedule();
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), this.options.intervalMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    if (this.options.isBusy()) {
      this.schedule();

      return;
    }

    try {
      await this.options.send();
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }

    if (this.running) this.schedule();
  }
}
