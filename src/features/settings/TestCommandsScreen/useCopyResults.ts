import { getFixedT } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import type { DetectedCar, Lhm2Snapshot } from '@/domain';

import { formatResultsText, type LogEntry } from './helpers';

export const useCopyResults = (
  entries: readonly LogEntry[],
  snapshots: readonly Lhm2Snapshot[],
  car?: DetectedCar,
) => {
  const { t } = useTranslation();

  return useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      const text = formatResultsText(entries, snapshots, getFixedT('en'), car);
      const copied = await Clipboard.setStringAsync(text);
      if (!copied) throw new Error('Clipboard unavailable');
      Alert.alert(t('testCommands.results.copied'));
    } catch {
      Alert.alert(t('testCommands.results.copyFailed'));
    }
  }, [car, entries, snapshots, t]);
};
