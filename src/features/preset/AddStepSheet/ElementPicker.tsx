import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View, type ListRenderItemInfo } from 'react-native';

import { categoryOf, type ElementId } from '@/data/elements';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { translateKey } from '@/ui/tile/helpers';

import { categoryAppearance } from '../category-appearance';
import ElementWarning from '../ElementWarning';

import type { ElementListRow } from './helpers';

const LIST_STYLE = { maxHeight: 280 };

interface ElementPickerProps {
  rows: ElementListRow[];
  selected: ElementId | undefined;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: ElementId) => void;
}

const getRowKey = (row: ElementListRow) => (row.type === 'group' ? `g-${row.category}` : row.id);

interface ElementOptionProps {
  id: ElementId;
  selected: boolean;
  onSelect: (id: ElementId) => void;
}

const ElementOption = memo(({ id, selected, onSelect }: ElementOptionProps) => {
  const { t } = useTranslation();
  const check = useColorToken('text');
  const { icon: IconComponent, hue } = categoryAppearance(categoryOf(id));
  const color = useColorToken(hue);

  const handlePress = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={translateKey(t, `elements.${id}`)}
      accessibilityState={{ checked: selected }}
      onPress={handlePress}
      className="min-h-11 flex-row items-center gap-3 px-3 active:opacity-60"
    >
      <IconComponent size={20} color={color} />
      <Text variant="body" className="flex-1">
        {translateKey(t, `elements.${id}`)}
      </Text>
      <ElementWarning elements={[id]} />
      {selected ? <CheckIcon size={18} weight="bold" color={check} /> : null}
    </Pressable>
  );
});
ElementOption.displayName = 'ElementOption';

const ElementPicker = ({ rows, selected, open, onToggle, onSelect }: ElementPickerProps) => {
  const { t } = useTranslation();
  const muted = useColorToken('text-muted');
  const selectedCategory = selected ? categoryOf(selected) : 'other';
  const { icon: IconComponent, hue } = categoryAppearance(selectedCategory);
  const hueColor = useColorToken(hue);
  const triggerLabel = selected
    ? translateKey(t, `elements.${selected}`)
    : t('preset.step.chooseLight');

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<ElementListRow>) =>
      item.type === 'group' ? (
        <Text variant="tag" tone="muted" className="px-3 pb-1 pt-3 uppercase">
          {translateKey(t, `categories.${item.category}`)}
        </Text>
      ) : (
        <ElementOption id={item.id} selected={item.id === selected} onSelect={onSelect} />
      ),
    [onSelect, selected, t],
  );

  return (
    <View className="gap-2">
      <Text variant="meta" tone="muted">
        {t('preset.light')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('preset.light')}
        accessibilityState={{ expanded: open }}
        accessibilityValue={{ text: triggerLabel }}
        onPress={onToggle}
        className="h-14 flex-row items-center gap-3 rounded-card border border-card-border bg-card px-3 active:opacity-60"
      >
        <IconComponent size={22} color={hueColor} />
        <View className="flex-1">
          <Text variant="bodyMedium" numberOfLines={1}>
            {triggerLabel}
          </Text>
          {selected ? (
            <Text variant="small" tone="muted">
              {translateKey(t, `categories.${selectedCategory}`)}
            </Text>
          ) : null}
        </View>
        <ElementWarning elements={selected ? [selected] : []} />
        <CaretDownIcon size={16} color={muted} />
      </Pressable>
      {open ? (
        <View className="overflow-hidden rounded-card border border-card-border bg-card">
          <FlatList
            data={rows}
            keyExtractor={getRowKey}
            renderItem={renderRow}
            style={LIST_STYLE}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          />
        </View>
      ) : null}
    </View>
  );
};

export default ElementPicker;
