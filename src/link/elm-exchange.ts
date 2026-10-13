import { parseElmLine } from '@/protocol/elm-at';
import { AdapterError, NegativeResponseError } from '@/protocol/errors';
import { IsoTpReceiver, type FlowControl } from '@/protocol/isotp';
import { matchUdsResponse } from '@/protocol/uds';

export class ElmExchange {
  readonly messages: Uint8Array[] = [];
  readonly flows: FlowControl[] = [];
  pending = false;
  private readonly receiver: IsoTpReceiver;

  constructor(
    ecu: number,
    private readonly request: Uint8Array,
  ) {
    this.receiver = new IsoTpReceiver(ecu);
  }

  ingest(lines: string[]): void {
    for (const line of lines) {
      const parsed = parseElmLine(line);

      if (parsed.kind === 'error') {
        if (parsed.error.code !== 'no-data') throw parsed.error;
      } else if (parsed.kind === 'frame') {
        this.accept(parsed.id, parsed.data);
      }
    }
  }

  nextFlow(): FlowControl {
    const flow = this.flows.shift();
    if (!flow) throw new AdapterError('flow-control', 'ECU sent no ISO-TP flow control');
    if (flow.status !== 0) {
      throw new AdapterError('flow-control', `ECU ISO-TP flow control status ${flow.status}`);
    }

    return flow;
  }

  takeResponse(onPending: () => void): Uint8Array | undefined {
    while (this.messages.length) {
      const message = this.messages.shift()!;
      const match = matchUdsResponse(this.request, message);

      if (match.kind === 'pending') {
        this.pending = true;
        onPending();
      } else if (match.kind === 'negative') {
        throw new NegativeResponseError(this.request[0]!, match.code);
      } else if (match.kind === 'positive') {
        return message;
      }
    }

    return undefined;
  }

  private accept(id: number, data: Uint8Array): void {
    const event = this.receiver.push(id, data);
    if (event?.type === 'message') this.messages.push(event.payload);
    else if (event?.type === 'flow') this.flows.push(event);
  }
}
