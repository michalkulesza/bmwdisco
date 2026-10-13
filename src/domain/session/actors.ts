import { fromCallback, fromPromise } from 'xstate';

import type { DiagnosticLink } from '@/link/types';
import { KeepaliveScheduler } from '@/protocol/keepalive';

import { CarNotRespondingError } from '../errors';
import { createLinkProvider, detectCar } from '../registry/detect-car';

import { KEEPALIVE_INTERVAL_MS } from './helpers';

import type { AppStateSource, SessionEvent, SessionDeps } from './types';
import type { AdapterConfig } from '../adapter/create-link';
import type { DetectedCar } from '../registry/types';
import type { ControlLedger } from '../runner/ledger';
import type { PresetRunner } from '../runner/runner';
import type { CleanupReport, ExecutionResult, RunnableItem } from '../runner/types';

const KEEPALIVE_TIMEOUT_MS = 1500;

const closeQuietly = (link: DiagnosticLink): Promise<void> => link.close().catch(() => undefined);

export const openNewLink = async (
  deps: SessionDeps,
  config: AdapterConfig,
  signal?: AbortSignal,
): Promise<DiagnosticLink> => {
  const link = await deps.createLink(config, signal);

  try {
    await link.open(signal);
  } catch (error) {
    await closeQuietly(link);
    throw error;
  }

  if (signal?.aborted) {
    await closeQuietly(link);
    throw signal.reason instanceof Error ? signal.reason : new Error('cancelled');
  }

  return link;
};

export interface IdentifyInput {
  deps: SessionDeps;
  config: AdapterConfig;
  link: DiagnosticLink;
  addresses?: readonly number[];
}

export interface IdentifyOutput {
  link: DiagnosticLink;
  car: DetectedCar;
}

export const identifyCar = async (
  { deps, config, link, addresses }: IdentifyInput,
  signal: AbortSignal,
): Promise<IdentifyOutput> => {
  const provider = createLinkProvider(link, () => openNewLink(deps, config, signal));

  try {
    const car = await detectCar(provider, {
      addresses,
      probeTimeoutMs: deps.probeTimeoutMs,
      signal,
    });
    if (signal.aborted) throw new CarNotRespondingError();

    return { link: provider.link, car };
  } catch (error) {
    await closeQuietly(provider.link);
    throw error;
  }
};

export const identifyActor = fromPromise<IdentifyOutput, IdentifyInput>(({ input, signal }) =>
  identifyCar(input, signal),
);

export const openLinkActor = fromPromise<
  DiagnosticLink,
  { deps: SessionDeps; config: AdapterConfig }
>(({ input, signal }) => openNewLink(input.deps, input.config, signal));

export interface ReconnectInput {
  deps: SessionDeps;
  config: AdapterConfig;
  car: DetectedCar;
}

export const reconnectActor = fromPromise<IdentifyOutput, ReconnectInput>(
  async ({ input, signal }) => {
    const { deps, config, car } = input;
    const link = await openNewLink(deps, config, signal);
    const addresses = [...new Set(car.modules.map((module) => module.address))];
    const result = await identifyCar({ deps, config, link, addresses }, signal);

    const known = new Set(car.modules.map((module) => module.sgbd));
    const found = new Set(result.car.modules.map((module) => module.sgbd));
    const sameCar = known.size === found.size && [...known].every((sgbd) => found.has(sgbd));
    if (!sameCar) {
      await closeQuietly(result.link);
      throw new CarNotRespondingError();
    }

    return result;
  },
);

export interface RunInputData {
  runner: PresetRunner;
  item: RunnableItem;
  signal: AbortSignal;
}

export const runItemActor = fromPromise<ExecutionResult, RunInputData>(({ input }) =>
  input.runner.execute(input.item, input.signal),
);

export interface RestoreInput {
  runner: PresetRunner;
  freshLink: boolean;
}

export const restoreActor = fromPromise<CleanupReport, RestoreInput>(({ input }) =>
  input.runner.restore({ reenterSession: input.freshLink }),
);

export interface DisconnectInput {
  runner: PresetRunner | undefined;
  link: DiagnosticLink | undefined;
  freshLink: boolean;
}

export const disconnectActor = fromPromise<CleanupReport, DisconnectInput>(async ({ input }) => {
  const report = (await input.runner?.restore({ reenterSession: input.freshLink })) ?? {
    restored: true,
    failures: [],
  };
  if (input.link) await closeQuietly(input.link);

  return report;
});

export interface KeepaliveInput {
  link: DiagnosticLink;
  car: DetectedCar;
  ledger: ControlLedger;
  intervalMs?: number;
}

export const keepaliveActor = fromCallback<SessionEvent, KeepaliveInput>(({ input }) => {
  const { link, car, ledger, intervalMs = KEEPALIVE_INTERVAL_MS } = input;
  const schedulers = car.modules.map(
    ({ module, address }) =>
      new KeepaliveScheduler({
        intervalMs,
        isBusy: () => link.busy,
        send: async () => {
          if (!ledger.hasSession(module.sgbd) || link.state !== 'open') return;

          await link.request(address, Uint8Array.from(module.keepalive), {
            priority: 'high',
            timeoutMs: KEEPALIVE_TIMEOUT_MS,
            totalMs: KEEPALIVE_TIMEOUT_MS,
          });
        },
      }),
  );
  for (const scheduler of schedulers) scheduler.start();

  return () => {
    for (const scheduler of schedulers) scheduler.stop();
  };
});

export const linkWatcherActor = fromCallback<SessionEvent, { link: DiagnosticLink }>(
  ({ input, sendBack }) => {
    const { link } = input;
    const lost = () => sendBack({ type: 'LINK_LOST' });
    if (link.state === 'failed' || link.state === 'closed') lost();

    return link.onStateChange((state) => {
      if (state === 'failed' || state === 'closed') lost();
    });
  },
);

export const appStateActor = fromCallback<SessionEvent, { source: AppStateSource }>(
  ({ input, sendBack }) =>
    input.source.subscribe((status) => {
      if (status === 'background') sendBack({ type: 'APP_BACKGROUND' });
      else if (status === 'active') sendBack({ type: 'APP_FOREGROUND' });
    }),
);
