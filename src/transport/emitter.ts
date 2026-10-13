import type { Unsubscribe } from './types';

export class Emitter<Args extends unknown[]> {
  private readonly listeners = new Set<(...args: Args) => void>();

  subscribe(listener: (...args: Args) => void): Unsubscribe {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(...args: Args): void {
    for (const listener of [...this.listeners]) listener(...args);
  }

  clear(): void {
    this.listeners.clear();
  }
}
