import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { diffSnapshots, formatEcuAddress, type DiffRow, type Lhm2Snapshot } from '@/domain';
import Text from '@/ui/Text';

import { toHexByte } from './helpers';

interface DiffRowViewProps {
  row: DiffRow;
}

const DiffRowView = ({ row }: DiffRowViewProps) => {
  const { t } = useTranslation();
  const key = row.kind === 'pwm' ? 'pwm' : 'current';
  const label = t(`testCommands.groups.lhm2Read.${key}`, { channel: row.channel });
  const tone = row.changed ? 'text-hue-amber font-geist-semibold' : 'text-ink-soft';

  return (
    <View className="flex-row items-center py-1" accessible accessibilityLabel={label}>
      <Text variant="small" className={`w-24 ${tone}`}>
        {label}
      </Text>
      {row.values.map((value, index) => (
        <Text key={index} variant="small" className={`w-20 text-center font-geist-mono ${tone}`}>
          {toHexByte(value)}
        </Text>
      ))}
    </View>
  );
};

interface SideDiffProps {
  ecu: number;
  snapshots: readonly Lhm2Snapshot[];
}

const SideDiff = ({ ecu, snapshots }: SideDiffProps) => {
  const rows = useMemo(() => diffSnapshots(snapshots), [snapshots]);

  return (
    <View className="gap-2">
      <Text variant="labelStrong">{formatEcuAddress(ecu)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View className="flex-row items-end pb-1">
            <View className="w-24" />
            {snapshots.map((snapshot) => (
              <Text
                key={snapshot.id}
                variant="small"
                tone="muted"
                numberOfLines={2}
                className="w-20 text-center"
              >
                {snapshot.label}
              </Text>
            ))}
          </View>
          {rows.map((row, index) => (
            <DiffRowView key={index} row={row} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

interface SnapshotDiffProps {
  snapshots: readonly Lhm2Snapshot[];
}

const SnapshotDiff = ({ snapshots }: SnapshotDiffProps) => {
  const { t } = useTranslation();
  const sides = useMemo(() => {
    const byEcu = new Map<number, Lhm2Snapshot[]>();
    for (const snapshot of snapshots) {
      byEcu.set(snapshot.ecu, [...(byEcu.get(snapshot.ecu) ?? []), snapshot]);
    }

    return [...byEcu.entries()];
  }, [snapshots]);

  if (snapshots.length === 0) return null;

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text variant="labelStrong">{t('testCommands.groups.lhm2Read.diffTitle')}</Text>
        <Text variant="small" tone="muted">
          {t('testCommands.groups.lhm2Read.diffHint')}
        </Text>
      </View>
      {sides.map(([ecu, items]) => (
        <SideDiff key={ecu} ecu={ecu} snapshots={items} />
      ))}
    </View>
  );
};

export default SnapshotDiff;
