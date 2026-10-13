import { createActor } from 'xstate';

import { systemClock } from '../clock';

import { sessionMachine, type SessionActor } from './machine';

import type { SessionDeps } from './types';

export const createSessionActor = (deps: SessionDeps): SessionActor =>
  createActor(sessionMachine, { input: deps, clock: deps.clock ?? systemClock });
