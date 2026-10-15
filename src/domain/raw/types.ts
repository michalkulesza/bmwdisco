export type ExchangeOutcome =
  | { kind: 'positive'; response: Uint8Array }
  | { kind: 'negative'; nrc: number; response: Uint8Array }
  | { kind: 'timeout' }
  | { kind: 'error'; message: string };

export type ExchangeStage = 'step' | 'cleanup';

export interface RawExchange {
  id: number;
  at: number;
  ecu: number;
  request: Uint8Array;
  outcome: ExchangeOutcome;
  stage: ExchangeStage;
}

export type TestBlockReason = 'notReady' | 'effectRunning' | 'toggleActive' | 'controlPending';
