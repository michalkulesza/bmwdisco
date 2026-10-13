import { CarProfile, Cpu, PlugsConnected } from 'phosphor-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import type { DetectedCar } from '@/domain';
import { adapterChoiceOf, chassisLabel, maskVin } from '@/features/connect/helpers';
import { useSessionActions, useSessionPhase, useSessionSelector } from '@/session';
import Button from '@/ui/Button';
import IconBadge from '@/ui/IconBadge';
import ListGroup from '@/ui/ListGroup';
import SectionHeader from '@/ui/SectionHeader';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import InfoRow from './InfoRow';

type ModuleSgbd = DetectedCar['modules'][number]['sgbd'];

const StatusValue = () => {
  const { t } = useTranslation();
  const reconnecting = useSessionPhase() === 'reconnecting';
  const label = reconnecting ? t('settings.status.reconnecting') : t('settings.status.connected');
  const dotClass = reconnecting ? 'bg-hue-amber' : 'bg-connected';
  const textClass = reconnecting ? 'text-hue-amber' : 'text-connected-soft';

  return (
    <View className="flex-row items-center gap-2">
      <View className={`size-2 rounded-pill ${dotClass}`} />
      <Text variant="meta" className={textClass}>
        {label}
      </Text>
    </View>
  );
};

const ModuleRow = ({ sgbd }: { sgbd: ModuleSgbd }) => {
  const { t } = useTranslation();
  const accent = useColorToken('blue');

  return (
    <InfoRow
      label={sgbd}
      value={t(`car.modules.${sgbd}`)}
      left={<Cpu size={22} color={accent} />}
      right={<View className="size-2 rounded-pill bg-connected" />}
    />
  );
};

const CarCard = ({ car }: { car: DetectedCar }) => {
  const { t } = useTranslation();
  const chassis = car.chassis ? chassisLabel(car.chassis) : t('car.unknownChassis');

  return (
    <View className="overflow-hidden rounded-card border border-card-border bg-card">
      <View className="flex-row items-center gap-3.5 p-4">
        <IconBadge icon={CarProfile} size="lg" />
        <View className="flex-1 gap-0.5">
          <Text variant="heading">{chassis}</Text>
          <Text variant="small" tone="muted">
            {t('car.detected')}
          </Text>
          {car.vin ? (
            <Text variant="small" tone="muted">
              {t('car.vin', { vin: maskVin(car.vin) })}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="h-px bg-card-border" />
      <View className="px-4 pb-1 pt-3">
        <Text variant="small" tone="muted" className="font-geist-semibold uppercase tracking-wider">
          {t('car.modulesTitle')}
        </Text>
      </View>
      {car.modules.map((module, index) => (
        <View key={module.sgbd}>
          {index > 0 ? <View className="ml-4 h-px bg-card-border" /> : null}
          <ModuleRow sgbd={module.sgbd} />
        </View>
      ))}
    </View>
  );
};

const ConnectedSections = () => {
  const { t } = useTranslation();
  const { disconnect } = useSessionActions();
  const adapterId = useSessionSelector((snapshot) => snapshot.context.adapter);
  const rtt = useSessionSelector((snapshot) => snapshot.context.measuredRttMs);
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  const choice = adapterChoiceOf(adapterId);
  const adapter = choice
    ? `${t(`cable.adapters.${choice}.name`)} · ${t(`connect.adapterShort.${choice}`)}`
    : '—';
  const latency = rtt === null ? '—' : t('settings.latencyValue', { ms: Math.round(rtt) });

  const handleDisconnectPress = useCallback(() => {
    Alert.alert(t('settings.disconnectTitle'), t('settings.disconnectMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.disconnect'), style: 'destructive', onPress: disconnect },
    ]);
  }, [disconnect, t]);

  return (
    <>
      <View className="gap-3">
        <SectionHeader title={t('settings.connection')} />
        <ListGroup>
          <InfoRow label={t('settings.status.label')} right={<StatusValue />} />
          <InfoRow label={t('settings.adapter')} value={adapter} />
          <InfoRow label={t('settings.latency')} value={latency} />
        </ListGroup>
      </View>
      {car ? (
        <View className="gap-3">
          <SectionHeader title={t('car.title')} />
          <CarCard car={car} />
        </View>
      ) : null}
      <View className="gap-3">
        <Button
          label={t('settings.disconnect')}
          icon={PlugsConnected}
          variant="destructive"
          onPress={handleDisconnectPress}
        />
        <Text variant="small" tone="muted" className="mx-1">
          {t('settings.disconnectHint')}
        </Text>
      </View>
    </>
  );
};

export default ConnectedSections;
