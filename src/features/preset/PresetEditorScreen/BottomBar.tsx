import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { StopIcon } from 'phosphor-react-native/src/icons/Stop';
import { TimerIcon } from 'phosphor-react-native/src/icons/Timer';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/ui/Button';
import Text from '@/ui/Text';

interface BottomBarProps {
  count: number;
  totalMs: number;
  canAddStep: boolean;
  canTest: boolean;
  testing: boolean;
  onAction: () => void;
  onWait: () => void;
  onTest: () => void;
}

const BottomBar = ({
  count,
  totalMs,
  canAddStep,
  canTest,
  testing,
  onAction,
  onWait,
  onTest,
}: BottomBarProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="gap-3 border-t border-card-border bg-page px-4 pt-3"
      style={{ paddingBottom: insets.bottom + 8 }}
    >
      <View className="flex-row justify-between">
        <Text variant="meta" tone="muted">
          {t('preset.stepsCount', { count })}
        </Text>
        <Text variant="meta" tone="muted">
          {t('preset.total', { ms: totalMs })}
        </Text>
      </View>
      <View className="flex-row gap-2">
        <Button
          label={t('preset.action')}
          icon={PlusIcon}
          variant="secondary"
          disabled={!canAddStep}
          onPress={onAction}
          className="flex-1"
        />
        <Button
          label={t('preset.wait')}
          icon={TimerIcon}
          variant="secondary"
          disabled={!canAddStep}
          onPress={onWait}
          className="flex-1"
        />
        <Button
          label={testing ? t('preset.stop') : t('preset.test')}
          icon={testing ? StopIcon : PlayIcon}
          disabled={!canTest && !testing}
          onPress={onTest}
          className="flex-1"
        />
      </View>
    </View>
  );
};

export default BottomBar;
