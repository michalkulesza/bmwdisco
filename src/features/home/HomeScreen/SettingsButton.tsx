import { useRouter } from 'expo-router';
import { SlidersHorizontalIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { useColorToken } from '@/ui/theme';

const SettingsButton = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const color = useColorToken('text');

  const handlePress = useCallback(() => router.push('/settings'), [router]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.settings')}
      onPress={handlePress}
      className="size-touch items-center justify-center active:opacity-60"
    >
      <SlidersHorizontalIcon size={22} weight="bold" color={color} />
    </Pressable>
  );
};

export default SettingsButton;
