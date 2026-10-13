import { router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { chassisLabel, isHostValid, parsePort } from '@/features/connect/helpers';
import { DEFAULT_THOR_HOST, useSettingsStore, type AdapterChoice } from '@/stores/settings';
import ListRow from '@/ui/ListRow';

import FieldInput from './FieldInput';

const EnetFields = () => {
  const { t } = useTranslation();
  const host = useSettingsStore((state) => state.enetHost);
  const setHost = useSettingsStore((state) => state.setEnetHost);
  const error = isHostValid(host.trim()) ? undefined : t('settings.fields.hostInvalid');

  return (
    <FieldInput
      label={t('settings.fields.enetHost')}
      placeholder={t('settings.fields.enetHostPlaceholder')}
      value={host}
      onChangeText={setHost}
      keyboardType="numbers-and-punctuation"
      returnKeyType="done"
      error={error}
    />
  );
};

const ThorFields = () => {
  const { t } = useTranslation();
  const host = useSettingsStore((state) => state.thorHost);
  const port = useSettingsStore((state) => state.thorPort);
  const setHost = useSettingsStore((state) => state.setThorHost);
  const setPort = useSettingsStore((state) => state.setThorPort);
  const hostError = isHostValid(host.trim()) ? undefined : t('settings.fields.hostInvalid');
  const portError = parsePort(port) === undefined ? t('settings.fields.portInvalid') : undefined;

  return (
    <View className="gap-3">
      <FieldInput
        label={t('settings.fields.thorHost')}
        placeholder={DEFAULT_THOR_HOST}
        value={host}
        onChangeText={setHost}
        keyboardType="numbers-and-punctuation"
        returnKeyType="next"
        error={hostError}
      />
      <FieldInput
        label={t('settings.fields.thorPort')}
        value={port}
        onChangeText={setPort}
        keyboardType="number-pad"
        error={portError}
      />
    </View>
  );
};

const IcarFields = () => {
  const { t } = useTranslation();
  const device = useSettingsStore((state) => state.icarDevice);

  const handlePress = useCallback(() => router.push('/settings/ble-devices'), []);

  return (
    <ListRow
      label={t('settings.fields.device')}
      value={device ? (device.name ?? device.id) : t('settings.fields.deviceNone')}
      chevron
      onPress={handlePress}
    />
  );
};

const DemoFields = () => {
  const { t } = useTranslation();
  const chassis = useSettingsStore((state) => state.demoChassis);

  const handlePress = useCallback(() => router.push('/settings/demo-chassis'), []);

  return (
    <ListRow
      label={t('settings.fields.car')}
      value={chassisLabel(chassis)}
      chevron
      onPress={handlePress}
    />
  );
};

interface AdapterFieldsProps {
  choice: AdapterChoice;
}

const AdapterFields = ({ choice }: AdapterFieldsProps) => {
  const isInputGroup = choice === 'enet' || choice === 'thor';

  return (
    <View className={`border-t border-card-border ${isInputGroup ? 'p-4' : ''}`}>
      {choice === 'enet' ? <EnetFields /> : null}
      {choice === 'thor' ? <ThorFields /> : null}
      {choice === 'vgate' ? <IcarFields /> : null}
      {choice === 'demo' ? <DemoFields /> : null}
    </View>
  );
};

export default AdapterFields;
