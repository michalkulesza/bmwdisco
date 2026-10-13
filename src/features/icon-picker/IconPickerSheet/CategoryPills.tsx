import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import Text from '@/ui/Text';
import { translateKey } from '@/ui/tile/helpers';

import { CATEGORY_FILTERS, type CategoryFilter } from './helpers';

interface CategoryPillsProps {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}

interface PillProps {
  filter: CategoryFilter;
  selected: boolean;
  onSelect: (filter: CategoryFilter) => void;
}

const Pill = ({ filter, selected, onSelect }: PillProps) => {
  const { t } = useTranslation();
  const handlePress = useCallback(() => onSelect(filter), [filter, onSelect]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={handlePress}
      hitSlop={{ top: 4, bottom: 4 }}
      className={`h-9 justify-center rounded-pill border px-4 ${selected ? 'border-line bg-raised' : 'border-card-border bg-card'}`}
    >
      <Text variant={selected ? 'labelStrong' : 'label'} tone={selected ? 'default' : 'muted'}>
        {translateKey(t, `iconPicker.categories.${filter}`)}
      </Text>
    </Pressable>
  );
};

const CategoryPills = ({ value, onChange }: CategoryPillsProps) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    accessibilityRole="tablist"
    contentContainerClassName="gap-2"
    className="grow-0"
  >
    {CATEGORY_FILTERS.map((filter) => (
      <Pill key={filter} filter={filter} selected={filter === value} onSelect={onChange} />
    ))}
  </ScrollView>
);

export default CategoryPills;
