import { Lightning } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { ECU, formatEcuAddress, lhm2WriteGroup } from '@/domain';
import Button from '@/ui/Button';
import { selectionHaptic } from '@/ui/haptics';
import SegmentedControl from '@/ui/SegmentedControl';
import Text from '@/ui/Text';

import CardShell from './CardShell';
import { LHM2_CHANNEL_OPTIONS, LHM2_HOLD_OPTIONS, type RunAction } from './helpers';

type Side = 'left' | 'right';

const SIDE_ECUS: Record<Side, number> = { left: ECU.lhm2Left, right: ECU.lhm2Right };

interface Lhm2WriteCardProps {
  runningId?: string;
  disabled: boolean;
  onRun: (action: RunAction) => void;
}

const Lhm2WriteCard = ({ runningId, disabled, onRun }: Lhm2WriteCardProps) => {
  const { t } = useTranslation();
  const [side, setSide] = useState<Side>('left');
  const [channel, setChannel] = useState(1);
  const [holdMs, setHoldMs] = useState<number>(1000);
  const sideOptions = useMemo(
    () => [
      { value: 'left' as const, label: t('testCommands.groups.lhm2Read.sideLeft') },
      { value: 'right' as const, label: t('testCommands.groups.lhm2Read.sideRight') },
    ],
    [t],
  );
  const channelOptions = useMemo(
    () => LHM2_CHANNEL_OPTIONS.map((value) => ({ value: String(value), label: String(value) })),
    [],
  );
  const holdOptions = useMemo(
    () => LHM2_HOLD_OPTIONS.map((value) => ({ value: String(value), label: String(value) })),
    [],
  );

  const handleChannelChange = useCallback((value: string) => setChannel(Number(value)), []);
  const handleHoldChange = useCallback((value: string) => setHoldMs(Number(value)), []);

  const handleConfirmedRun = useCallback(() => {
    const ecu = SIDE_ECUS[side];
    onRun({
      id: 'lhm2Write',
      label: t('testCommands.groups.lhm2Write.title'),
      group: lhm2WriteGroup({ ecu, channel, holdMs }),
    });
  }, [channel, holdMs, onRun, side, t]);

  const handleRunPress = useCallback(() => {
    selectionHaptic();
    const ecu = `LHM2 ${formatEcuAddress(SIDE_ECUS[side])}`;
    Alert.alert(
      t('testCommands.groups.lhm2Write.confirmTitle'),
      t('testCommands.groups.lhm2Write.confirmMessage', { channel, ecu, ms: holdMs }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('testCommands.groups.lhm2Write.confirmRun'),
          style: 'destructive',
          onPress: handleConfirmedRun,
        },
      ],
    );
  }, [channel, handleConfirmedRun, holdMs, side, t]);

  return (
    <CardShell
      title={t('testCommands.groups.lhm2Write.title')}
      description={t('testCommands.groups.lhm2Write.description')}
    >
      <View className="gap-2">
        <Text variant="small" tone="muted">
          {t('testCommands.groups.lhm2Write.side')}
        </Text>
        <SegmentedControl
          options={sideOptions}
          value={side}
          onChange={setSide}
          accessibilityLabel={t('testCommands.groups.lhm2Write.side')}
        />
      </View>
      <View className="gap-2">
        <Text variant="small" tone="muted">
          {t('testCommands.groups.lhm2Write.channel')}
        </Text>
        <SegmentedControl
          options={channelOptions}
          value={String(channel)}
          onChange={handleChannelChange}
          accessibilityLabel={t('testCommands.groups.lhm2Write.channel')}
        />
      </View>
      <View className="gap-2">
        <Text variant="small" tone="muted">
          {t('testCommands.groups.lhm2Write.duration')}
        </Text>
        <SegmentedControl
          options={holdOptions}
          value={String(holdMs)}
          onChange={handleHoldChange}
          accessibilityLabel={t('testCommands.groups.lhm2Write.duration')}
        />
      </View>
      <Button
        label={t('testCommands.groups.lhm2Write.run')}
        icon={Lightning}
        variant="destructive"
        loading={runningId === 'lhm2Write'}
        disabled={disabled}
        onPress={handleRunPress}
      />
    </CardShell>
  );
};

export default Lhm2WriteCard;
