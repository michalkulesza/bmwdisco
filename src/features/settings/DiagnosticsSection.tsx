import { router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSessionActions, useSessionSelector } from '@/session';
import ListGroup from '@/ui/ListGroup';
import ListRow from '@/ui/ListRow';
import SectionHeader from '@/ui/SectionHeader';

import { useCopyDiagnosticLog } from './useCopyDiagnosticLog';

export default function DiagnosticsSection() {
  const { t } = useTranslation();
  const enabled = useSessionSelector((snapshot) => snapshot.context.diagnosticsEnabled);
  const { setDiagnostics, clearDiagnostics } = useSessionActions();
  const copy = useCopyDiagnosticLog();

  const handleRecordPress = useCallback(() => setDiagnostics(!enabled), [enabled, setDiagnostics]);
  const handleTestCommandsPress = useCallback(() => router.push('/settings/test-commands'), []);

  return (
    <View className="gap-3">
      <SectionHeader title={t('diagnostics.title')} />
      <ListGroup>
        <ListRow
          label={t('diagnostics.record')}
          value={t(enabled ? 'diagnostics.on' : 'diagnostics.off')}
          onPress={handleRecordPress}
        />
        <ListRow label={t('diagnostics.copy')} onPress={copy} />
        <ListRow label={t('diagnostics.clear')} onPress={clearDiagnostics} />
        <ListRow label={t('diagnostics.testCommands')} chevron onPress={handleTestCommandsPress} />
      </ListGroup>
    </View>
  );
}
