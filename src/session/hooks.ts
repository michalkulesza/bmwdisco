import { useMemo } from 'react';

import {
  phaseOf,
  type AdapterConfig,
  type RunInput,
  type SessionMachine,
  type SessionPhase,
} from '@/domain';

import { SessionContext } from './SessionProvider';

import type { SnapshotFrom } from 'xstate';

export type SessionSnapshot = SnapshotFrom<SessionMachine>;

export const useSessionActor = () => SessionContext.useActorRef();

export const useSessionSelector = <T>(selector: (snapshot: SessionSnapshot) => T): T =>
  SessionContext.useSelector(selector);

export const useSessionPhase = (): SessionPhase => SessionContext.useSelector(phaseOf);

export const useSessionActions = () => {
  const actor = SessionContext.useActorRef();

  return useMemo(
    () => ({
      setDiagnostics: (enabled: boolean) => actor.send({ type: 'SET_DIAGNOSTICS', enabled }),
      clearDiagnostics: () => actor.send({ type: 'CLEAR_DIAGNOSTICS' }),
      connect: (config: AdapterConfig) => actor.send({ type: 'CONNECT', config }),
      cancel: () => actor.send({ type: 'CANCEL' }),
      disconnect: () => actor.send({ type: 'DISCONNECT' }),
      run: (item: RunInput) => actor.send({ type: 'RUN', item }),
      stop: () => actor.send({ type: 'STOP' }),
      toggle: (effectId: string, on: boolean) => actor.send({ type: 'TOGGLE', effectId, on }),
    }),
    [actor],
  );
};
