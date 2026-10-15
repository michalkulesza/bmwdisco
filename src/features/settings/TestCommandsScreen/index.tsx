import { PlugsConnected } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import EmptyState from '@/ui/EmptyState';
import { SCREEN_TOP_PADDING } from '@/ui/layout';
import Text from '@/ui/Text';

import { blockedReasonText } from './helpers';
import ResultsPanel from './ResultsPanel';
import StatusBanner from './StatusBanner';
import TestCards from './TestCards';
import { useTestCommands } from './useTestCommands';

const SCROLL_STYLE = { paddingTop: SCREEN_TOP_PADDING };

const TestCommandsScreen = () => {
  const { t } = useTranslation();
  const commands = useTestCommands();
  const { phase, blockReason, runningId, held } = commands;
  const available = phase === 'ready' || phase === 'running';
  const disabled = blockReason !== undefined || runningId !== undefined;

  if (!available) {
    return (
      <View className="flex-1 bg-page">
        <EmptyState
          icon={PlugsConnected}
          title={t('testCommands.notReadyTitle')}
          description={t('testCommands.notReadyHint')}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-page">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-6"
        contentContainerStyle={SCROLL_STYLE}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text variant="meta" tone="muted">
          {t('testCommands.safety')}
        </Text>
        {blockReason ? (
          <StatusBanner tone="warning" message={blockedReasonText(blockReason, t)} />
        ) : null}
        {held ? <StatusBanner tone="info" message={t('testCommands.held')} /> : null}
        <TestCards commands={commands} disabled={disabled} />
      </ScrollView>
      <ResultsPanel
        entries={commands.entries}
        snapshots={commands.snapshots}
        car={commands.car}
        running={runningId !== undefined}
        onAbort={commands.abort}
        onClear={commands.clearEntries}
      />
    </View>
  );
};

export default TestCommandsScreen;
