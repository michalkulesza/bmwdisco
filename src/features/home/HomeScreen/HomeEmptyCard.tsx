import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import Button from '@/ui/Button';
import IconBadge from '@/ui/IconBadge';
import Text from '@/ui/Text';

interface HomeEmptyCardProps {
  section: 'favourites' | 'presets';
  onNewPreset: () => void;
}

const HomeEmptyCard = ({ section, onNewPreset }: HomeEmptyCardProps) => {
  const { t } = useTranslation();

  if (section === 'favourites') {
    return (
      <View className="mt-3 flex-row items-center gap-3 rounded-card border border-dashed border-line p-4">
        <IconBadge icon={StarIcon} size="md" />
        <View className="flex-1 gap-0.5">
          <Text variant="labelStrong">{t('home.emptyFavouritesTitle')}</Text>
          <Text variant="small" tone="muted">
            {t('home.emptyFavouritesBody')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mt-3 gap-3 rounded-card border border-card-border bg-card p-4">
      <View className="gap-0.5">
        <Text variant="labelStrong">{t('home.emptyPresetsTitle')}</Text>
        <Text variant="small" tone="muted">
          {t('home.emptyPresetsBody')}
        </Text>
      </View>
      <Button label={t('home.createPreset')} onPress={onNewPreset} />
    </View>
  );
};

export default HomeEmptyCard;
