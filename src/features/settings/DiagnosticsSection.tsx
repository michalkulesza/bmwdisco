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
  return (
    <View className="gap-3">
      <SectionHeader title={t('diagnostics.title')} />
      <ListGroup>
        <ListRow
          label={t('diagnostics.record')}
          value={t(enabled ? 'diagnostics.on' : 'diagnostics.off')}
          onPress={() => setDiagnostics(!enabled)}
        />
        <ListRow label={t('diagnostics.copy')} onPress={copy} />
        <ListRow label={t('diagnostics.clear')} onPress={clearDiagnostics} />
      </ListGroup>
    </View>
  );
}
