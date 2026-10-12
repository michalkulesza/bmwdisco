import { DemoLink } from './demo-link';
import { DiagnosticLink, LinkFactory, Mode, hex } from './link';
import { DEFAULT_SESSION, EXTENDED_SESSION, IDENTIFY, PROFILES, VehicleProfile, isProfileIdentity } from './protocol/profiles';
import { ElementId, LightingPreset, elementLabel, validatePreset } from './presets';
export type { Mode } from './link';

export interface SessionState {
  status: string; connected: boolean; verified: boolean; busy: boolean;
  logs: string[]; identity: string | null; vehicle: VehicleProfile | null; error: string | null;
  presetProgress?: { name: string; index: number; total: number; lights: ElementId[] } | null;
}

const defaultFactory: LinkFactory = (mode, host, port, log, lost) => {
  if (mode === 'demo') return new DemoLink(log);
  // Loaded only for live connections; demo works without this native module.
  const { NativeLink } = require('./native-link') as typeof import('./native-link');
  return new NativeLink(mode, host, port, log, lost);
};

export class VehicleSession {
  state: SessionState = { status: 'Disconnected', connected: false, verified: false,
    busy: false, logs: [], identity: null, vehicle: null, error: null };
  private link?: DiagnosticLink;
  private operation?: Promise<void>;
  private cancelled = false;
  private wake?: () => void;
  constructor(private changed: (state: SessionState) => void, private factory: LinkFactory = defaultFactory,
    private profiles: readonly VehicleProfile[] = PROFILES) {}
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
      this.update({ status: 'Connecting…', identity: null, verified: false, vehicle: null });
      this.log(`Connect ${mode.toUpperCase()} ${mode === 'demo' ? '(simulated)' : `${host}:${port}`}`);
      this.link = this.factory(mode, host, port, this.log, this.lost);
      try {
        await this.link.open();
        if (this.cancelled) throw new Error('Connection cancelled');
        this.update({ connected: true, status: 'Identifying vehicle…' });
        let firstIdentity: string | null = null;
        let vehicle: VehicleProfile | null = null;
        for (const profile of this.profiles) {
          const address = `0x${profile.address.toString(16).toUpperCase()}`;
          let response: Uint8Array;
          try { response = await this.link.request(IDENTIFY, profile.address); }
          catch (error) {
            if (this.cancelled) throw error;
            this.log(`Identity read ${address} failed: ${error instanceof Error ? error.message : error}`);
            continue;
          }
          if (this.cancelled) throw new Error('Identification cancelled');
          const identity = hex(response.slice(3, 6)).replaceAll(' ', '');
          this.log(`Identity read ${address}: ${identity || '(empty)'}; ${profile.ecu} expects ${profile.identity.slice(-8).replaceAll(' ', '')}`);
          firstIdentity ??= identity;
          if (isProfileIdentity(profile, response)) { vehicle = profile; firstIdentity = identity; break; }
        }
        const suffix = mode === 'demo' ? 'Simulated ' : '';
        this.update({ identity: firstIdentity, vehicle, verified: vehicle !== null,
          status: vehicle ? `${suffix}${vehicle.ecu} ${mode === 'demo' ? 'ready' : 'verified'}` : 'Controller mismatch — tests disabled' });
      } catch (error) {
        this.link.close(); this.update({ connected: false, verified: false }); throw error;
      }
    });
  }
  private async request(vehicle: VehicleProfile, payload: Uint8Array) {
    if (!this.link || !this.state.connected) throw new Error('Vehicle connection unavailable');
    return this.link.request(payload, vehicle.address);
  }
  private async cleanup(vehicle: VehicleProfile): Promise<void> {
    this.update({ status: 'Restoring ECU control…' });
    let failure: unknown;
    // Attempt every step, even if return-control is rejected by the ECU.
    for (const command of [...vehicle.returnControl, DEFAULT_SESSION]) {
      try { await this.request(vehicle, command); } catch (error) { failure ??= error; }
    }
    if (failure) {
      this.update({ verified: false });
      throw new Error(`ECU restoration unconfirmed: ${failure instanceof Error ? failure.message : failure}. Reconnect and identify before another test.`);
    }
    this.log('ECU acknowledged cleanup and default session');
    this.update({ status: 'ECU control restored' });
  }
  restore(): Promise<void> {
    return this.run(async () => {
      const vehicle = this.state.vehicle;
      if (!vehicle || !this.state.verified) throw new Error('Identify a supported vehicle before restoring');
      await this.cleanup(vehicle);
    });
  }
  playPreset(input: LightingPreset): Promise<void> {
    return this.run(async () => {
      const preset = validatePreset(input);
      const vehicle = this.state.vehicle;
      if (!this.state.connected || !this.state.verified || !vehicle) throw new Error('Identify a supported vehicle before running a preset');
      const touched = new Set<ElementId>();
      const lights = new Set<ElementId>();
      let failure: unknown;
      let expired = false;
      const deadline = setTimeout(() => { expired = true; this.cancelled = true; this.wake?.(); }, 90000);
      this.log(`Preset started: ${preset.name}`);
      try {
        await this.request(vehicle, EXTENDED_SESSION);
        for (const [index, step] of preset.steps.entries()) {
          if (this.cancelled) break;
          this.update({ status: `${preset.name} · block ${index + 1}/${preset.steps.length}`,
            presetProgress: { name: preset.name, index, total: preset.steps.length, lights: [...lights] } });
          if (step.type === 'wait') {
            this.log(`WAIT ${step.durationMs} ms`);
            await new Promise<void>(resolve => {
              const timer = setTimeout(() => { this.wake = undefined; resolve(); }, step.durationMs);
              this.wake = () => { clearTimeout(timer); this.wake = undefined; resolve(); };
            });
          } else {
            for (const id of step.elements) {
              if (this.cancelled) break;
              const label = elementLabel(id);
              const command = vehicle.elements[id];
              if (!command) { this.log(`${label}: skipped, unsupported on ${vehicle.chassis}`); continue; }
              touched.add(id); // Include commands with ambiguous or rejected replies in cleanup.
              this.log(`${label}: ${step.state}`);
              await this.request(vehicle, step.state === 'on' ? command.on : command.off);
              if (step.state === 'on') lights.add(id); else lights.delete(id);
              this.update({ presetProgress: { name: preset.name, index, total: preset.steps.length, lights: [...lights] } });
            }
          }
        }
        if (expired) throw new Error('Preset exceeded its 90-second execution limit');
      } catch (error) { failure = error; }
      finally {
        clearTimeout(deadline);
        this.update({ status: 'Restoring ECU control…' });
        for (const id of touched) {
          try { await this.request(vehicle, vehicle.elements[id]!.off); }
          catch (error) { failure ??= error; }
        }
        try { await this.cleanup(vehicle); } catch (error) { failure = error; }
        this.update({ presetProgress: null });
        if (failure) throw failure;
        this.log(`Preset ${this.cancelled ? 'stopped' : 'completed'}: ${preset.name}`);
      }
    });
  }
  async stop(): Promise<void> {
    this.cancelled = true; this.wake?.();
    if (this.operation) { this.log('Stop requested; finishing current reply then restoring control'); await this.operation; }
  }
  async disconnect(): Promise<void> {
    await this.stop(); this.link?.close(); this.link = undefined;
    this.update({ connected: false, verified: false, identity: null, vehicle: null, status: 'Disconnected' });
  }
}
