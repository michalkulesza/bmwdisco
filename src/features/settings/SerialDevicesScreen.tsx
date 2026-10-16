import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform } from 'react-native';

import { useSettingsStore, type BleDevice } from '@/stores/settings';
import { listAndroidSerialDevices } from '@/transport/AndroidSerialTransport';
import Button from '@/ui/Button';
import { selectionHaptic } from '@/ui/haptics';
import ListGroup from '@/ui/ListGroup';
import ListRow from '@/ui/ListRow';
import Screen from '@/ui/Screen';
import Text from '@/ui/Text';

const SerialDevicesScreen = () => {
  const { t } = useTranslation();
  const { kind: parameter } = useLocalSearchParams<{ kind?: string }>();
  const kind = parameter === 'usb' ? 'usb' : 'bluetooth';
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [loading, setLoading] = useState(Platform.OS === 'android');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const selected = useSettingsStore((state) =>
    kind === 'usb' ? state.usbDevice : state.elmBluetoothDevice,
  );

  useEffect(() => {
    let active = true;
    if (Platform.OS !== 'android') return;
    listAndroidSerialDevices(kind)
      .then((items) => {
        if (active) setDevices(items);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, kind]);

  const select = (device: BleDevice) => {
    selectionHaptic();
    const state = useSettingsStore.getState();
    if (kind === 'usb') state.setUsbDevice(device);
    else state.setElmBluetoothDevice(device);
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t(`connect.serialDevices.${kind}Title`) }} />
      <Text variant="meta" tone="muted">
        {t(`connect.serialDevices.${kind}Hint`)}
      </Text>
      {loading ? <ActivityIndicator /> : null}
      {failed ? <Text tone="muted">{t('connect.serialDevices.failed')}</Text> : null}
      {!loading && !failed && devices.length === 0 ? (
        <Text tone="muted">{t('connect.serialDevices.empty')}</Text>
      ) : null}
      {devices.length > 0 ? (
        <ListGroup>
          {devices.map((device) => (
            <ListRow
              key={device.id}
              label={device.name ?? device.id}
              checked={selected?.id === device.id}
              onPress={() => select(device)}
            />
          ))}
        </ListGroup>
      ) : null}
      {Platform.OS === 'android' ? (
        <Button
          variant="secondary"
          label={t('common.tryAgain')}
          disabled={loading}
          onPress={() => {
            setLoading(true);
            setFailed(false);
            setDevices([]);
            setAttempt((value) => value + 1);
          }}
        />
      ) : null}
    </Screen>
  );
};

export default SerialDevicesScreen;
