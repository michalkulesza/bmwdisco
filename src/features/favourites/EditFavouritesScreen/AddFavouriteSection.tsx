import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import type { TileItem } from '@/ui/tile/types';

interface AddFavouriteSectionProps {
  candidates: TileItem[];
  onAdd: (id: string) => void;
}

interface CandidateRowProps {
  item: TileItem;
  onAdd: (id: string) => void;
}

const CandidateRow = ({ item, onAdd }: CandidateRowProps) => {
  const { t } = useTranslation();
  const hue = useColorToken(item.hue);
  const text = useColorToken('text');
  const IconComponent = item.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('favourites.addLabel', { name: item.name })}
      onPress={() => onAdd(item.id)}
      className="min-h-14 flex-row items-center gap-3 rounded-card border border-card-border bg-card px-3 active:opacity-60"
    >
      <IconComponent size={24} color={hue} />
      <Text variant="bodyMedium" className="flex-1" numberOfLines={1}>
        {item.name}
      </Text>
      <PlusIcon size={20} color={text} />
    </Pressable>
  );
};

const AddFavouriteSection = ({ candidates, onAdd }: AddFavouriteSectionProps) => {
  const { t } = useTranslation();

  return (
    <View className="gap-2 pt-6">
      <Text variant="section" accessibilityRole="header" className="pb-1">
        {t('favourites.addSection')}
      </Text>
      {candidates.length === 0 ? (
        <Text variant="meta" tone="muted">
          {t('favourites.allAdded')}
        </Text>
      ) : (
        candidates.map((item) => <CandidateRow key={item.id} item={item} onAdd={onAdd} />)
      )}
    </View>
  );
};

export default AddFavouriteSection;
