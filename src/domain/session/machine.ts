import { and, assign, setup, type ActorRefFrom } from 'xstate';

import { toError } from '@/protocol/errors';

import { isValidPreset } from '../preset/schema';
import { testBlockReason } from '../raw/gate';
import { classifySessionError } from '../runner/classify';
import { ControlLedger } from '../runner/ledger';
import { PresetRunner } from '../runner/runner';
import { itemIdOf, type CleanupReport, type ExecutionResult, RunnableItem } from '../runner/types';

import {
  appStateActor,
  disconnectActor,
  identifyActor,
  keepaliveActor,
  linkWatcherActor,
  openLinkActor,
  pinResolvedHost,
  reconnectActor,
  restoreActor,
  runItemActor,
  type IdentifyOutput,
} from './actors';
import {
  activeToggleAfter,
  appendLog,
  backoffMs,
  clearJustRan,
  describeRunnerEvent,
  isEffect,
  isToggleItem,
  JUST_RAN_MS,
  MAX_RECONNECT_ATTEMPTS,
  MAX_RESTORE_FAILURES,
  noticeOf,
  runnableOf,
  tileForResult,
  withoutQueued,
  withTile,
} from './helpers';

import type { SessionContext, SessionDeps, SessionError, SessionEvent } from './types';

const INVALID_INPUT_REASON = 'invalidPreset' as const;

const initialContext = ({ input }: { input: SessionDeps }): SessionContext => ({
  deps: input,
  ledger: new ControlLedger(),
  tiles: {},
  measuredRttMs: null,
  lightsMayBeOn: false,
  freshLink: false,
  reconnectAttempt: 0,
  restoreFailures: 0,
  restoreRequested: false,
  disconnectRequested: false,
  notices: [],
  log: [],
  diagnosticsEnabled: input.debug ?? false,
  testActive: false,
});

const errorOf = (error: unknown, whileRunning = false): SessionError => {
  const failure = toError(error);

  return { reason: classifySessionError(failure), message: failure.message, whileRunning };
};

const connectionLostError = (whileRunning: boolean): SessionError => ({
  reason: 'connectionLost',
  message: 'Connection lost',
  whileRunning,
});

const makeRunner = (
  context: SessionContext,
  output: IdentifyOutput,
  onEvent: (event: SessionEvent) => void,
): PresetRunner =>
  new PresetRunner({
    link: output.link,
    car: output.car,
    ledger: context.ledger,
    clock: context.deps.clock,
    trace: context.diagnosticsEnabled,
    onEvent: (event) => onEvent({ type: 'RUNNER_EVENT', event }),
  });

const lostTiles = (context: SessionContext): SessionContext['tiles'] => {
  const { tiles } = withoutQueued(context) as Pick<SessionContext, 'tiles'>;

  return context.runningItemId
    ? withTile(tiles, context.runningItemId, { state: 'error', reason: 'connectionLost' })
    : tiles;
};

const isRunnableEvent = (event: SessionEvent): boolean => {
  if (event.type !== 'RUN') return false;
  const { item } = event;

  return isEffect(item) ? item.kind === 'oneShot' : isValidPreset(item);
};

const isToggleEvent = (
  context: SessionContext,
  event: SessionEvent,
): event is Extract<SessionEvent, { type: 'TOGGLE' }> =>
  event.type === 'TOGGLE' && runnableOf(context.car, event) !== undefined;

const runnableId = (context: SessionContext, event: SessionEvent): string | undefined => {
  const item = runnableOf(context.car, event);

  return item && itemIdOf(item);
};

const beginItem = (context: SessionContext, item: RunnableItem): Partial<SessionContext> => ({
  currentItem: item,
  runningItemId: itemIdOf(item),
  queuedItem: undefined,
  abort: new AbortController(),
  tiles: withTile(context.tiles, itemIdOf(item), { state: 'running' }),
  lightsMayBeOn: true,
  restoreRequested: false,
  disconnectRequested: false,
  notices: [],
  lastError: undefined,
});

const closeLinkOf = (context: SessionContext): void => {
  void context.link?.close().catch(() => undefined);
};

const abortRun = (context: SessionContext): void => {
  context.abort?.abort();
};

const onlineInvokes = [
  {
    src: 'linkWatcher',
    input: ({ context }: { context: SessionContext }) => ({ link: context.link! }),
  },
] as const;

export const sessionMachine = setup({
  types: {
    context: {} as SessionContext,
    events: {} as SessionEvent,
    input: {} as SessionDeps,
  },
  actors: {
    openLink: openLinkActor,
    identify: identifyActor,
    reconnect: reconnectActor,
    runItem: runItemActor,
    restore: restoreActor,
    disconnectFlow: disconnectActor,
    keepalive: keepaliveActor,
    linkWatcher: linkWatcherActor,
    appState: appStateActor,
  },
  delays: {
    reconnectDelay: ({ context }) =>
      backoffMs(context.reconnectAttempt, context.deps.reconnectBaseDelayMs),
    justRanTtl: JUST_RAN_MS,
  },
  guards: {
    canRun: ({ event }) => isRunnableEvent(event),
    canToggle: ({ context, event }) => isToggleEvent(context, event),
    turnsOn: ({ event }) => event.type === 'TOGGLE' && event.on,
    hasActiveToggle: ({ context }) => context.activeToggleId !== undefined,
    togglesOther: ({ context, event }) =>
      context.activeToggleId !== undefined &&
      event.type === 'TOGGLE' &&
      event.effectId !== context.activeToggleId,
    hasQueued: ({ context }) => context.queuedItem !== undefined,
    canQueue: ({ context, event }) => {
      if (context.queuedItem || context.disconnectRequested) return false;
      if (!isRunnableEvent(event) && !(isToggleEvent(context, event) && event.on)) return false;

      return runnableId(context, event) !== context.runningItemId;
    },
    hasPendingControl: ({ context }) => context.ledger.hasPending,
    testEngaged: ({ context }) => context.testActive,
    canBeginTest: ({ context }) =>
      testBlockReason({
        phase: 'ready',
        activeToggleId: context.activeToggleId,
        hasPending: context.ledger.hasPending,
        testActive: context.testActive,
      }) === undefined,
    linkIsDown: ({ context }) => context.link !== undefined && context.link.state !== 'open',
    holdsToggle: ({ context, event }) => {
      const output = (event as unknown as { output: ExecutionResult }).output;
      const item = context.currentItem;
      if (!isToggleItem(item) || output.status !== 'completed') return false;
      if (context.restoreRequested || context.disconnectRequested) return false;

      return item.on ?? true;
    },
    disconnectWanted: ({ context }) => context.disconnectRequested,
    restoreSucceeded: ({ event }) =>
      (event as unknown as { output: CleanupReport }).output.restored,
    canRetryRestore: ({ context }) => context.restoreFailures < MAX_RESTORE_FAILURES,
    canRetryReconnect: ({ context }) => context.reconnectAttempt < MAX_RECONNECT_ATTEMPTS,
  },
  actions: {
    setDiagnostics: assign(({ context, event }) => {
      if (event.type !== 'SET_DIAGNOSTICS') return {};
      context.runner?.setTrace(event.enabled);
      return { diagnosticsEnabled: event.enabled };
    }),
    clearDiagnostics: assign({ log: [] }),
    beginTest: assign({ testActive: true }),
    endTest: assign(({ context }) => ({
      testActive: false,
      lightsMayBeOn: context.ledger.hasPending,
    })),
    logEvent: assign({
      log: ({ context, event }) =>
        event.type === 'RUNNER_EVENT'
          ? appendLog(context, describeRunnerEvent(event.event))
          : context.log,
      notices: ({ context, event }) => {
        if (event.type !== 'RUNNER_EVENT') return context.notices;
        const notice = noticeOf(event.event);

        return notice ? [...context.notices, notice] : context.notices;
      },
    }),
    startConnect: assign(({ context, event }) => {
      if (event.type !== 'CONNECT') return {};

      return {
        config: event.config,
        adapter: event.config.adapter,
        lastError: undefined,
        reconnectAttempt: 0,
        restoreFailures: 0,
        log: appendLog(context, `connect ${event.config.adapter}`),
      };
    }),
    resetToIdle: assign({
      link: undefined,
      car: undefined,
      runner: undefined,
      config: undefined,
      adapter: undefined,
      lastError: undefined,
    }),
    storeLink: assign({
      link: ({ event }) => (event as unknown as { output: IdentifyOutput['link'] }).output,
    }),
    storeCar: assign(({ context, event, self }) => {
      const output = (event as unknown as { output: IdentifyOutput }).output;
      const forced = context.ledger.hasPending;

      return {
        link: output.link,
        config: context.config && pinResolvedHost(context.config, output.link),
        car: output.car,
        runner: makeRunner(context, output, (runnerEvent) => self.send(runnerEvent)),
        measuredRttMs: output.link.measuredRttMs,
        freshLink: forced,
        lastError: forced ? context.lastError : undefined,
        lightsMayBeOn: forced,
        reconnectAttempt: 0,
        log: appendLog(context, `identified ${output.car.modules.map((m) => m.sgbd).join(',')}`),
      };
    }),
    storeConnectError: assign({
      lastError: ({ event }) => errorOf((event as unknown as { error: unknown }).error),
      link: undefined,
      runner: undefined,
    }),
    storeIdentifyError: assign({
      lastError: ({ event }) => errorOf((event as unknown as { error: unknown }).error),
      link: undefined,
      runner: undefined,
    }),
    closeLink: ({ context }) => closeLinkOf(context),
    startRun: assign(({ context, event }) => {
      const item = runnableOf(context.car, event);

      return item ? beginItem(context, item) : {};
    }),
    startQueued: assign(({ context }) =>
      context.queuedItem ? beginItem(context, context.queuedItem) : {},
    ),
    queueItem: assign(({ context, event }) => {
      const item = runnableOf(context.car, event)!;

      return {
        queuedItem: item,
        tiles: withTile(context.tiles, itemIdOf(item), { state: 'running' }),
      };
    }),
    queueAndStop: assign(({ context, event }) => {
      abortRun(context);
      const item = runnableOf(context.car, event)!;

      return {
        queuedItem: item,
        restoreRequested: true,
        tiles: withTile(context.tiles, itemIdOf(item), { state: 'running' }),
      };
    }),
    cancelQueued: assign(({ context }) => withoutQueued(context)),
    rejectInvalidItem: assign(({ context, event }) => {
      if (event.type !== 'RUN') return {};
      const id = event.item.id;
      const lastError = { reason: INVALID_INPUT_REASON, message: 'Invalid item', itemId: id };
      if (typeof id !== 'string') return { lastError };

      return {
        lastError,
        tiles: withTile(context.tiles, id, { state: 'error', reason: INVALID_INPUT_REASON }),
      };
    }),
    requestStop: ({ context }) => abortRun(context),
    requestRestore: assign(({ context }) => {
      abortRun(context);

      return { ...withoutQueued(context), restoreRequested: true };
    }),
    requestDisconnect: assign(({ context }) => {
      abortRun(context);

      return { ...withoutQueued(context), disconnectRequested: true };
    }),
    applyRunResult: assign(({ context, event }) => {
      const result = (event as unknown as { output: ExecutionResult }).output;
      const item = context.currentItem!;
      const id = itemIdOf(item);
      const failed = result.status === 'failed' || result.status === 'timeout';
      const tile = tileForResult(item, result);

      return {
        tiles: withTile(context.tiles, id, tile),
        activeToggleId: activeToggleAfter(context.activeToggleId, item, result),
        runningItemId: undefined,
        abort: undefined,
        measuredRttMs: context.link?.measuredRttMs ?? context.measuredRttMs,
        lastError:
          failed && tile?.reason
            ? { reason: tile.reason, message: result.error?.message ?? tile.reason, itemId: id }
            : context.lastError,
      };
    }),
    applyRunFailure: assign(({ context, event }) => {
      const item = context.currentItem;
      const id = item ? itemIdOf(item) : undefined;
      const error = toError((event as unknown as { error: unknown }).error);

      return {
        tiles: id
          ? withTile(context.tiles, id, { state: 'error', reason: 'unknown' })
          : context.tiles,
        runningItemId: undefined,
        abort: undefined,
        lastError: { reason: 'unknown' as const, message: error.message, itemId: id },
      };
    }),
    markRestored: assign(({ context }) => ({
      activeToggleId: undefined,
      lightsMayBeOn: context.ledger.hasPending,
      freshLink: false,
      restoreFailures: 0,
      restoreRequested: false,
      measuredRttMs: context.link?.measuredRttMs ?? context.measuredRttMs,
      lastError: context.lastError?.whileRunning ? undefined : context.lastError,
    })),
    markRestoreFailed: assign(({ context }) => ({
      ...withoutQueued(context),
      restoreFailures: context.restoreFailures + 1,
      lightsMayBeOn: true,
      lastError: connectionLostError(true),
      log: appendLog(context, 'restore unconfirmed'),
    })),
    markDisconnected: assign(({ context, event }) => {
      const report = (event as unknown as { output?: CleanupReport }).output;
      const stillForced = context.ledger.hasPending || report?.restored === false;

      return {
        link: undefined,
        runner: undefined,
        runningItemId: undefined,
        abort: undefined,
        activeToggleId: undefined,
        queuedItem: undefined,
        tiles: {},
        testActive: false,
        lightsMayBeOn: stillForced,
        disconnectRequested: false,
        restoreRequested: false,
      };
    }),
    beginReconnect: assign(({ context }) => {
      abortRun(context);

      return {
        reconnectAttempt: 0,
        testActive: false,
        lightsMayBeOn: context.ledger.hasPending,
        lastError: connectionLostError(context.ledger.hasPending),
        queuedItem: undefined,
        runningItemId: undefined,
        abort: undefined,
        tiles: lostTiles(context),
        log: appendLog(context, 'link lost'),
      };
    }),
    countAttempt: assign({ reconnectAttempt: ({ context }) => context.reconnectAttempt + 1 }),
    giveUpReconnect: assign(({ context }) => ({
      lastError: connectionLostError(context.ledger.hasPending),
      link: undefined,
      runner: undefined,
      testActive: false,
      lightsMayBeOn: context.ledger.hasPending,
    })),
    clearJustRan: assign({ tiles: ({ context }) => clearJustRan(context.tiles) }),
  },
}).createMachine({
  id: 'session',
  context: initialContext,
  initial: 'idle',
  invoke: { src: 'appState', input: ({ context }) => ({ source: context.deps.appState }) },
  on: {
    TEST_END: { actions: 'endTest' },
    RUNNER_EVENT: { actions: 'logEvent' },
    SET_DIAGNOSTICS: { actions: 'setDiagnostics' },
    CLEAR_DIAGNOSTICS: { actions: 'clearDiagnostics' },
  },
  states: {
    idle: {
      on: { CONNECT: { target: 'connecting', actions: 'startConnect' } },
    },
    connecting: {
      invoke: {
        src: 'openLink',
        input: ({ context }) => ({ deps: context.deps, config: context.config! }),
        onDone: { target: 'identifying', actions: 'storeLink' },
        onError: { target: 'error', actions: 'storeConnectError' },
      },
      on: {
        CANCEL: { target: 'idle', actions: 'resetToIdle' },
        DISCONNECT: { target: 'idle', actions: 'resetToIdle' },
      },
    },
    identifying: {
      invoke: {
        src: 'identify',
        input: ({ context }) => ({
          deps: context.deps,
          config: context.config!,
          link: context.link!,
        }),
        onDone: [
          { guard: 'hasPendingControl', target: 'restoring', actions: 'storeCar' },
          { target: 'ready', actions: 'storeCar' },
        ],
        onError: { target: 'error', actions: 'storeIdentifyError' },
      },
      on: {
        CANCEL: { target: 'idle', actions: ['closeLink', 'resetToIdle'] },
        DISCONNECT: { target: 'idle', actions: ['closeLink', 'resetToIdle'] },
      },
    },
    ready: {
      invoke: [
        ...onlineInvokes,
        {
          src: 'keepalive',
          input: ({ context }) => ({
            link: context.link!,
            car: context.car!,
            ledger: context.ledger,
            intervalMs: context.deps.keepaliveIntervalMs,
          }),
        },
      ],
      after: { justRanTtl: { actions: 'clearJustRan' } },
      on: {
        RUN: [
          { guard: 'testEngaged' },
          {
            guard: and(['canRun', 'hasActiveToggle']),
            target: 'restoring',
            actions: 'queueItem',
          },
          { guard: 'canRun', target: 'running', actions: 'startRun' },
          { actions: 'rejectInvalidItem' },
        ],
        TOGGLE: [
          { guard: 'testEngaged' },
          {
            guard: and(['canToggle', 'togglesOther', 'turnsOn']),
            target: 'restoring',
            actions: 'queueItem',
          },
          { guard: and(['canToggle', 'togglesOther']) },
          { guard: 'canToggle', target: 'running', actions: 'startRun' },
        ],
        TEST_BEGIN: { guard: 'canBeginTest', actions: 'beginTest' },
        TEST_END: [
          { guard: 'hasPendingControl', target: 'restoring', actions: 'endTest' },
          { actions: 'endTest' },
        ],
        STOP: { guard: 'hasPendingControl', target: 'restoring' },
        APP_BACKGROUND: { guard: 'hasPendingControl', target: 'restoring' },
        APP_FOREGROUND: { guard: 'linkIsDown', target: 'reconnecting' },
        LINK_LOST: 'reconnecting',
        DISCONNECT: 'disconnecting',
      },
    },
    running: {
      invoke: [
        ...onlineInvokes,
        {
          src: 'keepalive',
          input: ({ context }) => ({
            link: context.link!,
            car: context.car!,
            ledger: context.ledger,
            intervalMs: context.deps.keepaliveIntervalMs,
          }),
        },
        {
          src: 'runItem',
          input: ({ context }) => ({
            runner: context.runner!,
            item: context.currentItem!,
            signal: context.abort!.signal,
          }),
          onDone: [
            { guard: 'holdsToggle', target: 'ready', actions: 'applyRunResult' },
            { guard: 'disconnectWanted', target: 'disconnecting', actions: 'applyRunResult' },
            { target: 'restoring', actions: 'applyRunResult' },
          ],
          onError: [
            { guard: 'disconnectWanted', target: 'disconnecting', actions: 'applyRunFailure' },
            { target: 'restoring', actions: 'applyRunFailure' },
          ],
        },
      ],
      on: {
        RUN: { guard: 'canQueue', actions: 'queueAndStop' },
        TOGGLE: { guard: 'canQueue', actions: 'queueAndStop' },
        STOP: { actions: 'requestRestore' },
        APP_BACKGROUND: { actions: 'requestRestore' },
        DISCONNECT: { actions: 'requestDisconnect' },
        LINK_LOST: { target: 'reconnecting' },
      },
    },
    restoring: {
      invoke: [
        ...onlineInvokes,
        {
          src: 'keepalive',
          input: ({ context }) => ({
            link: context.link!,
            car: context.car!,
            ledger: context.ledger,
            intervalMs: context.deps.keepaliveIntervalMs,
          }),
        },
        {
          src: 'restore',
          input: ({ context }) => ({ runner: context.runner!, freshLink: context.freshLink }),
          onDone: [
            {
              guard: and(['restoreSucceeded', 'hasQueued']),
              target: 'running',
              actions: ['markRestored', 'startQueued'],
            },
            { guard: 'restoreSucceeded', target: 'ready', actions: 'markRestored' },
            {
              guard: 'canRetryRestore',
              target: 'reconnecting',
              actions: ['markRestoreFailed', 'closeLink'],
            },
            { target: 'error', actions: ['markRestoreFailed', 'closeLink'] },
          ],
          onError: [
            {
              guard: 'canRetryRestore',
              target: 'reconnecting',
              actions: ['markRestoreFailed', 'closeLink'],
            },
            { target: 'error', actions: ['markRestoreFailed', 'closeLink'] },
          ],
        },
      ],
      on: {
        RUN: { guard: 'canQueue', actions: 'queueItem' },
        TOGGLE: { guard: 'canQueue', actions: 'queueItem' },
        STOP: { actions: 'cancelQueued' },
        APP_BACKGROUND: { actions: 'cancelQueued' },
        LINK_LOST: [
          { guard: 'canRetryRestore', target: 'reconnecting', actions: 'markRestoreFailed' },
          { target: 'error', actions: ['markRestoreFailed', 'closeLink'] },
        ],
        DISCONNECT: 'disconnecting',
      },
    },
    disconnecting: {
      invoke: {
        src: 'disconnectFlow',
        input: ({ context }) => ({
          runner: context.runner,
          link: context.link,
          freshLink: context.freshLink,
        }),
        onDone: { target: 'disconnected', actions: 'markDisconnected' },
        onError: { target: 'disconnected', actions: 'markDisconnected' },
      },
    },
    reconnecting: {
      entry: 'beginReconnect',
      initial: 'waiting',
      states: {
        waiting: {
          after: { reconnectDelay: { target: 'attempting', actions: 'countAttempt' } },
        },
        attempting: {
          invoke: {
            src: 'reconnect',
            input: ({ context }) => ({
              deps: context.deps,
              config: context.config!,
              car: context.car!,
            }),
            onDone: [
              { guard: 'hasPendingControl', target: '#session.restoring', actions: 'storeCar' },
              { target: '#session.ready', actions: 'storeCar' },
            ],
            onError: [
              { guard: 'canRetryReconnect', target: 'waiting' },
              { target: '#session.error', actions: 'giveUpReconnect' },
            ],
          },
        },
      },
      on: {
        CONNECT: { target: 'connecting', actions: ['closeLink', 'startConnect'] },
        CANCEL: { target: 'disconnected', actions: 'markDisconnected' },
        DISCONNECT: { target: 'disconnected', actions: 'markDisconnected' },
      },
    },
    disconnected: {
      on: { CONNECT: { target: 'connecting', actions: 'startConnect' } },
    },
    error: {
      on: {
        CONNECT: { target: 'connecting', actions: 'startConnect' },
        DISCONNECT: { target: 'disconnected', actions: 'markDisconnected' },
      },
    },
  },
});

export type SessionMachine = typeof sessionMachine;

export type SessionActor = ActorRefFrom<SessionMachine>;
