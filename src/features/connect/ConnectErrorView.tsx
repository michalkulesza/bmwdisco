import {
  ArrowClockwise,
  BluetoothSlash,
  CarProfile,
  Gear,
  Prohibit,
  WifiSlash,
  type Icon,
} from 'phosphor-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';

import Button from '@/ui/Button';
import IconBadge from '@/ui/IconBadge';
import Screen from '@/ui/Screen';
import Text from '@/ui/Text';

import type { ConnectErrorReason } from './helpers';

const ERROR_ICONS: Record<ConnectErrorReason, Icon> = {
  adapterUnreachable: WifiSlash,
  bluetoothOff: BluetoothSlash,
  bluetoothDenied: BluetoothSlash,
  carNotResponding: CarProfile,
  unsupportedVehicle: Prohibit,
  connectionLost: WifiSlash,
};

const SETTINGS_REASONS: readonly ConnectErrorReason[] = ['bluetoothOff', 'bluetoothDenied'];

interface ConnectErrorViewProps {
  reason: ConnectErrorReason;
  onRetry: () => void;
  onBack: () => void;
  topInset?: boolean;
}

const ConnectErrorView = ({ reason, onRetry, onBack, topInset = true }: ConnectErrorViewProps) => {
  const { t } = useTranslation();
  const opensSettings = SETTINGS_REASONS.includes(reason);

  const handleOpenSettingsPress = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return (
    <Screen scroll={false} topInset={topInset}>
      <View className="flex-1 items-center justify-center gap-6" accessibilityRole="alert">
        <IconBadge icon={ERROR_ICONS[reason]} tone="rose" size="lg" />
        <View className="items-center gap-3">
          <Text variant="section" className="text-center" accessibilityRole="header">
            {t(`connect.errors.${reason}.title`)}
          </Text>
          <Text variant="meta" tone="muted" className="max-w-[290px] text-center">
            {t(`connect.errors.${reason}.description`)}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        {opensSettings ? (
          <Button label={t('connect.openSettings')} icon={Gear} onPress={handleOpenSettingsPress} />
        ) : null}
        <Button
          label={t('common.tryAgain')}
          icon={ArrowClockwise}
          variant={opensSettings ? 'secondary' : 'primary'}
          onPress={onRetry}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          className="h-11 items-center justify-center active:opacity-60"
        >
          <Text variant="body" tone="muted">
            {t('common.back')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
};

export default ConnectErrorView;
