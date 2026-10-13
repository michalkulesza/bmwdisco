import { router } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chassisOptions, type ChassisOption } from '@/features/connect/helpers';
import { useSettingsStore } from '@/stores/settings';
import { selectionHaptic } from '@/ui/haptics';
import ListRow from '@/ui/ListRow';

const OPTIONS = chassisOptions();

const keyOf = (option: ChassisOption) => option.code;

const ROW_HEIGHT = 57;

const getItemLayout = (_: ArrayLike<ChassisOption> | null | undefined, index: number) => ({
  length: ROW_HEIGHT,
  offset: ROW_HEIGHT * index,
  index,
});

const Separator = () => <View className="ml-4 h-px bg-card-border" />;

interface ChassisRowProps {
  option: ChassisOption;
  selected: boolean;
  onSelect: (code: string) => void;
}

const ChassisRow = memo(({ option, selected, onSelect }: ChassisRowProps) => {
  const handlePress = useCallback(() => onSelect(option.code), [onSelect, option.code]);

  return <ListRow label={option.label} checked={selected} onPress={handlePress} />;
});
ChassisRow.displayName = 'ChassisRow';

const selectedIndex = () => {
  const code = useSettingsStore.getState().demoChassis;

  return Math.max(
    0,
    OPTIONS.findIndex((option) => option.code === code),
  );
};

const DemoChassisScreen = () => {
  const insets = useSafeAreaInsets();
  const [initialIndex] = useState(() => selectedIndex());
  const demoChassis = useSettingsStore((state) => state.demoChassis);
  const setDemoChassis = useSettingsStore((state) => state.setDemoChassis);

  const handleSelect = useCallback(
    (code: string) => {
      selectionHaptic();
      setDemoChassis(code);
      router.back();
    },
    [setDemoChassis],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChassisOption }) => (
      <ChassisRow option={item} selected={item.code === demoChassis} onSelect={handleSelect} />
    ),
    [demoChassis, handleSelect],
  );

  return (
    <FlatList
      data={OPTIONS}
      extraData={demoChassis}
      getItemLayout={getItemLayout}
      initialScrollIndex={initialIndex}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-page"
      contentContainerClassName="mx-4 overflow-hidden rounded-card border border-card-border bg-card"
      contentContainerStyle={{ marginBottom: insets.bottom + 16 }}
    />
  );
};

export default DemoChassisScreen;
