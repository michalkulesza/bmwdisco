import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { categoryOf, type ElementId } from '@/data/elements';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { translateKey } from '@/ui/tile/helpers';

import { categoryAppearance } from '../category-appearance';
import ElementWarning from '../ElementWarning';

interface ElementOptionProps {
  id: ElementId;
  selected: boolean;
  onSelect: (id: ElementId) => void;
}

const ElementOption = ({ id, selected, onSelect }: ElementOptionProps) => {
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
      className="h-12 flex-row items-center gap-3 px-3 active:opacity-60"
    >
      <IconComponent size={20} color={color} />
      <Text variant="body" className="flex-1">
        {translateKey(t, `elements.${id}`)}
      </Text>
      <ElementWarning elements={[id]} />
      {selected ? <CheckIcon size={18} weight="bold" color={check} /> : null}
    </Pressable>
  );
};

export default memo(ElementOption);
