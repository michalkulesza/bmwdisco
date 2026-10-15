import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  TestBench,
  testBlockReason,
  type BenchResult,
  type Lhm2Snapshot,
  type RawExchange,
  type RawSendResult,
} from '@/domain';
import { useSessionActor, useSessionPhase, useSessionSelector } from '@/session';
import { errorHaptic, successHaptic } from '@/ui/haptics';

import {
  blockedReasonText,
  buildCleanupAction,
  noteForResult,
  readingsOf,
  type BlockedReason,
  type LogEntry,
  type RunAction,
} from './helpers';

const MAX_LOG_ENTRIES = 500;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const useTestCommands = () => {
  const { t } = useTranslation();
  const actor = useSessionActor();
  const phase = useSessionPhase();
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  const blockReason = useSessionSelector((snapshot) =>
    testBlockReason({
      phase,
      activeToggles: snapshot.context.activeToggles,
      hasPending: snapshot.context.ledger.hasPending,
      testActive: snapshot.context.testActive,
    }),
  );
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Lhm2Snapshot[]>([]);
  const [readings, setReadings] = useState<ReadonlyMap<number, Uint8Array>>(new Map());
  const [runningId, setRunningId] = useState<string>();
  const [held, setHeld] = useState(false);
  const snapshotIdRef = useRef(0);

  const appendEntry = useCallback((entry: DistributiveOmit<LogEntry, 'key'>) => {
    setEntries((previous) => {
      const key = (previous.at(-1)?.key ?? 0) + 1;

      return [...previous, { ...entry, key } as LogEntry].slice(-MAX_LOG_ENTRIES);
    });
  }, []);

  const handleExchange = useCallback(
    (exchange: RawExchange) => appendEntry({ kind: 'exchange', exchange }),
    [appendEntry],
  );

  const bench = useMemo(
    () => new TestBench({ host: actor, onExchange: handleExchange, onHeldChange: setHeld }),
    [actor, handleExchange],
  );

  const appendNote = useCallback(
    (text: string) => appendEntry({ kind: 'note', at: Date.now(), text }),
    [appendEntry],
  );

  const reportBlocked = useCallback(
    (reason: BlockedReason) => {
      errorHaptic();
      appendNote(t('testCommands.notes.blocked', { reason: blockedReasonText(reason, t) }));
    },
    [appendNote, t],
  );

  const reportResult = useCallback(
    (result: BenchResult, name: string) => {
      if (result.status === 'blocked') {
        reportBlocked(result.reason);

        return;
      }

      appendNote(noteForResult(result, name, t));
      if (!result.cleanup.restored) appendNote(t('testCommands.notes.cleanupFailed'));
      if (result.status === 'completed' && result.cleanup.restored) successHaptic();
      else errorHaptic();
    },
    [appendNote, reportBlocked, t],
  );

  const run = useCallback(
    async ({ id, label, group }: RunAction): Promise<BenchResult> => {
      setRunningId(id);
      appendNote(t('testCommands.notes.started', { name: label }));
      const result = await bench.runGroup(group);
      reportResult(result, label);
      setRunningId(undefined);

      return result;
    },
    [appendNote, bench, reportResult, t],
  );

  const readLhm2 = useCallback(
    async (action: RunAction) => {
      const result = await run(action);
      if (result.status !== 'blocked') setReadings(readingsOf(result));
    },
    [run],
  );

  const sendRaw = useCallback(
    async (ecu: number, payload: Uint8Array): Promise<RawSendResult> => {
      setRunningId('raw');
      const result = await bench.sendRaw(ecu, payload);
      if (result.status === 'blocked') reportBlocked(result.reason);
      setRunningId(undefined);

      return result;
    },
    [bench, reportBlocked],
  );

  const cleanupAll = useCallback(async () => {
    const action = buildCleanupAction(t, bench.usage);
    setRunningId(action.id);
    const released = await bench.release();
    if (released) reportResult(released, action.label);
    await run(action);
  }, [bench, reportResult, run, t]);

  const abort = useCallback(() => bench.abort(), [bench]);

  const saveSnapshot = useCallback(
    (label: string) => {
      const saved = [...readings.entries()].map(([ecu, data]): Lhm2Snapshot => ({
        id: ++snapshotIdRef.current,
        label,
        ecu,
        data: data.slice(),
      }));
      setSnapshots((previous) => [...previous, ...saved]);
    },
    [readings],
  );

  const clearSnapshots = useCallback(() => setSnapshots([]), []);
  const clearEntries = useCallback(() => setEntries([]), []);

  useEffect(() => {
    bench.notifyPhase(phase);
  }, [bench, phase]);

  useEffect(
    () => () => {
      void bench.release();
    },
    [bench],
  );

  return {
    car,
    phase,
    blockReason,
    entries,
    snapshots,
    readings,
    runningId,
    held,
    usage: bench.usage,
    run,
    readLhm2,
    sendRaw,
    cleanupAll,
    abort,
    saveSnapshot,
    clearSnapshots,
    clearEntries,
  };
};

export type TestCommands = ReturnType<typeof useTestCommands>;
