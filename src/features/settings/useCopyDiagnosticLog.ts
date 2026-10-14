import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { phaseOf } from '@/domain/session/phase';
import { useSessionActor } from '@/session';

import { formatDiagnosticLog } from './diagnostic-log';

export const useCopyDiagnosticLog = () => {
  const { t } = useTranslation();
  const actor = useSessionActor();
  return useCallback(async () => {
    const snapshot = actor.getSnapshot();
    const context = snapshot.context;
    if (!context.log.length) {
      Alert.alert(t('diagnostics.emptyTitle'), t('diagnostics.emptyHint'));
      return;
    }
    try {
      // Older development clients can still open the app before their native rebuild.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      const copied = await Clipboard.setStringAsync(
        formatDiagnosticLog(context, phaseOf(snapshot)),
      );
      if (!copied) throw new Error('Clipboard unavailable');
      Alert.alert(t('diagnostics.copied'));
    } catch {
      Alert.alert(t('diagnostics.copyFailed'));
    }
  }, [actor, t]);
};
