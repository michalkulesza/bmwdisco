import { useRouter } from 'expo-router';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken, type HueToken } from '@/ui/theme';
import { HUE_TOKENS, hueOf } from '@/ui/tile/helpers';
import NamedIcon from '@/ui/tile/NamedIcon';

interface AppearanceCardProps {
  color: string;
  icon: string;
  onChangeColor: (color: string) => void;
}

interface SwatchProps {
  hue: HueToken;
  selected: boolean;
  onSelect: (hue: HueToken) => void;
}

const Swatch = ({ hue, selected, onSelect }: SwatchProps) => {
  const { t } = useTranslation();
  const color = useColorToken(hue);
  const ring = useColorToken('text');

  const handlePress = useCallback(() => onSelect(hue), [hue, onSelect]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={t(`preset.colours.${hue}`)}
      accessibilityState={{ checked: selected }}
      onPress={handlePress}
      hitSlop={4}
      className="size-8 items-center justify-center rounded-pill border-2"
      style={{ borderColor: selected ? ring : 'transparent' }}
    >
      <View className="size-6 rounded-pill" style={{ backgroundColor: color }} />
    </Pressable>
  );
};

const AppearanceCard = ({ color, icon, onChangeColor }: AppearanceCardProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const hue = hueOf(color);
  const hueColor = useColorToken(hue);
  const chevron = useColorToken('chevron');

  const handleIconPress = useCallback(() => router.push('/icon-picker'), [router]);

  return (
    <View className="overflow-hidden rounded-card border border-card-border bg-card">
      <View className="gap-3 p-4">
        <Text variant="label">{t('preset.colour')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          className="-mx-4 -my-1"
          contentContainerClassName="gap-3 px-4 py-1"
        >
          {HUE_TOKENS.map((token) => (
            <Swatch key={token} hue={token} selected={token === hue} onSelect={onChangeColor} />
          ))}
        </ScrollView>
      </View>
      <View className="ml-4 h-px bg-card-border" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('preset.icon')}
        onPress={handleIconPress}
        className="min-h-14 flex-row items-center gap-3 px-4 active:opacity-60"
      >
        <Text variant="label" className="flex-1">
          {t('preset.icon')}
        </Text>
        <NamedIcon name={icon} size={22} color={hueColor} />
        <CaretRightIcon size={18} color={chevron} />
      </Pressable>
    </View>
  );
};

export default memo(AppearanceCard);
