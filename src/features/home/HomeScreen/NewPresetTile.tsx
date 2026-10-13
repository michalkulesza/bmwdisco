import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

interface NewPresetTileProps {
  side: number;
  onPress: () => void;
}

const NewPresetTile = ({ side, onPress }: NewPresetTileProps) => {
  const { t } = useTranslation();
  const color = useColorToken('text-muted');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.newPreset')}
      onPress={onPress}
      className="items-center justify-center gap-2.5 rounded-tile border border-dashed border-line active:opacity-60"
      style={{ width: side, height: side }}
    >
      <PlusIcon size={28} color={color} />
      <Text variant="meta" tone="muted">
        {t('home.newPreset')}
      </Text>
    </Pressable>
  );
};

export default NewPresetTile;
