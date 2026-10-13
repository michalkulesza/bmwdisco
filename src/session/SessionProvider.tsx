import { createActorContext } from '@xstate/react';
import { useMemo, type ReactNode } from 'react';

import { sessionMachine, systemClock, type SessionDeps } from '@/domain';

import { createSessionDeps } from './session-deps';

export const SessionContext = createActorContext(sessionMachine);

interface SessionProviderProps {
  children: ReactNode;
  deps?: SessionDeps;
}

const SessionProvider = ({ children, deps }: SessionProviderProps) => {
  const options = useMemo(() => {
    const input = deps ?? createSessionDeps();

    return { input, clock: input.clock ?? systemClock };
  }, [deps]);

  return <SessionContext.Provider options={options}>{children}</SessionContext.Provider>;
};

export default SessionProvider;
