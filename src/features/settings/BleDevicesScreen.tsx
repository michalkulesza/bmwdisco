import { router } from 'expo-router';
import { BluetoothConnected } from 'phosphor-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import ConnectErrorView from '@/features/connect/ConnectErrorView';
import { useSettingsStore } from '@/stores/settings';
import type { BleAdvert } from '@/transport/ble-profiles';
import { selectionHaptic } from '@/ui/haptics';
import ListGroup from '@/ui/ListGroup';
import ListRow from '@/ui/ListRow';
import Screen from '@/ui/Screen';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import { useBleScan } from './useBleScan';

const DeviceRow = ({ advert }: { advert: BleAdvert }) => {
  const { t } = useTranslation();
  const selected = useSettingsStore((state) => state.icarDevice?.id === advert.id);
  const setIcarDevice = useSettingsStore((state) => state.setIcarDevice);
  const accent = useColorToken('blue');

  const handlePress = useCallback(() => {
    selectionHaptic();
    setIcarDevice({ id: advert.id, name: advert.name });
    router.back();
  }, [advert.id, advert.name, setIcarDevice]);

  return (
    <ListRow
      label={advert.name ?? t('connect.devices.unknown')}
      left={<BluetoothConnected size={22} color={accent} />}
      checked={selected}
      onPress={handlePress}
    />
  );
};

const ScanStatus = ({ empty, scanning }: { empty: boolean; scanning: boolean }) => {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center gap-3 px-1" accessibilityLiveRegion="polite">
      {scanning ? <ActivityIndicator size="small" /> : null}
      <Text variant="meta" tone="muted">
        {empty ? t('connect.devices.scanning') : t('connect.devices.found')}
      </Text>
    </View>
  );
};

const BleDevicesScreen = () => {
  const { t } = useTranslation();
  const { devices, error, rescan, scanning } = useBleScan();

  const handleBackPress = useCallback(() => router.back(), []);

  if (error)
    return (
      <ConnectErrorView reason={error} onRetry={rescan} onBack={handleBackPress} topInset={false} />
    );

  return (
    <Screen>
      <Text variant="meta" tone="muted">
        {t('connect.devices.description')}
      </Text>
      <ScanStatus empty={devices.length === 0} scanning={scanning} />
      {devices.length > 0 ? (
        <ListGroup>
          {devices.map((advert) => (
            <DeviceRow key={advert.id} advert={advert} />
          ))}
        </ListGroup>
      ) : null}
    </Screen>
  );
};

export default BleDevicesScreen;
