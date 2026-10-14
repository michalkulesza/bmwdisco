import { useCallback, useState } from 'react';

import { phaseOf } from '@/domain/session/phase';
import { formatDiagnosticLog } from '@/features/settings/diagnostic-log';
import { useSessionActor } from '@/session';
import { errorHaptic, successHaptic } from '@/ui/haptics';

import { SentryNotConfiguredError, submitReport } from './sentry';

export type ReportStatus = 'idle' | 'sending' | 'sent' | 'notConfigured' | 'failed';

export const useSendReport = () => {
  const actor = useSessionActor();
  const [status, setStatus] = useState<ReportStatus>('idle');

  const send = useCallback(
    async (message: string) => {
      setStatus('sending');

      const snapshot = actor.getSnapshot();
      const { context } = snapshot;
      const phase = phaseOf(snapshot);
      const tags = {
        adapter: context.adapter ?? 'none',
        chassis: context.car?.chassis ?? 'unknown',
        phase,
      };

      try {
        await submitReport({ message, logText: formatDiagnosticLog(context, phase), tags });
        successHaptic();
        setStatus('sent');
      } catch (error) {
        errorHaptic();
        setStatus(error instanceof SentryNotConfiguredError ? 'notConfigured' : 'failed');
      }
    },
    [actor],
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, send, reset };
};
