import type { SessionMachine } from './machine';
import type { SnapshotFrom } from 'xstate';

export type SessionPhase =
  | 'idle'
  | 'connecting'
  | 'identifying'
  | 'ready'
  | 'running'
  | 'restoring'
  | 'disconnecting'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export const phaseOf = (snapshot: SnapshotFrom<SessionMachine>): SessionPhase => {
  const value = snapshot.value;

  return (typeof value === 'string' ? value : Object.keys(value)[0]) as SessionPhase;
};
