import { DemoLink } from './demo-link';
import { DiagnosticLink, LinkFactory, Mode, hex } from './link';
import { femIdentify, femExtendedSession, femDefaultSession, femReturnControl, femIndicator, isFemIdentity } from './protocol/fem';
export type { Mode } from './link';

export interface SessionState {
  status: string; connected: boolean; verified: boolean; busy: boolean;
  logs: string[]; identity: string | null; error: string | null;
}

const defaultFactory: LinkFactory = (mode, host, port, log, lost) => {
  if (mode === 'demo') return new DemoLink(log);
  // Loaded only for live connections; demo works without this native module.
  const { NativeLink } = require('./native-link') as typeof import('./native-link');
  return new NativeLink(mode, host, port, log, lost);
};

export class VehicleSession {
  state: SessionState = { status: 'Disconnected', connected: false, verified: false,
    busy: false, logs: [], identity: null, error: null };
  private link?: DiagnosticLink;
  private operation?: Promise<void>;
  private cancelled = false;
  private wake?: () => void;
  constructor(private changed: (state: SessionState) => void, private factory: LinkFactory = defaultFactory) {}
  private update(values: Partial<SessionState>) { this.state = { ...this.state, ...values }; this.changed(this.state); }
  private log = (message: string) => {
    this.update({ logs: [...this.state.logs.slice(-299), `${new Date().toISOString()} ${message}`] });
  };
  private fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.log(`ERROR ${message}`); this.update({ error: message, status: 'Action failed' });
  }
  private lost = (error: Error) => {
    this.cancelled = true; this.wake?.();
    this.update({ connected: false, verified: false });
    this.fail(new Error(`${error.message}. If a test was active, ECU control restoration is unconfirmed.`));
  };
  private run(task: () => Promise<void>): Promise<void> {
    if (this.operation) return Promise.resolve();
    this.cancelled = false;
    this.update({ busy: true, error: null });
    const promise = task().catch(error => this.fail(error)).finally(() => {
      this.operation = undefined; this.update({ busy: false });
    });
    this.operation = promise;
    return promise;
  }
  connect(mode: Mode, host: string, port: number): Promise<void> {
    return this.run(async () => {
      if (this.state.connected) throw new Error('Disconnect before changing adapter');
      if (mode !== 'demo' && (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.split('.').some(n => Number(n) > 255)
        || !Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('Enter a valid IPv4 address and TCP port');
      this.link?.close();
      this.update({ status: 'Connecting…', identity: null, verified: false });
      this.log(`Connect ${mode.toUpperCase()} ${mode === 'demo' ? '(simulated)' : `${host}:${port}`}`);
      this.link = this.factory(mode, host, port, this.log, this.lost);
      try {
        await this.link.open();
        if (this.cancelled) throw new Error('Connection cancelled');
        this.update({ connected: true, status: 'Reading FEM identity…' });
        const response = await this.link.request(femIdentify());
        if (this.cancelled) throw new Error('Identification cancelled');
        const identity = hex(response.slice(3, 6)).replaceAll(' ', '');
        const verified = isFemIdentity(response);
        this.update({ identity, verified, status: verified ? (mode === 'demo' ? 'Simulated FEM_20 ready' : 'FEM_20 verified') : 'Controller mismatch — tests disabled' });
        this.log(`FEM identity ${identity || '(empty)'}; expected 0F16B0`);
      } catch (error) {
        this.link.close(); this.update({ connected: false, verified: false }); throw error;
      }
    });
  }
  private async request(payload: Uint8Array) {
    if (!this.link || !this.state.connected) throw new Error('Vehicle connection unavailable');
    return this.link.request(payload);
  }
  private async cleanup(): Promise<void> {
    this.update({ status: 'Restoring ECU control…' });
    let failure: unknown;
    // Attempt both operations, even if return-control is rejected by the ECU.
    for (const command of [femReturnControl(), femDefaultSession()]) {
      try { await this.request(command); } catch (error) { failure ??= error; }
    }
    if (failure) {
      this.update({ verified: false });
      throw new Error(`ECU restoration unconfirmed: ${failure instanceof Error ? failure.message : failure}. Reconnect and identify before another test.`);
    }
    this.log('ECU acknowledged return-control and default session');
    this.update({ status: 'ECU control restored' });
  }
  pulse(side: 'left' | 'right'): Promise<void> {
    return this.run(async () => {
      if (!this.state.verified) throw new Error('Identify a matching FEM_20 before testing');
      let failure: unknown;
      try {
        this.update({ status: `Testing front ${side} indicator…` });
        await this.request(femExtendedSession());
        if (this.cancelled) return;
        await this.request(femIndicator(side, true));
        if (!this.cancelled) await new Promise<void>(resolve => {
          const timer = setTimeout(() => { this.wake = undefined; resolve(); }, 1000);
          this.wake = () => { clearTimeout(timer); this.wake = undefined; resolve(); };
        });
        await this.request(femIndicator(side, false));
      } catch (error) { failure = error; }
      finally {
        try { await this.cleanup(); } catch (error) { failure = error; }
        if (failure) throw failure;
      }
    });
  }
  restore(): Promise<void> {
    return this.run(async () => {
      if (!this.state.verified) throw new Error('Identify a matching FEM_20 before restoring');
      await this.cleanup();
    });
  }
  async stop(): Promise<void> {
    this.cancelled = true; this.wake?.();
    if (this.operation) { this.log('Stop requested; finishing current reply then restoring control'); await this.operation; }
  }
  async disconnect(): Promise<void> {
    await this.stop(); this.link?.close(); this.link = undefined;
    this.update({ connected: false, verified: false, identity: null, status: 'Disconnected' });
  }
}
