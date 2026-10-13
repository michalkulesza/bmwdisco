import type { Bytes, ElementId, Module } from '@/data/types';
import { hex } from '@/protocol/bytes';
import { Nrc } from '@/protocol/nrc';
import { SID } from '@/protocol/uds';

type Action =
  | { kind: 'elements'; ids: ElementId[]; on: boolean }
  | { kind: 'returnControl' }
  | { kind: 'command' };

type Session = 'default' | 'extended';

const POSITIVE_OFFSET = 0x40;
const NEGATIVE_SID = 0x7f;
const COMMUNICATION_CONTROL = 0x28;
const SUPPRESS_POSITIVE_BIT = 0x80;
const SESSION_TIMING = [0x00, 0x32, 0x01, 0xf4];
const ECHOED_BYTES: Record<number, number> = {
  [SID.WriteDataByIdentifier]: 2,
  [SID.IoControl]: 3,
  [SID.RoutineControl]: 3,
  [COMMUNICATION_CONTROL]: 1,
};
const DID_IDENTITY = [0xf1, 0x50];
const DID_VIN = [0xf1, 0x90];
const KNOWN_SERVICES: readonly number[] = [...Object.values(SID), COMMUNICATION_CONTROL];
const SESSIONED_SERVICES: readonly number[] = [
  SID.WriteDataByIdentifier,
  SID.IoControl,
  SID.RoutineControl,
];

const negative = (service: number, code: Nrc): Uint8Array =>
  Uint8Array.of(NEGATIVE_SID, service, code);

const startsWith = (payload: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((value, index) => payload[index] === value);

const key = (payload: ArrayLike<number>): string => hex(Uint8Array.from(payload));

const addElement = (actions: Map<string, Action>, payload: string, id: ElementId, on: boolean) => {
  const existing = actions.get(payload);
  if (existing?.kind === 'elements' && existing.on === on) existing.ids.push(id);
  else actions.set(payload, { kind: 'elements', ids: [id], on });
};

const buildActions = (module: Module): Map<string, Action> => {
  const actions = new Map<string, Action>();

  for (const command of Object.values(module.commands)) {
    actions.set(key(command), { kind: 'command' });
  }
  for (const command of module.returnControl) {
    actions.set(key(command), { kind: 'returnControl' });
  }
  for (const [id, commands] of Object.entries(module.elements)) {
    addElement(actions, key(commands.on), id as ElementId, true);
    addElement(actions, key(commands.off), id as ElementId, false);
  }

  return actions;
};

export class SimulatedModule {
  private session: Session = 'default';
  private readonly lit = new Set<ElementId>();
  private readonly actions: Map<string, Action>;

  constructor(
    readonly module: Module,
    private readonly identityResponse: Bytes,
    private readonly vin: Uint8Array,
    private readonly onChange: () => void,
    private readonly deadOutputs: ReadonlySet<ElementId> = new Set(),
  ) {
    this.actions = buildActions(module);
  }

  get litElements(): ElementId[] {
    return [...this.lit];
  }

  respond(request: Uint8Array): Uint8Array | null {
    const service = request[0];
    if (service === undefined) return null;

    switch (service) {
      case SID.ReadDataByIdentifier:
        return this.readData(request);
      case SID.SessionControl:
        return this.controlSession(request);
      case SID.TesterPresent:
        return this.testerPresent(request);
      default:
        return this.actuate(request);
    }
  }

  private readData(request: Uint8Array): Uint8Array {
    if (request.length !== 3) return negative(SID.ReadDataByIdentifier, Nrc.IncorrectMessageLength);

    if (startsWith(request.subarray(1), DID_IDENTITY))
      return Uint8Array.from(this.identityResponse);
    if (startsWith(request.subarray(1), DID_VIN)) {
      return Uint8Array.of(SID.ReadDataByIdentifier + POSITIVE_OFFSET, ...DID_VIN, ...this.vin);
    }

    return negative(SID.ReadDataByIdentifier, Nrc.RequestOutOfRange);
  }

  private controlSession(request: Uint8Array): Uint8Array {
    if (request.length !== 2) return negative(SID.SessionControl, Nrc.IncorrectMessageLength);

    const subFunction = request[1]!;
    if (subFunction !== 0x01 && subFunction !== 0x03) {
      return negative(SID.SessionControl, Nrc.SubFunctionNotSupported);
    }

    this.session = subFunction === 0x03 ? 'extended' : 'default';
    if (this.session === 'default') this.clearForcedState();

    return Uint8Array.of(SID.SessionControl + POSITIVE_OFFSET, subFunction, ...SESSION_TIMING);
  }

  private testerPresent(request: Uint8Array): Uint8Array | null {
    if (request.length !== 2) return negative(SID.TesterPresent, Nrc.IncorrectMessageLength);

    const subFunction = request[1]!;
    const isKeepalive = key(request) === key(this.module.keepalive);
    if (subFunction & SUPPRESS_POSITIVE_BIT && !isKeepalive) return null;

    return Uint8Array.of(SID.TesterPresent + POSITIVE_OFFSET, subFunction & ~SUPPRESS_POSITIVE_BIT);
  }

  private actuate(request: Uint8Array): Uint8Array {
    const service = request[0]!;
    const action = this.actions.get(key(request));

    if (!action) {
      return negative(
        service,
        KNOWN_SERVICES.includes(service) ? Nrc.RequestOutOfRange : Nrc.ServiceNotSupported,
      );
    }

    if (SESSIONED_SERVICES.includes(service) && this.session !== 'extended') {
      return negative(service, Nrc.ServiceNotSupportedInActiveSession);
    }

    this.applyAction(action);

    return this.positiveResponse(request);
  }

  private applyAction(action: Action): void {
    switch (action.kind) {
      case 'elements':
        for (const id of action.ids) this.setLit(id, action.on);
        break;
      case 'returnControl':
        this.clearForcedState();
        break;
      case 'command':
        break;
    }
  }

  private positiveResponse(request: Uint8Array): Uint8Array {
    const service = request[0]!;
    const echoed = request.subarray(1, 1 + (ECHOED_BYTES[service] ?? 0));
    const response = [service + POSITIVE_OFFSET, ...echoed];
    const echoesChannel = service === SID.IoControl && request.length >= 6;
    if (echoesChannel) response.push(request[4]!);

    return Uint8Array.from(response);
  }

  private setLit(id: ElementId, on: boolean): void {
    if (this.deadOutputs.has(id)) return;

    const changed = on ? !this.lit.has(id) : this.lit.has(id);
    if (on) this.lit.add(id);
    else this.lit.delete(id);
    if (changed) this.onChange();
  }

  private clearForcedState(): void {
    if (this.lit.size === 0) return;

    this.lit.clear();
    this.onChange();
  }
}
