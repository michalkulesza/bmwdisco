import { FloppyDisk, Trash } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatEcuAddress, lhm2ReadGroup, splitLhm2Record, type Lhm2Snapshot } from '@/domain';
import Button from '@/ui/Button';
import { selectionHaptic, successHaptic } from '@/ui/haptics';
import Text from '@/ui/Text';

import FieldInput from '../FieldInput';

import CardShell from './CardShell';
import ChipGroup from './ChipGroup';
import {
  SNAPSHOT_LABELS,
  snapshotLabelText,
  toHexByte,
  type RunAction,
  type SnapshotLabel,
} from './helpers';
import RunActionButton from './RunActionButton';
import SnapshotDiff from './SnapshotDiff';

interface ReadingViewProps {
  ecu: number;
  data: Uint8Array;
}

const ReadingView = ({ ecu, data }: ReadingViewProps) => {
  const { pwm, current } = splitLhm2Record(data);
  const pwmText = pwm.map(toHexByte).join(' ');
  const currentText = current.map(toHexByte).join(' ');

  return (
    <View
      className="gap-1"
      accessible
      accessibilityLabel={`${formatEcuAddress(ecu)} ${pwmText} ${currentText}`}
    >
      <Text variant="labelStrong">{formatEcuAddress(ecu)}</Text>
      <Text variant="small" tone="soft" className="font-geist-mono">
        {`PWM  ${pwmText}`}
      </Text>
      <Text variant="small" tone="soft" className="font-geist-mono">
        {`I    ${currentText}`}
      </Text>
    </View>
  );
};

interface Lhm2ReadCardProps {
  readings: ReadonlyMap<number, Uint8Array>;
  snapshots: readonly Lhm2Snapshot[];
  runningId?: string;
  disabled: boolean;
  onRead: (action: RunAction) => void;
  onSave: (label: string) => void;
  onClearSnapshots: () => void;
}

const Lhm2ReadCard = ({
  readings,
  snapshots,
  runningId,
  disabled,
  onRead,
  onSave,
  onClearSnapshots,
}: Lhm2ReadCardProps) => {
  const { t } = useTranslation();
  const [label, setLabel] = useState<SnapshotLabel>();
  const [custom, setCustom] = useState('');
  const readAction = useMemo<RunAction>(
    () => ({ id: 'lhm2Read', label: t('testCommands.groups.lhm2Read.read'), group: lhm2ReadGroup }),
    [t],
  );
  const labelOptions = useMemo(
    () =>
      SNAPSHOT_LABELS.map((value) => ({
        value,
        label: t(`testCommands.groups.lhm2Read.labels.${value}`),
      })),
    [t],
  );
  const snapshotLabel = snapshotLabelText(label, custom, t);
  const canSave = readings.size > 0 && snapshotLabel.length > 0;

  const handleSave = useCallback(() => {
    selectionHaptic();
    onSave(snapshotLabel);
    successHaptic();
  }, [onSave, snapshotLabel]);

  const handleClear = useCallback(() => {
    selectionHaptic();
    onClearSnapshots();
  }, [onClearSnapshots]);

  return (
    <CardShell
      title={t('testCommands.groups.lhm2Read.title')}
      description={t('testCommands.groups.lhm2Read.description')}
    >
      <RunActionButton
        action={readAction}
        running={runningId === readAction.id}
        disabled={disabled}
        onRun={onRead}
      />
      <View className="gap-2">
        <Text variant="small" tone="muted">
          {t('testCommands.groups.lhm2Read.latest')}
        </Text>
        {readings.size === 0 ? (
          <Text variant="meta" tone="muted">
            {t('testCommands.groups.lhm2Read.none')}
          </Text>
        ) : (
          [...readings.entries()].map(([ecu, data]) => (
            <ReadingView key={ecu} ecu={ecu} data={data} />
          ))
        )}
      </View>
      <View className="gap-2">
        <Text variant="small" tone="muted">
          {t('testCommands.groups.lhm2Read.labelTitle')}
        </Text>
        <ChipGroup
          options={labelOptions}
          value={label}
          onChange={setLabel}
          accessibilityLabel={t('testCommands.groups.lhm2Read.labelTitle')}
        />
        <FieldInput
          label={t('testCommands.groups.lhm2Read.custom')}
          value={custom}
          onChangeText={setCustom}
          returnKeyType="done"
        />
      </View>
      <Button
        label={t('testCommands.groups.lhm2Read.save')}
        icon={FloppyDisk}
        variant="secondary"
        disabled={!canSave}
        onPress={handleSave}
      />
      <SnapshotDiff snapshots={snapshots} />
      {snapshots.length > 0 ? (
        <Button
          label={t('testCommands.groups.lhm2Read.clear')}
          icon={Trash}
          variant="secondary"
          onPress={handleClear}
        />
      ) : null}
    </CardShell>
  );
};

export default Lhm2ReadCard;
