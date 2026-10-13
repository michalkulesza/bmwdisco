import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import Text from '@/ui/Text';

const HeaderDoneButton = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const handlePress = useCallback(() => router.back(), [router]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.done')}
      onPress={handlePress}
      className="min-h-touch justify-center px-2 active:opacity-60"
    >
      <Text variant="labelStrong">{t('common.done')}</Text>
    </Pressable>
  );
};

export default HeaderDoneButton;
