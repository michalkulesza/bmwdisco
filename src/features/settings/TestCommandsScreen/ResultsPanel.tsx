import { Copy, Stop, Trash } from 'phosphor-react-native';
import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DetectedCar, Lhm2Snapshot } from '@/domain';
import { selectionHaptic } from '@/ui/haptics';
import Text from '@/ui/Text';

import { MAX_VISIBLE_LOG_ENTRIES, type LogEntry } from './helpers';
import LogLine from './LogLine';
import PanelAction from './PanelAction';
import { useCopyResults } from './useCopyResults';

const LineGap = () => <View className="h-1.5" />;

const keyOf = (entry: LogEntry) => String(entry.key);

interface ResultsPanelProps {
  entries: readonly LogEntry[];
  snapshots: readonly Lhm2Snapshot[];
  car?: DetectedCar;
  running: boolean;
  onAbort: () => void;
  onClear: () => void;
}

const ResultsPanel = ({
  entries,
  snapshots,
  car,
  running,
  onAbort,
  onClear,
}: ResultsPanelProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<LogEntry>>(null);
  const copy = useCopyResults(entries, snapshots, car);
  const visible = useMemo(() => entries.slice(-MAX_VISIBLE_LOG_ENTRIES), [entries]);
  const truncated = entries.length > visible.length;

  const handleContentSizeChange = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: false });
  }, []);

  const handleClearPress = useCallback(() => {
    selectionHaptic();
    onClear();
  }, [onClear]);

  const renderItem = useCallback(
    ({ item }: { item: LogEntry }) => <LogLine entry={item} car={car} />,
    [car],
  );

  return (
    <View
      className="gap-2 border-t border-line bg-card px-4 pt-3"
      style={{ paddingBottom: insets.bottom + 8 }}
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text variant="labelStrong" accessibilityRole="header">
          {t('testCommands.results.title')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {running ? (
            <PanelAction
              label={t('testCommands.results.abort')}
              icon={Stop}
              onPress={onAbort}
              destructive
            />
          ) : null}
          <PanelAction label={t('testCommands.results.copy')} icon={Copy} onPress={copy} />
          <PanelAction
            label={t('testCommands.results.clear')}
            icon={Trash}
            onPress={handleClearPress}
          />
        </View>
      </View>
      {truncated ? (
        <Text variant="small" tone="muted">
          {t('testCommands.results.truncated', {
            shown: visible.length,
            total: entries.length,
          })}
        </Text>
      ) : null}
      {visible.length === 0 ? (
        <Text variant="meta" tone="muted" className="py-4">
          {t('testCommands.results.empty')}
        </Text>
      ) : (
        <FlatList
          ref={listRef}
          data={visible}
          keyExtractor={keyOf}
          renderItem={renderItem}
          onContentSizeChange={handleContentSizeChange}
          className="h-48"
          ItemSeparatorComponent={LineGap}
        />
      )}
    </View>
  );
};

export default ResultsPanel;
