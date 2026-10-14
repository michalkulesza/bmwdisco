import { createActorContext } from '@xstate/react';
import { useEffect, useMemo, type ReactNode } from 'react';

import { phaseOf, sessionMachine, systemClock, type SessionDeps } from '@/domain';
import { useSettingsStore } from '@/stores/settings';

import { createSessionDeps } from './session-deps';

import type { SessionSnapshot } from './hooks';

export const SessionContext = createActorContext(sessionMachine);

const connectedEnetHost = (snapshot: SessionSnapshot): string | undefined =>
  phaseOf(snapshot) === 'ready' && snapshot.context.adapter === 'enet'
    ? snapshot.context.link?.host
    : undefined;

const EnetHostRecorder = () => {
  const host = SessionContext.useSelector(connectedEnetHost);
  const setLastEnetHost = useSettingsStore((state) => state.setLastEnetHost);

  useEffect(() => {
    if (host) setLastEnetHost(host);
  }, [host, setLastEnetHost]);

  return null;
};

interface SessionProviderProps {
  children: ReactNode;
  deps?: SessionDeps;
}

const SessionProvider = ({ children, deps }: SessionProviderProps) => {
  const options = useMemo(() => {
    const input = deps ?? createSessionDeps();

    return { input, clock: input.clock ?? systemClock };
  }, [deps]);

  return (
    <SessionContext.Provider options={options}>
      <EnetHostRecorder />
      {children}
    </SessionContext.Provider>
  );
};

export default SessionProvider;
